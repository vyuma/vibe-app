import { AppState } from "react-native";
import { useEffect, useRef, useState } from "react";

import {
  connectPairingSocket,
  disconnectDevice,
  pairDevice,
} from "@/lib/pairing/client";
import type {
  AcquiredCharacterPayload,
  PairResponse,
  PairingInfo,
  PairingSocketEvent,
} from "@/lib/pairing/types";
import { normalizeCharacterId } from "@/lib/normalizeCharacterId";

const DEFAULT_DEVICE_NAME = "vibe-app";
const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

type LastAcquiredDispatch = { key: number; payload: AcquiredCharacterPayload };

type AcquiredCharacterEventWithFlatPayload = PairingSocketEvent &
  Partial<AcquiredCharacterPayload>;

type PairingSessionState = {
  pairingInfo: PairingInfo | null;
  pairResponse: PairResponse | null;
  lastSocketEvent: PairingSocketEvent | null;
  /**
   * acquired_character 専用。lastSocketEvent は直後の measuring_stopped 等で上書きされるため、
   * 獲得処理はここを購読する（欠落防止）。
   */
  lastAcquiredDispatch: LastAcquiredDispatch | null;
  isPairing: boolean;
  isSocketConnected: boolean;
  /** PC の測定フェーズと同期（measuring_started / stopped / スナップショット） */
  measuringSessionActive: boolean;
  error: string | null;
};

const defaultState: PairingSessionState = {
  pairingInfo: null,
  pairResponse: null,
  lastSocketEvent: null,
  lastAcquiredDispatch: null,
  isPairing: false,
  isSocketConnected: false,
  measuringSessionActive: false,
  error: null,
};

