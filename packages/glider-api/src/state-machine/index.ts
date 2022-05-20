import { DynamoDB, StepFunctions } from 'aws-sdk';
import parser from 'cron-parser';
import pino from 'pino';
import { lambdaRequestTracker, pinoLambdaDestination } from 'pino-lambda';

import { ConnectionStore } from '../stores';

import type { LambdaContext } from './LambdaContext';

const withRequest = lambdaRequestTracker();
const destination = pinoLambdaDestination();
const logger = pino({}, destination);

const connections = new ConnectionStore({
  client: new DynamoDB.DocumentClient({ apiVersion: '2012-11-05' }),
  tableName: 'paul-glider-Table',
});

// Properties passed to all states
interface BaseEvent {
  connectionId: string;
  restart: {
    stateMachineArn: string;
    executionCount: number;
  };
}

// Input to 'Wait' states. These cause the Step Function to sleep.
interface WaitEvent extends BaseEvent {
  waitSeconds: number;
}

// Strong typing for Step Function Lambdas. All inputs and outputs inherit from
// BaseEvent to ensure we pass global context through the entire chain.
type Handler<
  I extends BaseEvent = BaseEvent,
  O extends BaseEvent = BaseEvent
> = (event: I, context: LambdaContext) => Promise<O>;

type BeforeSyncInput = BaseEvent;
interface BeforeSyncOutput extends BaseEvent {
  // Present if we are going to sync. Absent if another sync was running.
  jobId: string | null;

  // Runner configuration
  runner: {
    // The arguments to pass to the runner
    args: string[];
  };
}

export const beforeSync: Handler<BeforeSyncInput, BeforeSyncOutput> = async (
  event,
  context
) => {
  withRequest(event, context);

  // Check if connection has another job running.
  // If yes, don't return a job ID. The state machine will terminate.
  // If not, generate a Job ID and mark connection as running.
  const jobId = await connections.reserve(event.connectionId);

  return {
    ...event,
    jobId,
    runner: {
      args: [
        '--source',
        'github',
        '--source-credentials',
        JSON.stringify({
          token: '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',
        }),
        '--source-options',
        JSON.stringify({
          orgs: ['balsa'],
          start: '2022-05-01',
        }),
        '--destination',
        's3',
        '--destination-credentials',
        JSON.stringify({
          accessKeyId: 'AKIAVKMRU24GT5BXZ6YR',
          secretAccessKey: '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',
        }),
        '--destination-options',
        JSON.stringify({
          // Still needed here, for now
          accessKeyId: 'AKIAVKMRU24GT5BXZ6YR',
          secretAccessKey: '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',
          bucketName: 'balsa-glider-test',
          region: 'us-west-2',
        }),
      ],
    },
  };
};

// `afterSync` receives `beforeSync`'s output verbatim. The only difference in
// types is that `jobId` is guaranteed to exist, since if it was null we would
// not have synced.
type AfterSyncInput = BeforeSyncOutput & {
  jobId: NonNullable<BeforeSyncOutput['jobId']>;
};

export const afterSync: Handler<AfterSyncInput, WaitEvent> = async (
  event,
  context
) => {
  withRequest(event, context);

  await connections.release(event.connectionId);

  const connection = await connections.get(event.connectionId);
  if (!connection) {
    throw new Error(`no connection with id ${event.connectionId}`);
  }

  const schedule = parser.parseExpression(connection.schedule);
  const next = schedule.next();
  // TODO(ptr): change sleep state to use a wakeup time intead of duration
  const waitMillis = next.getTime() - Date.now();
  const waitSeconds = waitMillis / 1000;

  logger.info({
    msg: `Sleeping for ${waitSeconds} seconds until ${next}`,
    waitSeconds,
    until: next,
    schedule: connection.schedule,
  });

  return {
    ...event,

    // The `Wait` step reads `$.waitSeconds` to figure out how long to sleep for
    waitSeconds,
  };
};

enum ConnectionStatus {
  Idle = 'IDLE',
  Ready = 'READY',
  Running = 'RUNNING',
}

export const afterSleep: Handler = async (event, context) => {
  withRequest(event, context);

  // Check schedule.

  return {
    ...event,

    // The state machine reads `$.status` to decide what to do next. If status
    // is 'IDLE', it will wait `$.sleepSeconds` seconds. If status is 'RUNNING',
    // it will terminate. Otherwise, it will invoke the `invokeSelf` Lambda.
    status: ConnectionStatus.Running,
  };
};

export const invokeSelf: Handler = async (event, context) => {
  withRequest(event, context);

  logger.info({
    msg: 'Invoking another execution of the state machine',
  });

  const sfn = new StepFunctions({
    apiVersion: '2016-11-23',
  });

  await sfn
    .startExecution({
      stateMachineArn: event.restart.stateMachineArn,
      input: JSON.stringify({
        connectionId: event.connectionId,
        restart: {
          executionCount: event.restart.executionCount + 1,
          stateMachineArn: event.restart.stateMachineArn,
        },
      }),
    })
    .promise();

  return event;
};
