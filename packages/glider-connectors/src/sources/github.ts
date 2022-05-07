import pino from 'pino';

import parseLinkHeader from '../parseLinkHeader';
import type { Source, Stream, Response } from '../types';

interface Options {
  orgs: string[];
  token: string;
}

function getNextPageUrl(header?: string | string[]): string | null {
  if (!header) return null;

  if (Array.isArray(header)) {
    const candidates = header.map(getNextPageUrl).filter(Boolean);
    if (candidates.length < 1) {
      return null;
    } else if (candidates.length === 1) {
      return candidates[1];
    } else {
      throw new Error('Received multiple `Link` headers with `rel=next`');
    }
  } else {
    const links = parseLinkHeader(header);
    const link = links.find(
      (entry) =>
        entry.parameters.rel === 'next' || entry.parameters.rel === '"next"'
    );

    if (link) {
      return link.reference;
    } else {
      return null;
    }
  }
}

class GitHubStream {
  // GitHub's maximum allowed page size is 100 (default: 30)
  pageSize = 10;

  constructor(readonly name: string) {}

  next(response: Response, records: Timestamped[]) {
    return getNextPageUrl(response.headers['link']);
  }
}

interface OrganizationStreamOptions {
  name: string;
  path: string;
  orgs: string[];
}

class OrganizationStream implements Stream {
  readonly name: string;
  readonly path: string;
  readonly orgs: string[];

  // Cursor into org list
  private index = 0;

  constructor(options: OrganizationStreamOptions) {
    this.name = options.name;
    this.path = options.path;
    this.orgs = options.orgs;
  }

  seed() {
    return `https://api.github.com/orgs/${this.orgs[0]}/${this.path}`;
  }

  next(response: Response) {
    // If this org has more pages, get them first
    const url = getNextPageUrl(response.headers['link']);
    if (url) {
      return url;
    }

    // Otherwise, move to the next org
    if (this.index < this.orgs.length) {
      const org = this.orgs[this.index++];
      return `https://api.github.com/orgs/${org}/${this.path}`;
    }

    return null;
  }
}

interface RepositoryStreamContext {
  url: string;
}

interface Timestamped {
  created_at: string;
  updated_at: string;
}

class RepositoryStream extends GitHubStream {
  constructor(readonly parent: OrganizationStream, name: string) {
    super(name);
  }

  next(response: Response, records: Timestamped[]) {
    if (records.length === 0) {
      return null;
    }

    const oldest = new Date(records[records.length - 1].updated_at);
    const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    if (oldest < cutoff) {
      return null;
    }

    return super.next(response, records);
  }
}

class IssuesStream
  extends RepositoryStream
  implements Stream<RepositoryStreamContext>
{
  constructor(parent: OrganizationStream) {
    super(parent, 'issues');
  }

  seed(context: RepositoryStreamContext) {
    return `${context.url}/issues?state=all&sort=updated&direction=desc&per_page=${this.pageSize}`;
  }
}

class PullRequestsStream
  extends RepositoryStream
  implements Stream<RepositoryStreamContext>
{
  constructor(parent: OrganizationStream) {
    super(parent, 'pull_requests');
  }

  seed(context: RepositoryStreamContext) {
    return `${context.url}/pulls?state=all&sort=updated&direction=desc&per_page=${this.pageSize}`;
  }
}

export class GitHubSource implements Source {
  readonly name = 'github';
  readonly streams: Stream[];

  private readonly logger = pino({
    base: {
      source: this.name,
    },
  });

  constructor(private readonly options: Options) {
    const repositories = new OrganizationStream({
      name: 'repositories',
      path: 'repos',
      orgs: this.options.orgs,
    });

    this.streams = [
      repositories,
      new OrganizationStream({
        name: 'users',
        path: 'members',
        orgs: this.options.orgs,
      }),
      new IssuesStream(repositories),
      new PullRequestsStream(repositories),
    ];
  }

  headers() {
    return {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${this.options.token}`,
    };
  }

  requestSpacing(response: Response): number {
    function getNumericHeader(key: string): number | null {
      const valueOrValues = response.headers[key];
      if (Array.isArray(valueOrValues)) {
        return parseInt(valueOrValues[0]);
      } else if (valueOrValues) {
        return parseInt(valueOrValues);
      } else {
        return null;
      }
    }

    const retryAfter = getNumericHeader('retry-after');
    const rateLimitLimit = getNumericHeader('x-ratelimit-limit');
    const rateLimitRemaining = getNumericHeader('x-ratelimit-remaining');
    const rateLimitReset = getNumericHeader('x-ratelimit-reset');
    const rateLimitResetDate = rateLimitReset
      ? new Date(rateLimitReset * 1000)
      : null;

    this.logger.info({
      msg: `${rateLimitRemaining} requests left before next reset`,
      rateLimitLimit,
      rateLimitRemaining,
      rateLimitReset: rateLimitResetDate,
    });

    if (rateLimitRemaining === 0) {
      if (!rateLimitReset) {
        throw new Error(
          '`X-RateLimit-Remaining` is `0` but no `X-RateLimit-Reset` was provided'
        );
      }

      const spacing = rateLimitReset * 1000 - Date.now();
      this.logger.warn({
        msg: `Rate limited for ${spacing}ms`,
        type: 'primary',
        spacing,
        headers: {
          'retry-after': response.headers['retry-after'],
          'x-ratelimit-limit': response.headers['x-ratelimit-limit'],
          'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
          'x-ratelimit-reset': response.headers['x-ratelimit-reset'],
        },
      });

      // Pad by 5s to account for clock skew. We've seen GitHub continue to fail
      // us for a second or two after we wake up, claiming we woke up too early.
      return spacing + 5000;
    }

    if (retryAfter) {
      const spacing = retryAfter * 1000;
      this.logger.warn({
        msg: `Rate limited for ${spacing}ms`,
        type: 'secondary',
        spacing,
        headers: {
          'retry-after': response.headers['retry-after'],
          'x-ratelimit-limit': response.headers['x-ratelimit-limit'],
          'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
          'x-ratelimit-reset': response.headers['x-ratelimit-reset'],
        },
      });

      return spacing;
    }

    return 500;
  }
}
