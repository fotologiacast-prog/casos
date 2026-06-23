import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("o detalhe do material cobre todo o viewport sem revelar a grade", async () => {
  const source = await readFile(new URL("./ReadyTestimonials.tsx", import.meta.url), "utf8");

  assert.match(source, /className="fixed inset-0 z-\[90\]/);
  assert.doesNotMatch(source, /top-\[73px\]/);
});
