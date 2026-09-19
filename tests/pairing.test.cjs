const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, cache = {}) {
  const full = path.resolve(file);
  if (cache[full]) return cache[full].exports;
  const mod = { exports: {} }; cache[full] = mod;
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = name => {
    if (name in mocks) return mocks[name];
    const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(full), name);
    return load(base + '.ts', mocks, cache);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: full })(req, mod, mod.exports);
  return mod.exports;
}
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
test('pairing intent routes cold and warm launches; invalid port rejected', () => {
  const { redirectSystemPath } = load('app/+native-intent.tsx');
  const { parsePairingLink } = load('lib/pairing/link-parser.ts');
  const link = 'vibeapp://pair?host=192.168.1.2&port=4321&token=test';
  for (const initial of [true, false]) {
    const route = new URL(redirectSystemPath({ path: link, initial }), 'http://app');
    assert.equal(route.pathname, '/pairing-test');
    assert.equal(parsePairingLink(route.searchParams.get('pairingLink')).ok, true);
  }
  assert.equal(parsePairingLink(link.replace('4321', '0')).ok, false);
  assert.equal(parsePairingLink(link.replace('4321', '4321oops')).ok, false);
});
test('receipt is ACKed only after durable save; retries deduplicate; storage failure stays unacked', async () => {
  let saved = null, release, fail = false;
  const storage = {
    getItem: async key => key === "PAIRING_ACQUIRED_CARDS_V1" ? saved : null,
    setItem: async (_key, value) => { if (fail) throw Error('disk full'); await new Promise(r => { release = r; }); saved = value; },
  };
  let socket;
  class Socket {
    static OPEN = 1; static CONNECTING = 0;
    readyState = 1; sent = [];
    constructor() { socket = this; }
    send(text) { this.sent.push(JSON.parse(text)); }
    close() { this.readyState = 3; }
  }
  const originalSocket = global.WebSocket; global.WebSocket = Socket;
  const mocks = {
    '@react-native-async-storage/async-storage': storage,
    react: { useRef: current => ({ current }), useEffect: () => {}, useState: initial => { let state = initial; return [state, update => { state = typeof update === 'function' ? update(state) : update; }]; } },
    'react-native': { AppState: {} },
    '@/lib/pairing/client': { pairDevice: async () => ({ ok: true, paired: true }), connectPairingSocket: () => new Socket(), disconnectDevice: async () => ({ ok: true }) },
  };
  const { usePairingSession } = load('hooks/usePairingSession.ts', mocks);
  const session = usePairingSession();
  try {
    await session.startPairing({ host: '192.168.1.2', port: 1234, token: 'test', httpProtocol: 'http', wsProtocol: 'ws' });
    session.startSocket();
    const payload = { measurementId: 'm1', characterId: 'normal-nago', characterName: 'test', rarity: 'common', acquiredAt: '2026-09-19' };
    const event = { type: 'acquired_character', eventId: 'evt1', sequence: 1, requiresAck: true, payload };
    socket.onmessage({ data: JSON.stringify(event) }); await settle();
    assert.equal(socket.sent.length, 0);
    release(); await settle();
    assert.equal(socket.sent[0].type, 'ack_event');
    assert.equal(socket.sent[0].status, 'stored');
    socket.onmessage({ data: JSON.stringify(event) }); await settle();
    assert.equal(socket.sent.length, 2); assert.equal(JSON.parse(saved).length, 1);
    fail = true;
    socket.onmessage({ data: JSON.stringify({ ...event, eventId: 'evt2', sequence: 2, payload: { ...payload, measurementId: 'm2', acquiredAt: '2026-09-20' } }) }); await settle();
    assert.equal(socket.sent.length, 2); assert.equal(JSON.parse(saved)[0].measurementId, 'm1');
  } finally { session.stopSocket(); global.WebSocket = originalSocket; }
});

test('foreground snapshot exits measuring screen; old stop/result cannot stop new measurement', () => {
  const { applySessionEvent } = load('lib/pairing/session-state.ts');
  const base = { stateSequence: -1, measurementId: null, measuringSessionActive: false, goodPostureRegistrationActive: false, lastSocketEvent: null };
  const started = applySessionEvent(base, { type: 'measuring_started', sequence: 10, measurementId: 'A', measuringSessionActive: true });
  assert.equal(started.measuringSessionActive, true);
  const resumed = applySessionEvent(started, { type: 'snapshot', sequence: 15, measurementId: 'A', measuringSessionActive: false });
  assert.equal(resumed.measuringSessionActive, false);
  const next = applySessionEvent(resumed, { type: 'measuring_started', sequence: 20, measurementId: 'B', measuringSessionActive: true });
  assert.equal(applySessionEvent(next, { type: 'measuring_stopped', sequence: 12, measurementId: 'A' }).measuringSessionActive, true);
  assert.equal(applySessionEvent(next, { type: 'measuring_stopped', sequence: 30, measurementId: 'A' }).measuringSessionActive, true);
  assert.equal(applySessionEvent(next, { type: 'measurement_completed', sequence: 30, result: { id: 'A' }, measuringSessionActive: false }).measuringSessionActive, true);
  assert.equal(applySessionEvent(next, { type: 'measurement_completed', sequence: 21, result: { id: 'B' } }).measuringSessionActive, false);
});

