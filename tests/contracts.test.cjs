const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const pc = process.env.POSTURE_APP_DIR || path.resolve('../posture-app');
function load(file, mocks = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${js}})`, { filename: file })(name => mocks[name], module, module.exports);
  return module.exports;
}
test('PC/mobile canonical catalog, legacy IDs, and portrait bytes match', () => {
  const mobileIds = load('lib/normalizeCharacterId.ts');
  const desktopIds = load(path.join(pc, 'src/features/characters/characterIds.ts'));
  const mobile = load('lib/characterCatalog.ts', { '@/lib/normalizeCharacterId': mobileIds }).CHARACTER_CATALOG;
  const desktop = load(path.join(pc, 'src/features/characters/characterCatalog.ts')).CHARACTER_CATALOG;
  const shared = ({ id, name, rarity, story, portraitSrc, personalityTags, characterColor }) => ({ id, name, rarity, story, portraitSrc, personalityTags, characterColor });
  assert.deepEqual(mobile.map(shared), desktop.map(shared));
  for (const id of [...mobile.map(c => c.id), 'shin-akao', 'kuro-nyago', 'kuro-anago', 'hat-nyago', 'oto-nyago', 'kiri-nago', 'broccoli']) {
    assert.equal(mobileIds.normalizeCharacterId(id), desktopIds.normalizeCharacterId(id));
  }
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  for (const character of mobile) {
    assert.equal(hash(`assets/characters/${character.id}/portrait.png`), hash(path.join(pc, 'public', character.portraitSrc)), character.id);
  }
});

test('PC journals completion without phone response and can replay after process restart', async () => {
  const values = new Map(); const previous = global.localStorage;
  global.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const calls = [];
  const mocks = { '@tauri-apps/api/core': { invoke: async (command, args) => { calls.push({ command, args }); } } };
  const file = path.join(pc, 'src/features/pairing/services/measurementDelivery.ts');
  try {
    const journal = load(file, mocks);
    const result = { id: 'locked-completion', startedAt: '2026-09-19T00:00:00Z', endedAt: '2026-09-19T00:01:00Z', activeMeasurementMs: 60000, goodMs: 30000, goodRatio: 0.5, rewardQualified: false, acquiredCharacterId: null, postureTimeline: [] };
    journal.saveCompletedMeasurement(result);
    assert.equal(calls.length, 0); // local finish has no network dependency
    const reloaded = load(file, mocks);
    const records = reloaded.readCompletedMeasurements();
    assert.equal(records.length, 1); assert.equal(records[0].id, result.id);
    await reloaded.publishCompletedMeasurement(records[0]);
    assert.equal(calls[0].command, 'emit_completed_measurement');
    assert.equal(reloaded.readCompletedMeasurements().length, 1); // native acceptance does not discard journal
    const setItem = global.localStorage.setItem;
    global.localStorage.setItem = () => { throw new Error('quota'); };
    assert.throws(() => reloaded.saveCompletedMeasurement({ ...result, id: 'retry-after-quota' }), /quota/);
    global.localStorage.setItem = setItem;
    assert.equal(reloaded.readCompletedMeasurements().length, 2); // transient write failure is retried without losing result
  } finally { global.localStorage = previous; }
});
