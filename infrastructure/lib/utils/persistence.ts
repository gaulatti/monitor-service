import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * Create a new DynamoDB client.
 */
const dynamoClient = new DynamoDBClient({});

/**
 * Retrieves the last processed value by account ID from the DynamoDB table.
 * If the record does not exist, it creates a new one with a default value of '0'.
 *
 * @param {string} accountId - The ID of the account to retrieve the last processed value for.
 * @returns {Promise<string>} - A promise that resolves to the last processed value as a string.
 */
const getLastProcessedById = async (accountId: string): Promise<string> => {
  const getCommand = new GetItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: marshall({ account: accountId }),
  });

  const { Item } = await dynamoClient.send(getCommand);

  /**
   * If the record does not exist, create a new one with a default value of '0'.
   */
  if (!Item) {
    const defaultValue = '0';
    await writeRecord(accountId, defaultValue);
    return defaultValue;
  }

  /**
   * Unmarshall the record and return the value attribute.
   */
  const unmarshalled = unmarshall(Item);
  return unmarshalled.value || '0';
};

/**
 * Writes a record to the DynamoDB table specified by the TABLE_NAME environment variable.
 *
 * @param accountId - The ID of the account to associate with the record.
 * @param value - The value to store in the record.
 * @returns A promise that resolves when the record has been written.
 */
const writeRecord = async (accountId: string, value: string): Promise<void> => {
  const putCommand = new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: marshall({
      account: accountId,
      value,
    }),
  });

  await dynamoClient.send(putCommand);
};

export { getLastProcessedById, writeRecord };
