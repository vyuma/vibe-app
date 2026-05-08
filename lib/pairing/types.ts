export type PairingInfo = {
  host: string;
  port: number;
  token: string;
  httpProtocol: "http" | "https";
  wsProtocol: "ws" | "wss";
};

export type PairErrorCode =
  | "INVALID_TOKEN"
  | "MISSING_TOKEN"
  | "MISSING_DEVICE_NAME"
  | "NOT_PAIRED"
  | "INTERNAL_ERROR";

export type PairingSocketEvent = {
  type:
    | "snapshot"
    | "paired"
    | "disconnected"
    | "posture_bad"
    | "posture_good"
    | "acquired_character"
    | "acquired_characters_cleared"
    | "measuring_started"
    | "measuring_stopped";
  sequence: number;
  paired: boolean;
  deviceName: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  /** PC 側フローが measuring のとき true（スナップショットや各種 WS イベントに含まれる） */
  measuringSessionActive?: boolean;
  eventId?: string;
  requiresAck?: boolean;
  payload?: AcquiredCharacterPayload;
};

export type PostureTimelineSegmentPayload = {
  startMs: number;
  endMs: number;
  isGood: boolean;
};

export type CharacterColorPayload = {
  primary: string;
  soft: string;
};

export type AcquiredCharacterPayload = {
  measurementId: string;
  acquiredAt: string;
  characterId: string;
  characterName: string;
  rarity: string;
  activeMeasurementMs?: number;
  goodMs?: number;
  goodRatio?: number;
  /** PC の `AcquiredCharacter.postureTimeline` と同一 */
  postureTimeline?: PostureTimelineSegmentPayload[];
  story?: string;
  portraitSrc?: string;
  personalityTags?: string[];
  characterColor?: CharacterColorPayload;
  toneClass?: string;
};

export type PairResponse = {
  ok: true;
  paired: true;
  deviceName: string;
  pairedAt: string;
};

export type DisconnectResponse = {
  ok: true;
  paired: false;
  disconnectedAt: string;
};

export type ErrorResponse = {
  ok: false;
  errorCode: PairErrorCode;
  message: string;
};
