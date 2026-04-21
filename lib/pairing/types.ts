export type PairingInfo = {
  host: string;
  port: number;
  token: string;
};

export type PairErrorCode =
  | "INVALID_TOKEN"
  | "MISSING_TOKEN"
  | "MISSING_DEVICE_NAME"
  | "NOT_PAIRED"
  | "INTERNAL_ERROR";

export type PairingSocketEvent = {
  type: "snapshot" | "paired" | "disconnected" | "posture_bad" | "posture_good";
  sequence: number;
  paired: boolean;
  deviceName: string | null;
  lastSeenAt: string | null;
  createdAt: string;
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
