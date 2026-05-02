import { AppState } from "react-native";
import { useEffect, useRef, useState } from "react";

import {
  connectPairingSocket,
  disconnectDevice,
  pairDevice,
} from "@/lib/pairing/client";
import type {
  PairResponse,
  PairingInfo,
  PairingSocketEvent,
} from "@/lib/pairing/types";

const DEFAULT_DEVICE_NAME = "vibe-app";
const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

type PairingSessionState = {
  pairingInfo: PairingInfo | null;
  pairResponse: PairResponse | null;
  lastSocketEvent: PairingSocketEvent | null;
  isPairing: boolean;
  isSocketConnected: boolean;
  error: string | null;
};

const defaultState: PairingSessionState = {
  pairingInfo: null,
  pairResponse: null,
  lastSocketEvent: null,
  isPairing: false,
  isSocketConnected: false,
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
      isPairing: true,
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
        setState((prev) => ({
          ...prev,
          lastSocketEvent: parsed,
          error: null,
        }));
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
      }));

      if (shouldKeepSocketRef.current) {
        scheduleReconnect();
      }
    };
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
