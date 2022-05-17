import { DynamoDB } from 'aws-sdk';
import pino from 'pino';
import { lambdaRequestTracker, pinoLambdaDestination } from 'pino-lambda';

import { SourceStore } from '../stores/source';
import { assertIsAWSError } from '../utils';

const withRequest = lambdaRequestTracker();
const destination = pinoLambdaDestination();
const logger = pino({}, destination);

const store = new SourceStore({
  client: new DynamoDB.DocumentClient({ apiVersion: '2012-11-05' }),
  tableName: 'paul-glider-Table',
});

type Handler = (event: any, context: any) => Promise<any>;

export const beforeSync: Handler = async (event, context) => {
  withRequest(event, context);

  // Check if connection has another job running.
  // If yes, don't return a job ID. The state machine will terminate.
  // If not, generate a Job ID and mark connection as running.

  return {
    jobId: 'TODO',
  };
};

export const afterSync: Handler = async (event, context) => {
  withRequest(event, context);

  // Check schedule and sleep.
  const waitSeconds = 200;

  return {
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
};
