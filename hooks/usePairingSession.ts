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
  const disconnectRef = useRef<() => Promise<void>>(async () => {});

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
      if (nextState !== "active") {
        void disconnectRef.current();
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

    stopSocket();

    const socket = connectPairingSocket(pairingInfoRef.current);
    socketRef.current = socket;

    socket.onopen = () => {
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
      setState((prev) => ({
        ...prev,
        isSocketConnected: false,
      }));
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

  disconnectRef.current = disconnect;

  return {
    ...state,
    startPairing,
    startSocket,
    stopSocket,
    disconnect,
  };
}
