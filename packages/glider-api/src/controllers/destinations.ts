import { APIGatewayProxyHandlerV2 as Handler } from 'aws-lambda';
import pino from 'pino-lambda';

const logger = pino();

export const list: Handler = async (event, context) => {
  logger.withRequest(event, context);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  };
};

export const create: Handler = async (event, context) => {
  logger.withRequest(event, context);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  };
};

export const get: Handler = async (event, context) => {
  logger.withRequest(event, context);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  };
};

export const update: Handler = async (event, context) => {
  logger.withRequest(event, context);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  };
};

export const destroy: Handler = async (event, context) => {
  logger.withRequest(event, context);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  };
};
