import assert from "node:assert/strict";
import test from "node:test";

import { fetchMondayItemsInBatches } from "./_mondayBatching.ts";

test("busca todos os itens do Monday quando a lista ultrapassa 25 IDs", async () => {
  const itemIds = Array.from({ length: 37 }, (_, index) => String(index + 1));
  const requestedBatches: string[][] = [];

  const items = await fetchMondayItemsInBatches(itemIds, async batch => {
    requestedBatches.push(batch);
    return batch.map(id => ({ id }));
  });

  assert.deepEqual(requestedBatches.map(batch => batch.length), [25, 12]);
  assert.deepEqual(items.map(item => item.id), itemIds);
});
