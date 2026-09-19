import AsyncStorage from '@react-native-async-storage/async-storage';
import { readMeasurementResults } from './measurement-storage';
import { normalizeCharacterId } from '../normalizeCharacterId';
import type { AcquiredCharacterPayload, CollectionReset } from './types';
export const ACQUIRED_CARDS_STORAGE_KEY = 'PAIRING_ACQUIRED_CARDS_V1';
export const COLLECTION_RESETS_KEY = 'PAIRING_COLLECTION_RESETS_V1';
let pending: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const operation = pending.then(work);
  pending = operation.catch(() => undefined);
  return operation;
}
async function resets(): Promise<CollectionReset[]> {
  const data = JSON.parse(await AsyncStorage.getItem(COLLECTION_RESETS_KEY) || '[]');
  if (!Array.isArray(data)) throw new Error('Invalid collection resets');
  return data;
}
function removed(card: AcquiredCharacterPayload, records: CollectionReset[]): boolean {
  return records.some(reset => (!card.sourceId || reset.sourceId === card.sourceId) && reset.measurementIds.includes(card.measurementId));
}
async function storedCards(): Promise<AcquiredCharacterPayload[]> {
  const data = JSON.parse(await AsyncStorage.getItem(ACQUIRED_CARDS_STORAGE_KEY) || '[]');
  if (!Array.isArray(data)) throw new Error('Saved collection is invalid');
  return data;
}
async function projectCards(records: CollectionReset[], saved: AcquiredCharacterPayload[]): Promise<AcquiredCharacterPayload[]> {
  const results = await readMeasurementResults();
  const all = [...saved, ...results.flatMap(result => result.character ? [{ ...result.character, sourceId: result.sourceId }] : [])];
  const cards = new Map<string, AcquiredCharacterPayload>();
  for (const card of all.filter(card => card && typeof card.measurementId === 'string' && typeof card.characterId === 'string' && typeof card.acquiredAt === 'string' && !removed(card, records)).sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt))) {
    const normalized = { ...card, characterId: normalizeCharacterId(card.characterId) };
    cards.set(normalized.characterId, normalized);
  }
  return [...cards.values()];
}
// Tombstones are durable BEFORE the projection is changed. Interrupted writes are repaired
// by hydration/retry; ACK only follows both writes. IDs are cumulative, so late resets are safe.
export function applyCollectionReset(reset: CollectionReset): Promise<AcquiredCharacterPayload[] | null> {
  return serialized(async () => {
    if (!reset.sourceId || !Array.isArray(reset.measurementIds) || !reset.measurementIds.every(id => typeof id === 'string')) throw new Error('Invalid collection reset');
    const records = await resets();
    const old = records.find(record => record.sourceId === reset.sourceId);
    const merged = { sourceId: reset.sourceId, measurementIds: [...new Set([...(old?.measurementIds ?? []), ...reset.measurementIds])] };
    const changed = !old || merged.measurementIds.length !== old.measurementIds.length;
    const nextResets = [...records.filter(record => record.sourceId !== reset.sourceId), merged];
    if (changed) await AsyncStorage.setItem(COLLECTION_RESETS_KEY, JSON.stringify(nextResets));
    const cards = await storedCards();
    const next = await projectCards(nextResets, cards);
    const projectionChanged = JSON.stringify(cards) !== JSON.stringify(next);
    if (projectionChanged) await AsyncStorage.setItem(ACQUIRED_CARDS_STORAGE_KEY, JSON.stringify(next));
    return changed || projectionChanged ? next : null;
  });
}
// The journal is historical: hydrate rewards through tombstones, never directly from results.
export function readAcquiredCards(): Promise<AcquiredCharacterPayload[]> {
  return serialized(async () => {
    const records = await resets();
    return projectCards(records, await storedCards());
  });
}
export function saveAcquiredCard(payload: AcquiredCharacterPayload): Promise<AcquiredCharacterPayload[]> {
  return serialized(async () => {
    const records = await resets();
    const saved = await storedCards();
    const cards = saved.filter(card => !removed(card, records));
    if (removed(payload, records) || cards.some(card => card.measurementId === payload.measurementId && card.sourceId === payload.sourceId) || cards.some(card => card.characterId === payload.characterId && card.acquiredAt >= payload.acquiredAt)) {
      if (cards.length !== saved.length) await AsyncStorage.setItem(ACQUIRED_CARDS_STORAGE_KEY, JSON.stringify(cards));
      return cards;
    }
    const next = [...cards.filter(card => card.characterId !== payload.characterId), payload];
    await AsyncStorage.setItem(ACQUIRED_CARDS_STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}
