import type {
  DisconnectResponse,
  ErrorResponse,
  HealthResponse,
  PairResponse,
  PairingInfo,
} from "./types";
import {
  buildDisconnectEndpoint,
  buildPairEndpoint,
  buildWebSocketEndpoint,
} from "./link-parser";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

function getErrorMessage(payload: ErrorResponse | null, fallback: string) {
  if (!payload) {
    return fallback;
  }

  return `${payload.errorCode}: ${payload.message}`;
}

export async function fetchHealth(pairingInfo: PairingInfo): Promise<HealthResponse> {
  const response = await fetch(
    `http://${pairingInfo.host}:${pairingInfo.port}/health`,
  );

  if (!response.ok) {
    throw new Error("ヘルスチェックに失敗しました");
  }

  return parseJsonResponse<HealthResponse>(response);
}

export async function pairDevice(
  pairingInfo: PairingInfo,
  deviceName: string,
): Promise<PairResponse> {
  const response = await fetch(buildPairEndpoint(pairingInfo, deviceName));

  if (!response.ok) {
    const payload = await parseJsonResponse<ErrorResponse | null>(response).catch(
      () => null,
    );
    throw new Error(getErrorMessage(payload, "接続リクエストに失敗しました"));
  }

  return parseJsonResponse<PairResponse>(response);
}

export function connectPairingSocket(pairingInfo: PairingInfo): WebSocket {
  return new WebSocket(buildWebSocketEndpoint(pairingInfo));
}

export async function disconnectDevice(
  pairingInfo: PairingInfo,
): Promise<DisconnectResponse> {
  const response = await fetch(buildDisconnectEndpoint(pairingInfo));

  if (!response.ok) {
    const payload = await parseJsonResponse<ErrorResponse | null>(response).catch(
      () => null,
    );
    throw new Error(getErrorMessage(payload, "切断リクエストに失敗しました"));
  }

  return parseJsonResponse<DisconnectResponse>(response);
}
