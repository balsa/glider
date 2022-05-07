import { Destination, Source, Stream, Response } from '@glider/connectors';
import got from 'got';
import pino, { Logger } from 'pino';

import { sleep } from './utils';

interface JobOptions {
  id: string;
  source: Source;
  destination: Destination;
  logger?: Logger;
}

function defaultTransform(raw: string): unknown[] {
  const data = JSON.parse(raw);
  if (Array.isArray(data)) {
    return data;
  } else {
    return [data];
  }
}

const DEFAULT_REQUEST_SPACING = 500;

function getRequestSpacing(source: Source, response: Response): number {
  if (typeof source.requestSpacing === 'function') {
    return source.requestSpacing(response);
  } else {
    return source.requestSpacing ?? DEFAULT_REQUEST_SPACING;
  }
}

function getSeed(stream: Stream, context: unknown): string {
  if (typeof stream.seed === 'function') {
    return stream.seed(context);
  } else {
    return stream.seed;
  }
}

function getHeaders(source: Source): Record<string, string> {
  if (!source.headers) {
    return {};
  } else if (typeof source.headers === 'function') {
    return source.headers();
  } else {
    return source.headers;
  }
}

export class Job {
  readonly id: string;

  private readonly source: Source;
  private readonly destination: Destination;
  private readonly logger: Logger;

  constructor(private readonly options: JobOptions) {
    this.id = options.id;
    this.source = options.source;
    this.destination = options.destination;
    this.logger = options.logger ?? pino();
  }

  async run(): Promise<void> {
    this.logger.info({
      msg: `Starting job ${this.id} (${this.source.name} -> ${this.destination.name})`,
      id: this.id,
      source: this.source.name,
      destination: this.destination.name,
    });

    this.destination.open?.();

    for (const stream of this.source.streams) {
      await this.execStream(stream);
    }

    this.destination.close?.();

    this.logger.info({
      msg: `Finished job ${this.id} (${this.source.name} -> ${this.destination.name})`,
      id: this.id,
      source: this.source.name,
      destination: this.destination.name,
    });
  }

  async execStream(stream: Stream): Promise<void> {
    return this.readStream(stream, {}, async (records) => {
      const now = Date.now();
      await this.destination.write(
        this.id,
        this.source.name,
        stream.name,
        records,
        now
      );
    });
  }

  async readStream(
    stream: Stream,
    context: unknown,
    callback: (records: unknown[]) => void
  ): Promise<void> {
    this.logger.info({
      msg: `Starting stream '${stream.name}'`,
    });

    if (stream.parent) {
      await this.readStream(stream.parent, {}, async (records: unknown[]) => {
        for (const record of records) {
          await this.readStreamInternal(stream, record, callback);
        }
      });
    } else {
      await this.readStreamInternal(stream, context, callback);
    }
  }

  async readStreamInternal(
    stream: Stream,
    context: unknown,
    callback: (records: unknown[]) => void
  ): Promise<void> {
    const headers = getHeaders(this.source);
    const transform = stream.transform ?? defaultTransform;

    let url = getSeed(stream, context);
    while (url) {
      this.logger.info({ msg: `Fetching '${url}'`, url });
      const response = await got(url, { headers, throwHttpErrors: false });

      const responseForSource = {
        url,
        body: response.body,
        headers: response.headers,
      };

      if (response.statusCode >= 200 && response.statusCode < 300) {
        const records = transform(response.body, context);
        await callback(records);
        this.logger.info({ url, records: records.length });

        if (!stream.next) break;

        const nextUrl = stream.next(responseForSource, records, context);
        if (!nextUrl) break;

        url = nextUrl;
      }

      const spacing = getRequestSpacing(this.source, responseForSource);
      await sleep(spacing);
    }

    this.logger.info({
      msg: `Finished stream '${stream.name}'`,
    });
  }
}
