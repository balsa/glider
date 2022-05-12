import type { CredentialsProvider } from 'glider';

export interface Context<P = any> {
  credentials: CredentialsProvider;
  parent?: P;
}

export interface NextContext<T, P = any> extends Context<P> {
  records: T[];
}

export interface Response {
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  statusCode: number;
}

export interface Stream<C = any> {
  name: string;
  parent?: Stream;

  seed: string | ((context: C) => string);
  next?(response: Response, records: unknown[], context: C): string | null;

  transform?(this: void, raw: unknown, context: C): unknown[];
}

export interface Source {
  name: string;
  headers?:
    | Record<string, string>
    | ((context: Context) => Record<string, string>);
  requestSpacing?: number | ((response: Response) => number);
  streams: Stream[];
}

export interface Destination {
  name: string;

  open?(): Promise<void>;
  close?(): Promise<void>;

  write(
    jobId: string,
    source: string,
    stream: string,
    records: unknown[],
    retrievedAt: number
  ): void;
}
