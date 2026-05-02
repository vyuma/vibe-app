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
      const httpProtocolParam =
        url.searchParams.get("httpProtocol") ?? url.searchParams.get("protocol");
      const wsProtocolParam = url.searchParams.get("wsProtocol");

      if (!host || !port || !token) {
        return { ok: false, reason: "ペアリングURLの必須パラメータが不足しています。" };
      }

      const parsedPort = Number.parseInt(port, 10);

      if (Number.isNaN(parsedPort)) {
        return { ok: false, reason: "port の形式が不正です。" };
      }

      const httpProtocol = parseHttpProtocol(httpProtocolParam);
      if (!httpProtocol) {
        return {
          ok: false,
          reason: "httpProtocol は http または https を指定してください。",
        };
      }

      const wsProtocol = parseWsProtocol(wsProtocolParam) ?? inferWsProtocol(httpProtocol);
      if (wsProtocolParam && !parseWsProtocol(wsProtocolParam)) {
        return {
          ok: false,
          reason: "wsProtocol は ws または wss を指定してください。",
        };
      }

      return {
        ok: true,
        pairingInfo: {
          host,
          port: parsedPort,
          token,
          httpProtocol,
          wsProtocol,
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
          httpProtocol: url.protocol === "https:" ? "https" : "http",
          wsProtocol: url.protocol === "https:" ? "wss" : "ws",
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

  return `${pairingInfo.httpProtocol}://${pairingInfo.host}:${pairingInfo.port}/pair?${params.toString()}`;
}

export function buildDisconnectEndpoint(pairingInfo: PairingInfo): string {
  const params = new URLSearchParams({
    token: pairingInfo.token,
  });

  return `${pairingInfo.httpProtocol}://${pairingInfo.host}:${pairingInfo.port}/disconnect?${params.toString()}`;
}

export function buildWebSocketEndpoint(pairingInfo: PairingInfo): string {
  const params = new URLSearchParams({
    token: pairingInfo.token,
  });

  return `${pairingInfo.wsProtocol}://${pairingInfo.host}:${pairingInfo.port}/ws?${params.toString()}`;
}

function parseHttpProtocol(rawProtocol: string | null): "http" | "https" | null {
  if (!rawProtocol) {
    return "http";
  }

  if (rawProtocol === "http" || rawProtocol === "https") {
    return rawProtocol;
  }

  return null;
}

function parseWsProtocol(rawProtocol: string | null): "ws" | "wss" | null {
  if (!rawProtocol) {
    return null;
  }

  if (rawProtocol === "ws" || rawProtocol === "wss") {
    return rawProtocol;
  }

  return null;
}

function inferWsProtocol(httpProtocol: "http" | "https"): "ws" | "wss" {
  return httpProtocol === "https" ? "wss" : "ws";
}
