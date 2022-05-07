import { SQSHandler } from 'aws-lambda';

export const main: SQSHandler = async (event) => {
  for (const record of event.Records) {
    //console.log('Received record:', record);
  }
};
