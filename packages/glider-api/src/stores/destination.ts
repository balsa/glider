import type { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const inputSchema = z.object({
  provider: z.string(),
  credentials: z.object({}).passthrough(),
  properties: z.object({}).passthrough(),
});

const recordSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  type: z.literal('destination'),
  id: z.string(),
  provider: z.string(),
  credentials: z.object({}).passthrough(),
  options: z.object({}).passthrough(),
  createdAt: z.number(),
});

type CreatedestinationInput = z.infer<typeof inputSchema>;
type UpdatedestinationInput = Omit<CreateDestinationInput, 'provider'>;

interface destination {
  type: 'destination';
  id: string;
  provider: string;
  credentials: unknown;
  properties: unknown;
  createdAt: Date;
}

interface Options {
  client: DynamoDB.DocumentClient;
  tableName: string;
}

function format(item: unknown): destination {
  const { type, id, provider, credentials, properties, createdAt } =
    recordSchema.parse(item);

  return {
    type,
    id,
    provider,
    credentials,
    properties,
    createdAt: new Date(createdAt),
  };
}

export class destinationStore {
  private client: DynamoDB.DocumentClient;
  private tableName: string;

  constructor(private options: Options) {
    this.client = options.client;
    this.tableName = options.tableName;
  }

  async get(id: string): Promise<destination | null> {
    const result = await this.client
      .get({
        TableName: this.tableName,
        Key: { pk: `destination#${id}`, sk: `metadata#${id}` },
      })
      .promise();

    if (!result.Item) {
      return null;
    }

    return format(result.Item);
  }

  async getAll(): Promise<destination[]> {
    const result = await this.client
      .scan({
        TableName: this.tableName,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: {
          ':type': 'destination',
        },
      })
      .promise();

    return result.Items?.map(format) ?? [];
  }

  async create(input: CreatedestinationInput): Promise<Destination> {
    const id = uuidv4();
    const now = Date.now();
    await this.client
      .put({
        TableName: this.tableName,
        Item: {
          pk: `destination#${id}`,
          sk: `metadata#${id}`,
          type: 'destination',
          id,
          provider: input.provider,
          credentials: input.credentials,
          properties: input.properties,
          createdAt: now,
        },
      })
      .promise();

    return {
      type: 'destination',
      id,
      provider: input.provider,
      credentials: input.credentials,
      properties: input.properties,
      createdAt: new Date(now),
    };
  }

  async update(id: string, input: UpdatedestinationInput): Promise<void> {
    await this.client
      .update({
        TableName: this.tableName,
        Key: { pk: `destination#${id}`, sk: `metadata#${id}` },
        ConditionExpression: '#id = :id',
        UpdateExpression:
          'SET #credentials = :credentials, #properties = :properties',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#credentials': 'credentials',
          '#properties': 'properties',
        },
        ExpressionAttributeValues: {
          ':id': id,
          ':credentials': input.credentials,
          ':properties': input.properties,
        },
      })
      .promise();
  }

  async delete(id: string): Promise<void> {
    await this.client
      .delete({
        TableName: this.tableName,
        Key: { pk: `destination#${id}`, sk: `metadata#${id}` },
      })
      .promise();
  }
}
