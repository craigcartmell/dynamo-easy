import * as DynamoDB from 'aws-sdk/clients/dynamodb'
import { randomExponentialBackoffTimer } from '../../helper/random-exponential-backoff-timer.generator'
import { createToKeyFn, toDb } from '../../mapper/mapper'
import { ModelConstructor } from '../../model/model-constructor'
import { DynamoDbWrapper } from '../dynamo-db-wrapper'
import { getTableName } from '../get-table-name.function'
import { batchWriteItemsWriteAll } from './batch-write-utils'
import { BATCH_WRITE_DEFAULT_TIME_SLOT, BATCH_WRITE_MAX_REQUEST_ITEM_COUNT } from './batch-write.const'

export class BatchWriteRequest {
  readonly params: DynamoDB.BatchWriteItemInput
  private readonly dynamoDBWrapper: DynamoDbWrapper
  private itemCount = 0

  constructor() {
    this.dynamoDBWrapper = new DynamoDbWrapper()
    this.params = {
      RequestItems: {},
    }
  }

  returnConsumedCapacity(value: DynamoDB.ReturnConsumedCapacity): BatchWriteRequest {
    this.params.ReturnConsumedCapacity = value
    return this
  }

  returnItemCollectionMetrics(value: DynamoDB.ReturnItemCollectionMetrics): BatchWriteRequest {
    this.params.ReturnItemCollectionMetrics = value
    return this
  }

  delete<T>(modelClazz: ModelConstructor<T>, items: Array<Partial<T>>): BatchWriteRequest {
    this.requestItems(modelClazz, items.map(this.createDeleteRequest(modelClazz)))
    return this
  }

  put<T>(modelClazz: ModelConstructor<T>, items: T[]): BatchWriteRequest {
    this.requestItems(modelClazz, items.map(this.createPutRequest(modelClazz)))
    return this
  }

  /**
   *
   * @param backoffTimer generator for how much timeSlots should be waited before requesting next batch. only used when capacity was exceeded. default randomExponentialBackoffTimer
   * @param throttleTimeSlot defines how long one timeSlot is for throttling, default 1 second
   */
  exec(
    backoffTimer = randomExponentialBackoffTimer,
    throttleTimeSlot = BATCH_WRITE_DEFAULT_TIME_SLOT,
  ): Promise<void> {
    return this.write(backoffTimer, throttleTimeSlot)
      .then(() => { return })
  }

  execFullResponse(
    backoffTimer = randomExponentialBackoffTimer,
    throttleTimeSlot = BATCH_WRITE_DEFAULT_TIME_SLOT,
  ): Promise<DynamoDB.BatchWriteItemOutput> {
    return this.write(backoffTimer, throttleTimeSlot)
  }

  private requestItems(modelClazz: ModelConstructor<any>, items: DynamoDB.WriteRequests) {
    if (this.itemCount + items.length > BATCH_WRITE_MAX_REQUEST_ITEM_COUNT) {
      throw new Error(`batch write takes at max ${BATCH_WRITE_MAX_REQUEST_ITEM_COUNT} items`)
    }
    const tableName = getTableName(modelClazz)
    this.params.RequestItems[tableName] = this.params.RequestItems[tableName] || []
    this.params.RequestItems[tableName].push(...items)
    this.itemCount += items.length
  }

  private write(backoffTimer: () => IterableIterator<number>, throttleTimeSlot: number) {
    return batchWriteItemsWriteAll(this.dynamoDBWrapper, { ...this.params }, backoffTimer(), throttleTimeSlot)
  }

  private createDeleteRequest = <T>(modelClazz: ModelConstructor<T>) => {
    const toKey = createToKeyFn(modelClazz)
    return (item: Partial<T>): DynamoDB.WriteRequest => ({ DeleteRequest: { Key: toKey(item) } })
  }

  private createPutRequest = <T>(modelClazz: ModelConstructor<T>) => {
    return (item: T): DynamoDB.WriteRequest => ({ PutRequest: { Item: toDb(item, modelClazz) } })
  }
}
