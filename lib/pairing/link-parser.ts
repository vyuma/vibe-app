import type { PairingInfo } from "./types";

export type PairingLinkParseResult =
  | { ok: true; pairingInfo: PairingInfo }
  | { ok: false; reason: string };

export function parsePairingLink(rawLink: string): PairingLinkParseResult {
  if (!rawLink.trim()) return { ok: false, reason: "リンクが空です。" };
  try {
    const url = new URL(rawLink.trim());
    const token = url.searchParams.get("token");
    if (!token) throw new Error("token が含まれていません。");

    // The public QR opens Vibe, while relay points to Posture's HTTPS API.
    const relay = url.searchParams.get("relay");
    if (relay) {
      if (!["https:", "http:", "vibeapp:"].includes(url.protocol)) throw new Error("サポートされていないURL形式です。");
      const endpoint = new URL(relay);
      const room = url.searchParams.get("room");
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
      if ((endpoint.protocol !== "https:" && !(local && endpoint.protocol === "http:"))
        || endpoint.pathname !== "/api/pairing" || endpoint.search || endpoint.hash
        || endpoint.username || endpoint.password) {
        throw new Error("中継サーバーのURLが正しくありません。");
      }
      if (!room || !/^[a-f0-9]{32}$/.test(room) || !/^[a-f0-9]{64}$/.test(token)) {
        throw new Error("接続情報が無効です。PCのQRを読み直してください。");
      }
      const httpProtocol = endpoint.protocol === "https:" ? "https" : "http";
      return { ok: true, pairingInfo: {
        host: endpoint.hostname, port: Number(endpoint.port || (httpProtocol === "https" ? 443 : 80)),
        token, roomId: room, apiBasePath: "/api/pairing", httpProtocol,
        wsProtocol: httpProtocol === "https" ? "wss" : "ws",
      } };
    }

    if (url.protocol === "vibeapp:" || ((url.protocol === "http:" || url.protocol === "https:") && url.searchParams.has("host"))) {
      const host = url.searchParams.get("host");
      const port = Number(url.searchParams.get("port"));
      if (!host || !validPort(port) || new URL(`http://${host}`).host !== host) {
        throw new Error("ペアリングURLのhostまたはportが正しくありません。");
      }
      const httpProtocol = url.searchParams.get("httpProtocol") ?? url.searchParams.get("protocol") ?? "http";
      const wsProtocol = url.searchParams.get("wsProtocol") ?? (httpProtocol === "https" ? "wss" : "ws");
      if (httpProtocol !== "http" && httpProtocol !== "https") throw new Error("httpProtocol は http または https を指定してください。");
      if (wsProtocol !== "ws" && wsProtocol !== "wss") throw new Error("wsProtocol は ws または wss を指定してください。");
      return { ok: true, pairingInfo: { host, port, token, httpProtocol, wsProtocol } };
    }

    if (url.protocol === "http:" || url.protocol === "https:") {
      if (url.username || url.password) throw new Error("接続リンクが正しくありません。");
      const httpProtocol = url.protocol === "https:" ? "https" : "http";
      return { ok: true, pairingInfo: {
        host: url.hostname, port: Number(url.port || (httpProtocol === "https" ? 443 : 80)),
        token, httpProtocol, wsProtocol: httpProtocol === "https" ? "wss" : "ws",
      } };
    }
    throw new Error("サポートされていないURL形式です。");
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "URLを解析できませんでした。" };
  }
}

function validPort(port: number) { return Number.isInteger(port) && port > 0 && port <= 65535; }

export function buildPairEndpoint(info: PairingInfo, deviceName: string): string {
  const url = httpEndpoint(info, "pair");
  if (!info.roomId) url.search = new URLSearchParams({ token: info.token, deviceName }).toString();
  return url.toString();
}

export function buildDisconnectEndpoint(info: PairingInfo): string {
  const url = httpEndpoint(info, "disconnect");
  if (!info.roomId) url.search = new URLSearchParams({ token: info.token }).toString();
  return url.toString();
}

export function buildWebSocketEndpoint(info: PairingInfo): string {
  const url = new URL(`${info.wsProtocol}://${info.host}:${info.port}${info.apiBasePath ?? ""}/ws`);
  url.searchParams.set("token", info.token);
  if (info.roomId) url.searchParams.set("room", info.roomId);
  return url.toString();
}

function httpEndpoint(info: PairingInfo, action: string) {
  return new URL(`${info.httpProtocol}://${info.host}:${info.port}${info.apiBasePath ?? ""}/${action}`);
}
