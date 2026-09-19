import { afterEach, expect, test } from "bun:test";
import { buildDisconnectEndpoint, buildPairEndpoint, buildWebSocketEndpoint, parsePairingLink } from "../lib/pairing/link-parser";
import { disconnectDevice, pairDevice } from "../lib/pairing/client";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const room = "a".repeat(32);
const token = "b".repeat(64);
const params = new URLSearchParams({ relay: "https://posture.example/api/pairing", room, token });
const cloudLink = `https://vibe.example/pairing-test?${params}`;

test("the public QR targets Posture's HTTPS and WSS relay, not the Vibe website", async () => {
  const parsed = parsePairingLink(cloudLink);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.reason);
  expect(parsed.pairingInfo).toMatchObject({ host: "posture.example", port: 443, roomId: room, httpProtocol: "https", wsProtocol: "wss" });
  expect(buildPairEndpoint(parsed.pairingInfo, "iPhone")).toBe("https://posture.example/api/pairing/pair");
  expect(buildDisconnectEndpoint(parsed.pairingInfo)).toBe("https://posture.example/api/pairing/disconnect");
  const socket = new URL(buildWebSocketEndpoint(parsed.pairingInfo));
  expect(socket.protocol).toBe("wss:");
  expect(socket.pathname).toBe("/api/pairing/ws");
  expect(socket.searchParams.get("room")).toBe(room);
  expect(socket.searchParams.get("token")).toBe(token);

  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (url: any, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return Response.json({ ok: true });
  }) as typeof fetch;
  await pairDevice(parsed.pairingInfo, "iPhone Safari");
  await disconnectDevice(parsed.pairingInfo);
  expect(requests[0].init?.method).toBe("POST");
  expect(requests[0].init?.credentials).toBe("omit");
  expect(JSON.parse(String(requests[0].init?.body))).toEqual({ roomId: room, token, deviceName: "iPhone Safari" });
  expect(requests[1].init?.method).toBe("POST");
  expect(requests[0].url).not.toContain(token);
});

test("native QR and local browser QR keep the LAN protocol", () => {
  for (const link of [
    "vibeapp://pair?host=192.168.0.2&port=5000&token=local-token",
    "http://192.168.0.2:5000/connect?token=local-token",
    "http://192.168.0.2:8081/pairing-test?host=192.168.0.2&port=5000&token=local-token",
  ]) {
    const parsed = parsePairingLink(link);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(buildPairEndpoint(parsed.pairingInfo, "phone")).toBe("http://192.168.0.2:5000/pair?token=local-token&deviceName=phone");
    expect(buildWebSocketEndpoint(parsed.pairingInfo)).toBe("ws://192.168.0.2:5000/ws?token=local-token");
    expect(parsed.pairingInfo.roomId).toBeUndefined();
  }
});

test("reject malformed rooms, credentials, protocols and insecure public relay URLs", () => {
  for (const change of [
    { room: "missing" }, { token: "invalid" }, { relay: "http://posture.example/api/pairing" },
    { relay: "https://user:password@posture.example/api/pairing" },
    { relay: "https://posture.example/elsewhere" }, { relay: "javascript:alert(1)" },
  ]) {
    const query = new URLSearchParams(params);
    for (const [key, value] of Object.entries(change)) query.set(key, value);
    expect(parsePairingLink(`https://vibe.example/pairing-test?${query}`).ok).toBe(false);
  }
  for (const port of ["0", "65536", "5broken", "-10", "1.5"]) {
    expect(parsePairingLink(`vibeapp://pair?host=localhost&port=${port}&token=test`).ok).toBe(false);
  }
  expect(parsePairingLink("vibeapp://pair?host=localhost&port=5000&token=t&wsProtocol=ftp").ok).toBe(false);
});

test("a localhost relay can be tested through the same public-link parser", () => {
  const query = new URLSearchParams({ relay: "http://localhost:1420/api/pairing", room, token });
  const parsed = parsePairingLink(`http://localhost:8081/pairing-test?${query}`);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(buildWebSocketEndpoint(parsed.pairingInfo)).toStartWith("ws://localhost:1420/api/pairing/ws?");
});
