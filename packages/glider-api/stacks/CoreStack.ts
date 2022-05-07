import * as sst from '@serverless-stack/resources';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';

import { Worker } from '../constructs/Worker';

export default class CoreStack extends sst.Stack {
  constructor(scope: sst.App, id: string, props?: sst.StackProps) {
    super(scope, id, props);

    // Create a HTTP API
    const api = new sst.Api(this, 'Api', {
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

    const table = new sst.Table(this, 'Table', {
      dynamodbTable: {
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        timeToLiveAttribute: 'ttl',
      },
      primaryIndex: {
        partitionKey: 'pk',
        sortKey: 'sk',
      },
      fields: {
        pk: sst.TableFieldType.STRING,
        sk: sst.TableFieldType.STRING,
        ttl: sst.TableFieldType.NUMBER,
        type: sst.TableFieldType.STRING,
      },
    });

    const queue = new sst.Queue(this, 'ExtractQueue', {
      consumer: 'src/extract.main',
    });

    api.attachPermissions([table, queue]);

    // FIXME(ptr): this construct isn't fully implemented
    // new Worker(this, 'Worker');

    // Show the endpoint in the output
    this.addOutputs({
      ApiEndpoint: api.url,
      DynamoDbTableName: table.tableName,
      ExtractQueueEndpoint: queue.sqsQueue.queueUrl,
    });
  }
}
