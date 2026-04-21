import type { PairingInfo } from "./types";

export type PairingLinkParseResult =
  | {
      ok: true;
      pairingInfo: PairingInfo;
    }
  | {
      ok: false;
      reason: string;
    };

export function parsePairingLink(rawLink: string): PairingLinkParseResult {
  const trimmed = rawLink.trim();

  if (!trimmed) {
    return { ok: false, reason: "リンクが空です。" };
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol === "vibeapp:") {
      const host = url.searchParams.get("host");
      const port = url.searchParams.get("port");
      const token = url.searchParams.get("token");

      if (!host || !port || !token) {
        return { ok: false, reason: "ペアリングURLの必須パラメータが不足しています。" };
      }

      const parsedPort = Number.parseInt(port, 10);

      if (Number.isNaN(parsedPort)) {
        return { ok: false, reason: "port の形式が不正です。" };
      }

      return {
        ok: true,
        pairingInfo: {
          host,
          port: parsedPort,
          token,
        },
      };
    }

    if (url.protocol === "http:" || url.protocol === "https:") {
      const token = url.searchParams.get("token");
      const port =
        url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number.parseInt(url.port, 10);

      if (!token) {
        return { ok: false, reason: "token が含まれていません。" };
      }

      if (Number.isNaN(port)) {
        return { ok: false, reason: "port の形式が不正です。" };
      }

      return {
        ok: true,
        pairingInfo: {
          host: url.hostname,
          port,
          token,
        },
      };
    }

    return { ok: false, reason: "サポートされていないURL形式です。" };
  } catch {
    return { ok: false, reason: "URLを解析できませんでした。" };
  }
}

export function buildPairEndpoint(
  pairingInfo: PairingInfo,
  deviceName: string,
): string {
  const params = new URLSearchParams({
    token: pairingInfo.token,
    deviceName,
  });

  return `http://${pairingInfo.host}:${pairingInfo.port}/pair?${params.toString()}`;
}

export function buildDisconnectEndpoint(pairingInfo: PairingInfo): string {
  const params = new URLSearchParams({
    token: pairingInfo.token,
  });

  return `http://${pairingInfo.host}:${pairingInfo.port}/disconnect?${params.toString()}`;
}

export function buildWebSocketEndpoint(pairingInfo: PairingInfo): string {
  const params = new URLSearchParams({
    token: pairingInfo.token,
  });

  return `ws://${pairingInfo.host}:${pairingInfo.port}/ws?${params.toString()}`;
}