test('completed results survive reload without a reward and preserve source identity', async () => {
  const values = new Map();
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value) };
  const mocks = { '@react-native-async-storage/async-storage': storage };
  const store = load('lib/pairing/measurement-storage.ts', mocks);
  const result = { id: 'A', sourceId: 'pc1', endedAt: '2026-09-19T00:00:00Z', rewardQualified: false, character: null };
  await Promise.all([store.saveMeasurementResult(result), store.saveMeasurementResult(result)]);
  await store.saveMeasurementResult({ ...result, sourceId: 'pc2' });
  const reloaded = load('lib/pairing/measurement-storage.ts', mocks);
  assert.equal((await reloaded.readMeasurementResults()).length, 2);
});

test('completed result ACK waits for both result journal and character projection storage', async () => {
  const values = new Map(); const writes = [];
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => new Promise(resolve => writes.push(() => { values.set(key, value); resolve(); })) };
  let socket;
  class Socket {
    static OPEN = 1; static CONNECTING = 0; readyState = 1; sent = [];
    constructor() { socket = this; }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; }
  }
  const previous = global.WebSocket; global.WebSocket = Socket;
  const mocks = {
    '@react-native-async-storage/async-storage': storage,
    react: { useRef: current => ({ current }), useEffect: () => {}, useState: initial => { let state = initial; return [state, update => { state = typeof update === 'function' ? update(state) : update; }]; } },
    'react-native': { AppState: {} },
    '@/lib/pairing/client': { pairDevice: async () => ({ ok: true, paired: true }), connectPairingSocket: () => new Socket() },
  };
  const session = load('hooks/usePairingSession.ts', mocks).usePairingSession();
  try {
    await session.startPairing({ host: '192.168.1.2', port: 1234, token: 'test', httpProtocol: 'http', wsProtocol: 'ws' });
    session.startSocket();
    const character = { measurementId: 'A', characterId: 'normal-nago', acquiredAt: '2026-09-19T00:01:00Z', characterName: 'test', rarity: 'common' };
    const result = { id: 'A', sourceId: 'pc1', endedAt: character.acquiredAt, character };
    socket.onmessage({ data: JSON.stringify({ type: 'measurement_completed', eventId: 'r1', sequence: 5, result, payload: character, requiresAck: true }) });
    await settle(); assert.equal(socket.sent.length, 0);
    writes.shift()(); await settle(); assert.equal(socket.sent.length, 0);
    writes.shift()(); await settle(); assert.equal(socket.sent.length, 1);
    assert.equal(socket.sent[0].status, 'stored'); assert.equal(values.size, 2);
  } finally { session.stopSocket(); global.WebSocket = previous; }
});

test('reset survives reload and suppresses replay without deleting history or another PC; newer rewards survive stale resets', async () => {
  const values = new Map();
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value) };
  const mocks = { '@react-native-async-storage/async-storage': storage };
  let cards = load('lib/pairing/acquired-storage.ts', mocks);
  const history = load('lib/pairing/measurement-storage.ts', mocks);
  const old = { measurementId: 'old', sourceId: 'pc1', characterId: 'normal-nago', acquiredAt: '2026-09-19T00:00:00Z' };
  await cards.saveAcquiredCard(old);
  await history.saveMeasurementResult({ id: 'old', sourceId: 'pc1', character: old });
  await cards.saveAcquiredCard({ ...old, sourceId: 'pc2', characterId: 'aka-nago' });
  await cards.applyCollectionReset({ sourceId: 'pc1', measurementIds: ['old'] });
  cards = load('lib/pairing/acquired-storage.ts', mocks); // app restart
  assert.deepEqual((await cards.readAcquiredCards()).map(c => c.sourceId), ['pc2']);
  await cards.saveAcquiredCard(old); // in-flight / offline result replay
  assert.equal((await cards.readAcquiredCards()).length, 1);
  const newer = { ...old, measurementId: 'new', acquiredAt: '2026-09-19T00:02:00Z' };
  await cards.saveAcquiredCard(newer);
  await cards.applyCollectionReset({ sourceId: 'pc1', measurementIds: ['old'] });
  assert.equal((await cards.readAcquiredCards()).length, 2);
  await cards.applyCollectionReset({ sourceId: 'pc1', measurementIds: ['new'] }); // merge, never replace tombstones
  await cards.applyCollectionReset({ sourceId: 'pc1', measurementIds: ['old'] });
  await cards.saveAcquiredCard(newer);
  assert.equal((await cards.readAcquiredCards()).length, 1);
  assert.equal((await history.readMeasurementResults()).length, 1);
});

