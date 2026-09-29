export const MONDAY_ITEMS_BATCH_SIZE = 100;

export const fetchMondayItemsInBatches = async <T>(
  itemIds: string[],
  fetchBatch: (itemIds: string[]) => Promise<T[]>,
  batchSize = MONDAY_ITEMS_BATCH_SIZE
) => {
  const batches: string[][] = [];

  for (let index = 0; index < itemIds.length; index += batchSize) {
    batches.push(itemIds.slice(index, index + batchSize));
  }

  const results = await Promise.all(batches.map(batch => fetchBatch(batch)));
  return results.flat();
};
