import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const inputSchema = z.object({
  sourceId: z.string(),
  destinationId: z.string(),
  schedule: z.string(),
});

const recordSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  type: z.literal('connection'),
  id: z.string(),
  sourceId: z.string(),
  destinationId: z.string(),
  schedule: z.string(),
  currentJobId: z.string().optional(),
  executionArn: z.string().optional(),
  lastRanAt: z.number().optional(),
  createdAt: z.number(),
});

type CreateConnectionInput = z.infer<typeof inputSchema>;
type UpdateConnectionInput = Pick<CreateConnectionInput, 'schedule'>;

export interface Connection {
  type: 'connection';
  id: string;
  sourceId: string;
  destinationId: string;
  schedule: string;
  currentJobId: string | null;
  executionArn: string | null;
  lastRanAt?: Date;
  createdAt: Date;
}

interface Options {
  client: DynamoDBDocumentClient;
  tableName: string;
}

function format(item: unknown): Connection {
  const {
    type,
    id,
    sourceId,
    destinationId,
    schedule,
    currentJobId,
    executionArn,
    createdAt,
    lastRanAt,
  } = recordSchema.parse(item);

  return {
    type,
    id,
    sourceId,
    destinationId,
    schedule,
    currentJobId: currentJobId ?? null,
    executionArn: executionArn ?? null,
    lastRanAt: lastRanAt ? new Date(lastRanAt) : undefined,
    createdAt: new Date(createdAt),
  };
}

export class ConnectionStore {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor(private options: Options) {
    this.client = options.client;
    this.tableName = options.tableName;
  }

  async get(id: string): Promise<Connection | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `connection#${id}`, sk: `metadata#${id}` },
      })
    );

    if (!result.Item) {
      return null;
    }

    return format(result.Item);
  }

  async getAll(): Promise<Connection[]> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: {
          ':type': 'connection',
        },
      })
    );

    return result.Items?.map(format) ?? [];
  }

  async create(input: CreateConnectionInput): Promise<Connection> {
    const id = uuidv4();
    const now = Date.now();
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `connection#${id}`,
          sk: `metadata#${id}`,
          type: 'connection',
          id,
          sourceId: input.sourceId,
          destinationId: input.destinationId,
          schedule: input.schedule,
          createdAt: now,
        },
      })
    );

    return {
      type: 'connection',
      id,
      sourceId: input.sourceId,
      destinationId: input.destinationId,
      schedule: input.schedule,
      currentJobId: null,
      executionArn: null,
      createdAt: new Date(now),
    };
  }

  async update(id: string, input: UpdateConnectionInput): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `connection#${id}`, sk: `metadata#${id}` },
        ConditionExpression: '#id = :id',
        UpdateExpression: 'SET #schedule = :schedule',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#schedule': 'schedule',
        },
        ExpressionAttributeValues: {
          ':id': id,
          ':schedule': input.schedule,
        },
      })
    );
  }

  async reserve(id: string): Promise<string | null> {
    const jobId = uuidv4();
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: `connection#${id}`, sk: `metadata#${id}` },
          ConditionExpression:
            'attribute_exists(pk) AND attribute_not_exists(#currentJobId)',
          UpdateExpression: 'SET #currentJobId = :currentJobId',
          ExpressionAttributeNames: {
            '#currentJobId': 'currentJobId',
          },
          ExpressionAttributeValues: {
            ':currentJobId': jobId,
          },
        })
      );
    } catch (e) {
      // If we get a conditional check failure, that means either the item is
      // missing or it had a `currentJobId` value.
      if (e instanceof ConditionalCheckFailedException) {
        return null;
      } else {
        throw e;
      }
    }

    return jobId;
  }

  async finish(id: string): Promise<boolean> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `connection#${id}`, sk: `metadata#${id}` },
        ConditionExpression: 'attribute_exists(#currentJobId)',
        UpdateExpression: 'REMOVE #currentJobId SET #lastRanAt = :lastRanAt',
        ExpressionAttributeNames: {
          '#currentJobId': 'currentJobId',
          '#lastRanAt': 'lastRanAt',
        },
        ExpressionAttributeValues: {
          ':lastRanAt': Date.now(),
        },
      })
    );

    return true;
  }

  async abort(id: string): Promise<boolean> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `connection#${id}`, sk: `metadata#${id}` },
        ConditionExpression: 'attribute_exists(#currentJobId)',
        UpdateExpression: 'REMOVE #currentJobId',
        ExpressionAttributeNames: {
          '#currentJobId': 'currentJobId',
        },
      })
    );

    return true;
  }

  async setExecutionArn(id: string, arn: string): Promise<void> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: `connection#${id}`, sk: `metadata#${id}` },
          ConditionExpression: 'attribute_exists(pk)',
          UpdateExpression: 'SET #executionArn = :executionArn',
          ExpressionAttributeNames: {
            '#executionArn': 'executionArn',
          },
          ExpressionAttributeValues: {
            ':executionArn': arn,
          },
        })
      );
    } catch (e) {
      // If we get a conditional check failure, that means the item is missing
      if (e instanceof ConditionalCheckFailedException) {
        throw new Error(
          `Can't set execution ARN for missing connection with ID '${id}'`
        );
      } else {
        throw e;
      }
    }
  }

  async delete(id: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: `connection#${id}`, sk: `metadata#${id}` },
      })
    );
  }
}
