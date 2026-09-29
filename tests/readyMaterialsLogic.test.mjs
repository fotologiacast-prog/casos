import assert from 'node:assert/strict';

const moduleUrl = new URL('../dist-test/components/cases/readyMaterialsLogic.js', import.meta.url).href;
const {
  buildReadyGalleryItems,
  sortReadyRecommendations,
} = await import(moduleUrl);

const makeAsset = id => ({ id, name: `${id}.jpg`, public_url: `https://example.com/${id}.jpg` });
const makeMaterial = overrides => ({
  id: overrides.id,
  caseId: overrides.caseId || overrides.id,
  patientName: overrides.patientName || overrides.id,
  patientAge: overrides.patientAge ?? null,
  patientGender: overrides.patientGender || null,
  patientProcedure: overrides.patientProcedure || null,
  mondayItemId: 'item',
  subitemId: overrides.id,
  title: overrides.title || overrides.id,
  creativeType: overrides.creativeType || null,
  assets: overrides.assets || [makeAsset(`${overrides.id}-asset`)],
});

{
  const materials = buildReadyGalleryItems([
    makeMaterial({
      id: 'catalog',
      creativeType: 'Fotografia',
      assets: [makeAsset('a'), makeAsset('b'), makeAsset('c')],
    }),
    makeMaterial({
      id: 'reels',
      creativeType: 'Reels',
      assets: [makeAsset('d'), makeAsset('e')],
    }),
  ]);

  assert.equal(materials.length, 3);
  assert.equal(materials[0].id, 'catalog');
  assert.equal(materials[0].isPhotoCatalog, true);
  assert.equal(materials[0].assets.length, 3);
  assert.equal(materials[1].isPhotoCatalog, false);
  assert.equal(materials[2].isPhotoCatalog, false);
}

{
  const current = buildReadyGalleryItems([
    makeMaterial({
      id: 'current',
      patientGender: 'Feminino',
      patientProcedure: 'Facetas / Porcelana, Implantes',
      patientAge: 42,
    }),
  ])[0];
  const candidates = buildReadyGalleryItems([
    makeMaterial({
      id: 'same-gender-procedure',
      patientGender: 'Feminino',
      patientProcedure: 'Facetas / Porcelana',
      patientAge: 60,
    }),
    makeMaterial({
      id: 'other-gender-same-procedure-close-age',
      patientGender: 'Masculino',
      patientProcedure: 'Facetas / Porcelana',
      patientAge: 43,
    }),
    makeMaterial({
      id: 'same-gender-other-procedure',
      patientGender: 'Feminino',
      patientProcedure: 'Orto',
      patientAge: 42,
    }),
    makeMaterial({
      id: 'fallback',
      patientGender: 'Masculino',
      patientProcedure: 'Protocolo',
      patientAge: 42,
    }),
  ]);

  const sorted = sortReadyRecommendations(candidates, current).map(item => item.testimonial.id);
  assert.deepEqual(sorted, [
    'same-gender-procedure',
    'same-gender-other-procedure',
    'other-gender-same-procedure-close-age',
    'fallback',
  ]);
}

console.log('readyMaterialsLogic tests passed');
