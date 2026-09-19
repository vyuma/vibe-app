import { saveMeasurementResult } from '@/lib/pairing/measurement-storage';
import { applySessionEvent } from '@/lib/pairing/session-state';
import { saveAcquiredCard } from '@/lib/pairing/acquired-storage';
import { AppState } from "react-native";
import { useEffect, useRef, useState } from "react";

import {
  connectPairingSocket,
  disconnectDevice,
  pairDevice,
} from "@/lib/pairing/client";
import type {
  CompletedMeasurement,
  AcquiredCharacterPayload,
  PairResponse,
  PairingInfo,
  PairingSocketEvent,
} from "@/lib/pairing/types";
import { normalizeCharacterId } from "@/lib/normalizeCharacterId";

const DEFAULT_DEVICE_NAME = "vibe-app";
const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

type LastAcquiredDispatch = { key: number; cards: AcquiredCharacterPayload[]; payload: AcquiredCharacterPayload };

type AcquiredCharacterEventWithFlatPayload = PairingSocketEvent &
  Partial<AcquiredCharacterPayload>;

type PairingSessionState = {
  stateSequence: number;
  measurementId: string | null;
  lastCompletedResult: CompletedMeasurement | null;
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
  /** PC で良い姿勢登録フロー中（専用イベントまたはスナップショットのフラグ） */
  goodPostureRegistrationActive: boolean;
  error: string | null;
};

const defaultState: PairingSessionState = {
  stateSequence: -1,
  measurementId: null,
  lastCompletedResult: null,
  pairingInfo: null,
  pairResponse: null,
  lastSocketEvent: null,
  lastAcquiredDispatch: null,
  isPairing: false,
  isSocketConnected: false,
  measuringSessionActive: false,
  goodPostureRegistrationActive: false,
  error: null,
};

export function usePairingSession() {
  const [state, setState] = useState<PairingSessionState>(defaultState);
  const pairingAttemptRef = useRef(0);
  const pairingInfoRef = useRef<PairingInfo | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const shouldKeepSocketRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageAtRef = useRef(Date.now());
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
        stopSocket();
        startSocket();
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
    const attempt = ++pairingAttemptRef.current;
    stopSocket();
    pairingInfoRef.current = pairingInfo;
    setState((prev) => ({
      ...prev,
      pairingInfo,
      measurementId: null,
      stateSequence: -1,
      pairResponse: null,
      lastSocketEvent: null,
      lastAcquiredDispatch: null,
      isPairing: true,
      measuringSessionActive: false,
      goodPostureRegistrationActive: false,
      error: null,
    }));

    try {
      const pairResponse = await pairDevice(pairingInfo, deviceName);
      if (attempt !== pairingAttemptRef.current) return false;

      setState((prev) => ({
        ...prev,
        pairingInfo,
        pairResponse,
        isPairing: false,
        error: null,
      }));
      return true;
    } catch (error) {
      if (attempt !== pairingAttemptRef.current) return false;
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
      lastMessageAtRef.current = Date.now();
      startHeartbeat();
      setState((prev) => ({
        ...prev,
        stateSequence: -1,
        measuringSessionActive: false,
        goodPostureRegistrationActive: false,
        isSocketConnected: true,
        error: null,
      }));
    };

    let deliveries = Promise.resolve();
    socket.onmessage = (message) => {
      lastMessageAtRef.current = Date.now();
      deliveries = deliveries.then(async () => {
        try {
          if (socketRef.current !== socket) return;
          const parsed = JSON.parse(String(message.data)) as PairingSocketEvent;
          if ((parsed as { type: string }).type === "pong") return;
          if (parsed.type === "measurement_completed") {
            if (!parsed.result?.id || !parsed.result.sourceId) throw new Error('Invalid measurement result');
            await saveMeasurementResult(parsed.result);
          }
          const acquiredPayload = toAcquiredPayload(parsed);
          const cards = acquiredPayload ? await saveAcquiredCard(acquiredPayload) : null;
          if (socketRef.current !== socket) return;
          if ((acquiredPayload || parsed.type === "measurement_completed") && parsed.requiresAck && parsed.eventId) {
            sendAckEvent(socket, parsed.eventId, parsed.sequence);
          }
          setState((prev) => {
            const session = applySessionEvent(prev, parsed);
            let lastAcquiredDispatch = prev.lastAcquiredDispatch;
            if (acquiredPayload) {
              lastAcquiredDispatch = {
                key: (prev.lastAcquiredDispatch?.key ?? 0) + 1,
                payload: acquiredPayload,
                cards: cards!,
              };
            }

            return {
              ...session,
              lastAcquiredDispatch,
              lastCompletedResult: parsed.result && (!prev.lastCompletedResult || parsed.result.endedAt > prev.lastCompletedResult.endedAt)
                ? parsed.result : prev.lastCompletedResult,
              error: null,
            };
          });
        } catch {
          setState((prev) => ({
            ...prev,
            error: "受信データの解析・保存に失敗しました。再接続して再試行してください。",
          }));
        }
      });
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
        goodPostureRegistrationActive: false,
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
        status: "stored",
      }),
    );
  }

  async function disconnect() {
    ++pairingAttemptRef.current;
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

      if (Date.now() - lastMessageAtRef.current > 60_000) {
        socket.close();
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
  if (parsed.type !== "acquired_character" && parsed.type !== "measurement_completed") {
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
