import { Constructor, CredentialsProvider } from 'glider';

export class Registry<T> {
  private entries: Record<string, T> = {};

  register(key: string, item: T): void {
    this.entries[key] = item;
  }

  get(key: string): T | null {
    return this.entries[key] ?? null;
  }
}

export interface Context {
  credentials: Registry<Constructor<CredentialsProvider>>;
}

export class InMemoryContext implements Context {
  credentials = new Registry<Constructor<CredentialsProvider>>();
}