export function usePairingSession() {
  const [state, setState] = useState<PairingSessionState>(defaultState);
  const pairingInfoRef = useRef<PairingInfo | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const shouldKeepSocketRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pairingInfoRef.current = state.pairingInfo;
  }, [state.pairingInfo]);

  useEffect(() => {
    return () => {
      stopSocket();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && shouldKeepSocketRef.current) {
        connectSocket();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  async function startPairing(
    pairingInfo: PairingInfo,
    deviceName = DEFAULT_DEVICE_NAME,
  ): Promise<boolean> {
    setState((prev) => ({
      ...prev,
      pairingInfo,
      pairResponse: null,
      lastSocketEvent: null,
      lastAcquiredDispatch: null,
      isPairing: true,
      measuringSessionActive: false,
      error: null,
    }));

    try {
      const pairResponse = await pairDevice(pairingInfo, deviceName);

      setState((prev) => ({
        ...prev,
        pairingInfo,
        pairResponse,
        isPairing: false,
        error: null,
      }));
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isPairing: false,
        error: error instanceof Error ? error.message : "接続に失敗しました",
      }));
      return false;
    }
  }

  function stopSocket() {
    shouldKeepSocketRef.current = false;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    clearHeartbeatTimer();

    const activeSocket = socketRef.current;
    if (activeSocket) {
      activeSocket.onopen = null;
      activeSocket.onmessage = null;
      activeSocket.onerror = null;
      activeSocket.onclose = null;
      activeSocket.close();
      socketRef.current = null;
    }

    setState((prev) => {
      if (!prev.isSocketConnected) {
        return prev;
      }

      return {
        ...prev,
        isSocketConnected: false,
      };
    });
  }

  function startSocket() {
    if (!pairingInfoRef.current) {
      return;
    }

    shouldKeepSocketRef.current = true;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    connectSocket();
  }

  function connectSocket() {
    const pairingInfo = pairingInfoRef.current;
    if (!pairingInfo) {
      return;
    }

    const existingSocket = socketRef.current;
    if (
      existingSocket &&
      (existingSocket.readyState === WebSocket.OPEN ||
        existingSocket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearReconnectTimer();
    clearHeartbeatTimer();

    const socket = connectPairingSocket(pairingInfo);
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptRef.current = 0;
      startHeartbeat();
      setState((prev) => ({
        ...prev,
        isSocketConnected: true,
        error: null,
      }));
    };

    socket.onmessage = (message) => {
      try {
        const parsed = JSON.parse(String(message.data)) as PairingSocketEvent;
        if (
          parsed.type === "acquired_character" &&
          parsed.requiresAck &&
          parsed.eventId
        ) {
          sendAckEvent(socket, parsed.eventId, parsed.sequence);
        }
        const acquiredPayload = toAcquiredPayload(parsed);
        setState((prev) => {
          let measuringSessionActive = prev.measuringSessionActive;
          if (parsed.type === "measuring_started") {
            measuringSessionActive = true;
          } else if (parsed.type === "measuring_stopped") {
            measuringSessionActive = false;
          } else if (typeof parsed.measuringSessionActive === "boolean") {
            measuringSessionActive = parsed.measuringSessionActive;
          }

          let lastAcquiredDispatch = prev.lastAcquiredDispatch;
          if (acquiredPayload) {
            lastAcquiredDispatch = {
              key: (prev.lastAcquiredDispatch?.key ?? 0) + 1,
              payload: acquiredPayload,
            };
          }

          return {
            ...prev,
            lastSocketEvent: parsed,
            lastAcquiredDispatch,
            measuringSessionActive,
            error: null,
          };
        });
      } catch {
        setState((prev) => ({
          ...prev,
          error: "WebSocketメッセージの解析に失敗しました",
        }));
      }
    };

    socket.onerror = () => {
      setState((prev) => ({
        ...prev,
        error: "WebSocket接続でエラーが発生しました",
      }));
    };

    socket.onclose = () => {
      clearHeartbeatTimer();
      socketRef.current = null;

      setState((prev) => ({
        ...prev,
        isSocketConnected: false,
        // 日本語: 切断中は測定 UI を残さない（古い measuring_started のままホームに戻れない問題を防ぐ）
        measuringSessionActive: false,
      }));

      if (shouldKeepSocketRef.current) {
        scheduleReconnect();
      }
    };
  }

  function sendAckEvent(socket: WebSocket, eventId: string, sequence: number) {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(
      JSON.stringify({
        type: "ack_event",
        ackEventId: eventId,
        ackSequence: sequence,
        receivedAt: new Date().toISOString(),
        status: "received",
      }),
    );
  }

  async function disconnect() {
    const activePairingInfo = pairingInfoRef.current;
    stopSocket();

    if (!activePairingInfo) {
      setState(defaultState);
      return;
    }

    try {
      await disconnectDevice(activePairingInfo);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "切断に失敗しました",
      }));
      return;
    }

    setState(defaultState);
  }

  function scheduleReconnect() {
    if (reconnectTimerRef.current) {
      return;
    }

    const attempt = reconnectAttemptRef.current;
    const exponentialDelay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      1_000 * 2 ** attempt,
    );
    const jitter = Math.floor(Math.random() * 500);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      reconnectAttemptRef.current += 1;
      connectSocket();
    }, exponentialDelay + jitter);
  }

  function clearReconnectTimer() {
    if (!reconnectTimerRef.current) {
      return;
    }

    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }

  function startHeartbeat() {
    clearHeartbeatTimer();
    heartbeatTimerRef.current = setInterval(() => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(JSON.stringify({ type: "ping", at: new Date().toISOString() }));
    }, HEARTBEAT_INTERVAL_MS);
  }

  function clearHeartbeatTimer() {
    if (!heartbeatTimerRef.current) {
      return;
    }

    clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = null;
  }

  return {
    ...state,
    startPairing,
    startSocket,
    stopSocket,
    disconnect,
  };
}

function toAcquiredPayload(parsed: PairingSocketEvent): AcquiredCharacterPayload | null {
  if (parsed.type !== "acquired_character") {
    return null;
  }

  if (parsed.payload?.measurementId && parsed.payload?.characterId) {
    return {
      ...parsed.payload,
      characterId: normalizeCharacterId(parsed.payload.characterId),
    };
  }

  const flat = parsed as AcquiredCharacterEventWithFlatPayload;
  if (!flat.measurementId || !flat.characterId) {
    return null;
  }

  return {
    measurementId: flat.measurementId,
    acquiredAt: flat.acquiredAt ?? parsed.createdAt,
    characterId: normalizeCharacterId(flat.characterId),
    characterName: flat.characterName ?? "？？？？？",
    rarity: flat.rarity ?? "common",
    activeMeasurementMs: flat.activeMeasurementMs,
    goodMs: flat.goodMs,
    goodRatio: flat.goodRatio,
    postureTimeline: flat.postureTimeline,
    story: flat.story,
    portraitSrc: flat.portraitSrc,
    personalityTags: flat.personalityTags,
    characterColor: flat.characterColor,
    toneClass: flat.toneClass,
  };
}
