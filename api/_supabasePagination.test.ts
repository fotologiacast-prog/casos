import assert from "node:assert/strict";
import test from "node:test";
import { fetchAllSupabaseRows, SUPABASE_PAGE_SIZE } from "./_supabasePagination.ts";

test("fetchAllSupabaseRows pagina ate a ultima pagina parcial", async () => {
  const calls: Array<[number, number]> = [];
  const pages = [
    Array.from({ length: SUPABASE_PAGE_SIZE }, (_, index) => ({ id: index })),
    Array.from({ length: 37 }, (_, index) => ({ id: SUPABASE_PAGE_SIZE + index })),
  ];

  const rows = await fetchAllSupabaseRows(() => ({
    range: async (from: number, to: number) => {
      calls.push([from, to]);
      return { data: pages[calls.length - 1] || [], error: null };
    },
  }));

  assert.equal(rows.length, SUPABASE_PAGE_SIZE + 37);
  assert.deepEqual(calls, [
    [0, SUPABASE_PAGE_SIZE - 1],
    [SUPABASE_PAGE_SIZE, SUPABASE_PAGE_SIZE * 2 - 1],
  ]);
});

test("fetchAllSupabaseRows propaga erro do Supabase", async () => {
  await assert.rejects(
    () => fetchAllSupabaseRows(() => ({
      range: async () => ({ data: null, error: { message: "boom" } }),
    })),
    /boom/
  );
});
