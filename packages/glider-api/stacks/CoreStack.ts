import { Api, StackContext, Table } from '@serverless-stack/resources';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';

import { Worker } from '../constructs/Worker';

export function CoreStack({ stack }: StackContext) {
  // Create a HTTP API
  const api = new Api(stack, 'Api', {
    routes: {
      'GET /': 'src/lambda.handler',

      // Sources
      'GET /sources': 'src/controllers/sources.list',
      'POST /sources': 'src/controllers/sources.create',
      'GET /sources/{id}': 'src/controllers/sources.get',
      'PUT /sources/{id}': 'src/controllers/sources.update',
      'DELETE /sources/{id}': 'src/controllers/sources.destroy',

      // Destinations
      'GET /destinations': 'src/controllers/destinations.list',
      'POST /destinations': 'src/controllers/destinations.create',
      'GET /destinations/{id}': 'src/controllers/destinations.get',
      'PUT /destinations/{id}': 'src/controllers/destinations.update',
      'DELETE /destinations/{id}': 'src/controllers/destinations.destroy',

      // Connections
      'GET /connections': 'src/controllers/connections.list',
      'POST /connections': 'src/controllers/connections.create',
      'GET /connections/{id}': 'src/controllers/connections.get',
      'PUT /connections/{id}': 'src/controllers/connections.update',
      'DELETE /connections/{id}': 'src/controllers/connections.destroy',

      // Jobs
      'GET /jobs': 'src/controllers/jobs.list',
    },
  });

  const table = new Table(stack, 'Table', {
    cdk: {
      table: {
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        timeToLiveAttribute: 'ttl',
      },
    },
    primaryIndex: {
      partitionKey: 'pk',
      sortKey: 'sk',
    },
    fields: {
      pk: 'string',
      sk: 'string',
      ttl: 'number',
      type: 'string',
    },
  });

  api.attachPermissions([table]);

  // TODO(ptr): state machine should talk to API
  new Worker(stack, 'Worker', {
    table: table.cdk.table,
  });

  // Show the endpoint in the output
  stack.addOutputs({
    ApiEndpoint: api.url,
    DynamoDbTableName: table.tableName,
  });
}
