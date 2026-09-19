import type { PairingSocketEvent } from './types';
export type SessionStatus = {
  stateSequence: number;
  measurementId: string | null;
  measuringSessionActive: boolean;
  goodPostureRegistrationActive: boolean;
  lastSocketEvent: PairingSocketEvent | null;
};
export function applySessionEvent<T extends SessionStatus>(current: T, event: PairingSocketEvent): T {
  // Reliable history replay is data delivery, never a fresh live-state snapshot.
  if (event.type === 'measurement_completed' || event.type === 'acquired_character') {
    if (event.type === 'measurement_completed' && event.result?.id === current.measurementId && event.sequence >= current.stateSequence) {
      return { ...current, measuringSessionActive: false, stateSequence: event.sequence };
    }
    return current;
  }
  if (event.sequence < current.stateSequence) return current;
  // An old stop must not stop another measurement, even if retransmitted later.
  if (event.type === 'measuring_stopped' && event.measurementId && current.measurementId && event.measurementId !== current.measurementId) return current;
  let measuring = current.measuringSessionActive;
  let registering = current.goodPostureRegistrationActive;
  if (typeof event.measuringSessionActive === 'boolean') measuring = event.measuringSessionActive;
  else if (event.type === 'measuring_started') measuring = true;
  else if (event.type === 'measuring_stopped') measuring = false;
  if (typeof event.goodPostureRegistrationActive === 'boolean') registering = event.goodPostureRegistrationActive;
  else if (event.type === 'good_posture_registration_started') registering = true;
  else if (event.type === 'good_posture_registration_stopped') registering = false;
  return { ...current, stateSequence: event.sequence, measurementId: event.measurementId === undefined ? current.measurementId : event.measurementId,
    measuringSessionActive: measuring, goodPostureRegistrationActive: measuring ? false : registering, lastSocketEvent: event };
}
