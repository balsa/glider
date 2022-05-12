export type Constructor<T> = new (...args: any[]) => T;

declare module 'glider' {
  export const version: string;

  export interface PluginExports {
    activate?(context: PluginContext);
  }

  export interface PluginContext {
    options: any;
  }

  export interface CredentialsProvider {
    get(): any | Promise<any>;
  }

  export namespace credentials {
    export function registerProvider(
      constructor: Constructor<CredentialsProvider>
    );
  }
}
