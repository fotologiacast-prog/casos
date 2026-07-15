import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("upload em etapa ainda nao sincronizada nao e ignorado silenciosamente", async () => {
  const detailSource = await readFile(new URL("./CasePatientDetail.tsx", import.meta.url), "utf8");
  const cardSource = await readFile(new URL("./CaseStageCard.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(detailSource, /if \(stage\.id\.startsWith\('missing-'\)\) return;/);
  assert.doesNotMatch(cardSource, /files\.length === 0 \|\| isPlaceholder/);
  assert.match(detailSource, /Upload solicitado antes da etapa existir/);
  assert.match(detailSource, /sincronizada/);
  assert.match(detailSource, /onRefreshPatient\(patient\.id, \{ updateState: false \}\)/);
  assert.doesNotMatch(detailSource, /const refreshedPatient = await onRefreshPatient\(patient\.id\);/);
});
