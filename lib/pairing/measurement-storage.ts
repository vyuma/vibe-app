import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompletedMeasurement } from './types';

export const MEASUREMENT_RESULTS_KEY = 'PAIRING_MEASUREMENT_RESULTS_V1';
let pending: Promise<unknown> = Promise.resolve();
export async function readMeasurementResults(): Promise<CompletedMeasurement[]> {
  const data = JSON.parse(await AsyncStorage.getItem(MEASUREMENT_RESULTS_KEY) || '[]');
  if (!Array.isArray(data)) throw new Error('Invalid saved measurement results');
  return data;
}
// Store the result AND its character in one durable record before ACK.
// Keep provenance; do not replace another PC's records or erase legacy cards.
export function saveMeasurementResult(result: CompletedMeasurement): Promise<void> {
  const operation = pending.then(async () => {
    const records = await readMeasurementResults();
    if (records.some(record => record.id === result.id && record.sourceId === result.sourceId)) return;
    await AsyncStorage.setItem(MEASUREMENT_RESULTS_KEY, JSON.stringify([...records, result]));
  });
  pending = operation.catch(() => undefined);
  return operation;
}
