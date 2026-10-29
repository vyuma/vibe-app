const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const additions = require('../lib/characterAdditions.json');
function load(file, mocks = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${js}})`, { filename: file })(name => mocks[name], module, module.exports);
  return module.exports;
}
const mobile = load('lib/characterCatalog.ts', { './characterAdditions.json': additions, '@/lib/normalizeCharacterId': load('lib/normalizeCharacterId.ts') });
test('sparse slots resolve new IDs, stars and aliases without filling unused numbers', () => {
  for (const character of additions) {
    assert.equal(mobile.getCatalogEntryAtSlotIndex(character.number - 1).id, character.id);
    assert.equal(mobile.getCatalogEntryByCharacterId(character.id).stars, character.stars);
  }
  assert.equal(mobile.getCatalogEntryAtSlotIndex(17), null);
  assert.equal(mobile.getCatalogEntryAtSlotIndex(110), null);
  assert.equal(mobile.getCatalogEntryByCharacterId('kiri-nago').id, 'dot-nago');
});
test('new metadata and image bytes match desktop, and portraits use bundled images', () => {
  const desktop = process.env.POSTURE_APP_DIR || path.resolve('../posture-app');
  assert.deepEqual(additions, JSON.parse(fs.readFileSync(path.join(desktop, 'src/features/characters/characterAdditions.json'))));
  const mocks = { '@/lib/normalizeCharacterId': load('lib/normalizeCharacterId.ts') };
  for (const entry of mobile.CHARACTER_CATALOG) mocks[`../assets/characters/${entry.id}/portrait.png`] = entry.id;
  const { resolveCharacterPortraitSource } = load('lib/resolveCharacterPortrait.ts', mocks);
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  for (const entry of additions) {
    assert.equal(resolveCharacterPortraitSource(entry.id), entry.id);
    assert.equal(hash(`assets/characters/${entry.id}/portrait.png`), hash(path.join(desktop, 'public', entry.portraitSrc)));
  }
});
