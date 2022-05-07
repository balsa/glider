import pino from 'pino';

import type { Destination } from '../types';

export class StdoutDestination implements Destination {
  name = 'stdout';
  logger = pino({
    enabled: false,
    base: {
      destination: this.name,
    },
  });

  write(
    jobId: string,
    source: string,
    stream: string,
    records: unknown[]
  ): void {
    for (const record of records) {
      this.logger.info({
        job: jobId,
        source,
        stream,
        record,
      });
    }
  }
}
