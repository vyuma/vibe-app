import {
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Vibration } from "react-native";

import { PairingControlPanel } from "@/components/pairing/pairing-control-panel";
import {
  type IosAlertMode,
  PairingStatusPanel,
} from "@/components/pairing/pairing-status-panel";
import { usePairingSession } from "@/hooks/usePairingSession";
import { parsePairingLink } from "@/lib/pairing";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function PairingTestScreen() {
  const [rawLink, setRawLink] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isBadPosture, setIsBadPosture] = useState(false);
  const [iosAlertMode, setIosAlertMode] = useState<IosAlertMode>("rigid");
  const {
    pairingInfo,
    pairResponse,
    lastSocketEvent,
    isPairing,
    isSocketConnected,
    error,
    startPairing,
    startSocket,
    disconnect,
  } = usePairingSession();

  useEffect(() => {
    if (!scannerVisible) {
      setHasScanned(false);
    }
  }, [scannerVisible]);

  useEffect(() => {
    if (lastSocketEvent?.type === "posture_bad") {
      setIsBadPosture(true);
      return;
    }

    if (lastSocketEvent?.type === "posture_good") {
      setIsBadPosture(false);
    }
  }, [lastSocketEvent]);

  useEffect(() => {
    if (!isSocketConnected || !isBadPosture) {
      Vibration.cancel();
      return;
    }

    if (Platform.OS === 'android') {
      // Strong-ish repeating pattern: vibrate 900ms, pause 350ms.
      Vibration.vibrate([0, 900, 350], true);
      return () => Vibration.cancel();
    }

    let disposed = false;
    const runPulse = async () => {
      while (!disposed) {
        if (iosAlertMode === "vibration") {
          Vibration.vibrate();
          await sleep(900);
          continue;
        }

        if (iosAlertMode === "heavy") {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await sleep(700);
          continue;
        }

        if (iosAlertMode === "rigid") {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
          await sleep(650);
          continue;
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await sleep(900);
      }
    };

    void runPulse();

    return () => {
      disposed = true;
      Vibration.cancel();
    };
  }, [iosAlertMode, isBadPosture, isSocketConnected]);

  async function handleConnect() {
    await handleConnectFromLink(rawLink);
  }

  async function handleConnectFromLink(link: string) {
    const parsed = parsePairingLink(link);

    if (!parsed.ok) {
      setLocalError(parsed.reason);
      return;
    }

    setLocalError(null);
    setRawLink(link);
    const paired = await startPairing(parsed.pairingInfo, getAutoDeviceName());
    if (paired) {
      startSocket();
    }
  }

  async function handleOpenScanner() {
    if (Platform.OS === "web") {
      setLocalError("QRスキャンはモバイル端末のカメラでのみ利用できます。");
      return;
    }

    const currentPermission = permission?.granted
      ? permission
      : await requestPermission();

    if (!currentPermission?.granted) {
      setLocalError("カメラ権限が必要です。");
      return;
    }

    setLocalError(null);
    setScannerVisible(true);
  }

  async function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (hasScanned) {
      return;
    }

    setHasScanned(true);
    setScannerVisible(false);
    await handleConnectFromLink(result.data);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PairingControlPanel
        error={error}
        hasCameraPermission={Boolean(permission?.granted)}
        isConnected={Boolean(pairResponse)}
        isPairing={isPairing}
        localError={localError}
        onBarcodeScanned={handleBarcodeScanned}
        onChangeRawLink={setRawLink}
        onCloseScanner={() => setScannerVisible(false)}
        onConnect={() => void handleConnect()}
        onDisconnect={() => void disconnect()}
        onOpenScanner={() => void handleOpenScanner()}
        rawLink={rawLink}
        scannerVisible={scannerVisible}
      />

      <PairingStatusPanel
        iosAlertMode={iosAlertMode}
        isSocketConnected={isSocketConnected}
        lastSocketEvent={lastSocketEvent}
        onChangeIosAlertMode={setIosAlertMode}
        pairResponse={pairResponse}
        pairingInfo={pairingInfo}
        showIosAlertMode={Platform.OS === "ios"}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
  },
});

function getAutoDeviceName(): string {
  const constants = Platform.constants as Record<string, unknown>;
  const model =
    (typeof constants?.Model === 'string' && constants.Model) ||
    (typeof constants?.Brand === 'string' && constants.Brand) ||
    (typeof constants?.model === 'string' && constants.model) ||
    null;
  const osVersion =
    (typeof constants?.osVersion === 'string' && constants.osVersion) ||
    (typeof constants?.Release === 'string' && constants.Release) ||
    null;

  if (model && osVersion) {
    return `vibe-app (${model} / ${Platform.OS} ${osVersion})`;
  }

  if (model) {
    return `vibe-app (${model})`;
  }

  return `vibe-app (${Platform.OS})`;
}
