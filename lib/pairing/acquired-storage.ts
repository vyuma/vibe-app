import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AcquiredCharacterPayload } from './types';
export const ACQUIRED_CARDS_STORAGE_KEY = 'PAIRING_ACQUIRED_CARDS_V1';
let pending: Promise<unknown> = Promise.resolve();
// Serialize read/modify/write across rapid deliveries and retries. ACK only after this resolves.
export function saveAcquiredCard(payload: AcquiredCharacterPayload): Promise<AcquiredCharacterPayload[]> {
  const operation = pending.then(async () => {
    const raw = await AsyncStorage.getItem(ACQUIRED_CARDS_STORAGE_KEY);
    const cards: AcquiredCharacterPayload[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(cards)) throw new Error('Saved collection is invalid');
    if (cards.some(card => card.measurementId === payload.measurementId)) return cards;
    if (cards.some(card => card.characterId === payload.characterId && card.acquiredAt >= payload.acquiredAt)) return cards;
    const next = [...cards.filter(card => card.characterId !== payload.characterId), payload];
    await AsyncStorage.setItem(ACQUIRED_CARDS_STORAGE_KEY, JSON.stringify(next));
    return next;
  });
  pending = operation.catch(() => undefined);
  return operation;
}