test('reset ACK waits for tombstone and projection, repairs partial failure on retry and closes the card dispatch', async () => {
  const old = { measurementId: 'old', characterId: 'normal-nago', acquiredAt: '2026-09-19' };
  const values = new Map([['PAIRING_ACQUIRED_CARDS_V1', JSON.stringify([old])]]);
  const writes = []; let failProjection = true, socket, state;
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => {
    if (key === 'PAIRING_ACQUIRED_CARDS_V1' && failProjection) throw Error('disk full');
    await new Promise(resolve => writes.push(() => { values.set(key, value); resolve(); }));
  } };
  class Socket { static OPEN = 1; static CONNECTING = 0; readyState = 1; sent = [];
    constructor() { socket = this; } send(value) { this.sent.push(JSON.parse(value)); } close() { this.readyState = 3; } }
  const previous = global.WebSocket; global.WebSocket = Socket;
  const mocks = { '@react-native-async-storage/async-storage': storage,
    react: { useRef: current => ({ current }), useEffect: () => {}, useState: initial => { state = initial; return [state, update => { state = typeof update === 'function' ? update(state) : update; }]; } },
    'react-native': { AppState: {} },
    '@/lib/pairing/client': { pairDevice: async () => ({ ok: true, paired: true }), connectPairingSocket: () => new Socket() } };
  const session = load('hooks/usePairingSession.ts', mocks).usePairingSession();
  try {
    await session.startPairing({ host: '192.168.1.2', port: 1234, token: 'test' }); session.startSocket();
    const reset = { type: 'collection_reset', sequence: 10, eventId: 'reset1', requiresAck: true, collectionReset: { sourceId: 'pc1', measurementIds: ['old'] } };
    socket.onmessage({ data: JSON.stringify(reset) }); await settle();
    assert.equal(socket.sent.length, 0); writes.shift()(); await settle();
    assert.equal(socket.sent.length, 0); assert(state.error); // marker stored; cards write failed
    failProjection = false;
    socket.onmessage({ data: JSON.stringify(reset) }); await settle();
    assert.equal(socket.sent.length, 0); writes.shift()(); await settle();
    assert.equal(socket.sent[0].status, 'stored');
    assert.deepEqual(state.lastAcquiredDispatch.cards, []); assert.equal(state.lastAcquiredDispatch.payload, null);
    socket.onmessage({ data: JSON.stringify({ type: 'snapshot', sequence: 11, collectionReset: reset.collectionReset }) }); await settle();
    assert.deepEqual(state.lastAcquiredDispatch.cards, []);
  } finally { session.stopSocket(); global.WebSocket = previous; }
});

test('cold reconnect snapshot alone applies a missed reset and retains another PC reward of the same character', async () => {
  const values = new Map();
  const mocks = { '@react-native-async-storage/async-storage': { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value) } };
  const history = load('lib/pairing/measurement-storage.ts', mocks);
  const cards = load('lib/pairing/acquired-storage.ts', mocks);
  const old = { measurementId: 'pc1-old', sourceId: 'pc1', characterId: 'normal-nago', acquiredAt: '2026-09-19' };
  const other = { ...old, measurementId: 'pc2-old', sourceId: 'pc2', acquiredAt: '2026-09-18' };
  await history.saveMeasurementResult({ id: old.measurementId, sourceId: old.sourceId, character: old });
  await history.saveMeasurementResult({ id: other.measurementId, sourceId: other.sourceId, character: other });
  await cards.saveAcquiredCard(old);
  let socket, state;
  class Socket { static OPEN = 1; static CONNECTING = 0; readyState = 1;
    constructor() { socket = this; } send() {} close() { this.readyState = 3; } }
  const previous = global.WebSocket; global.WebSocket = Socket;
  const session = load('hooks/usePairingSession.ts', { ...mocks,
    react: { useRef: current => ({ current }), useEffect: () => {}, useState: initial => { state = initial; return [state, update => { state = typeof update === 'function' ? update(state) : update; }]; } },
    'react-native': { AppState: {} },
    '@/lib/pairing/client': { pairDevice: async () => ({ ok: true, paired: true }), connectPairingSocket: () => new Socket() } }).usePairingSession();
  try {
    await session.startPairing({ host: '192.168.1.2', port: 1234, token: 'test' }); session.startSocket();
    socket.onmessage({ data: JSON.stringify({ type: 'snapshot', sequence: 1, measurementId: 'new', measuringSessionActive: true, collectionReset: { sourceId: 'pc1', measurementIds: ['pc1-old'] } }) });
    await settle();
    assert.equal(state.measuringSessionActive, true);
    assert.deepEqual(state.lastAcquiredDispatch.cards.map(c => c.sourceId), ['pc2']);
    assert.deepEqual((await load('lib/pairing/acquired-storage.ts', mocks).readAcquiredCards()).map(c => c.sourceId), ['pc2']);
  } finally { session.stopSocket(); global.WebSocket = previous; }
});
