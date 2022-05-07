import {
  createSourceRegistry,
  createDestinationRegistry,
} from '@glider/connectors';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import yargs from 'yargs';

import { Job } from './job';

const logger = pino();

logger.info({
  msg: '🛫 Glider runner booting up...',
});

function die(o: unknown): never {
  logger.error(o);
  logger.flush();
  process.exit(1);
}

async function main() {
  const args = await yargs(process.argv)
    .option('destination', {
      alias: 'd',
      describe: 'The destination to write to',
      demandOption: true,
      requiresArg: true,
      type: 'string',
    })
    .option('destination-options', {
      coerce: JSON.parse,
      describe: 'JSON configuration object for the destination',
      requiresArg: true,
    })
    .option('source', {
      alias: 's',
      describe: 'The source to read from',
      demandOption: true,
      requiresArg: true,
      type: 'string',
    })
    .option('source-options', {
      coerce: JSON.parse,
      describe: 'JSON configuration object for the source',
      requiresArg: true,
    })
    .alias('h', 'help')
    .alias('v', 'version').argv;

  logger.info({
    msg: `Connection configuration: ${args.source} -> ${args.destination}`,
    source: {
      type: args.source,
      options: args.sourceOptions,
    },
    destination: {
      type: args.destination,
      options: args.destinationOptions,
    },
  });

  const sources = createSourceRegistry();
  const destinations = createDestinationRegistry();

  const source = sources.get(args.source);
  if (!source) {
    die({
      msg: `Couldn't find source of type '${args.source}'`,
    });
  }

  const destination = destinations.get(args.destination);
  if (!destination) {
    die({
      msg: `Couldn't find destination of type '${args.destination}'`,
    });
  }

  const job = new Job({
    id: uuidv4(),
    source: new source(args.sourceOptions),
    destination: new destination(args.destinationOptions),
  });

  await job.run();
}

main();
