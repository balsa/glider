import { MysqlDestination } from './destinations/mysql';
import { S3Destination } from './destinations/s3';
import { StdoutDestination } from './destinations/stdout';
import { GitHubSource } from './sources/github';
import { Source, Destination } from './types';

class Registry<T> {
  private entries: Record<string, T> = {};

  register(key: string, item: T): void {
    this.entries[key] = item;
  }

  get(key: string): T | null {
    return this.entries[key] ?? null;
  }
}

interface Ctor<T> {
  // Sources define their own options object format, so we can't validate it at
  // compile time.
  //
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (options: any): T;
}

export function createSourceRegistry(): Registry<Ctor<Source>> {
  const registry = new Registry<Ctor<Source>>();

  registry.register('github', GitHubSource);

  return registry;
}

export function createDestinationRegistry(): Registry<Ctor<Destination>> {
  const registry = new Registry<Ctor<Destination>>();

  registry.register('mysql', MysqlDestination);
  registry.register('s3', S3Destination);
  registry.register('stdout', StdoutDestination);

  return registry;
}
