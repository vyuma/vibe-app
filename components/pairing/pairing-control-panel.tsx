import {
  CameraView,
  type BarcodeScanningResult,
} from "expo-camera";
import { Pressable, StyleSheet, TextInput } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type PairingControlPanelProps = {
  rawLink: string;
  isPairing: boolean;
  isConnected: boolean;
  scannerVisible: boolean;
  localError: string | null;
  error: string | null;
  hasCameraPermission: boolean;
  onChangeRawLink: (value: string) => void;
  onConnect: () => void;
  onOpenScanner: () => void;
  onDisconnect: () => void;
  onCloseScanner: () => void;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
};

export function PairingControlPanel({
  rawLink,
  isPairing,
  isConnected,
  scannerVisible,
  localError,
  error,
  hasCameraPermission,
  onChangeRawLink,
  onConnect,
  onOpenScanner,
  onDisconnect,
  onCloseScanner,
  onBarcodeScanned,
}: PairingControlPanelProps) {
  return (
    <ThemedView style={styles.panel}>
      <ThemedText type="title">モバイル連携</ThemedText>
      <ThemedText style={styles.description}>
        デスクトップで表示した連携リンクを貼り付けるか、QRコードを読み取って接続してください。
      </ThemedText>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={onChangeRawLink}
        placeholder="vibeapp://pair?host=...&port=...&token=..."
        placeholderTextColor="rgba(86, 106, 112, 0.66)"
        style={styles.input}
        value={rawLink}
      />

      <ThemedView style={styles.buttonRow}>
        <Pressable
          disabled={isPairing}
          onPress={onConnect}
          style={[styles.button, isPairing && styles.buttonDisabled]}>
          <ThemedText style={styles.buttonText}>
            {isPairing ? "接続中..." : "接続"}
          </ThemedText>
        </Pressable>
        <Pressable
          disabled={isPairing}
          onPress={onOpenScanner}
          style={[styles.buttonSecondary, isPairing && styles.buttonDisabled]}>
          <ThemedText style={styles.buttonText}>QRをスキャン</ThemedText>
        </Pressable>
        <Pressable
          disabled={!isConnected}
          onPress={onDisconnect}
          style={[styles.buttonMuted, !isConnected && styles.buttonDisabled]}>
          <ThemedText style={styles.buttonText}>切断</ThemedText>
        </Pressable>
      </ThemedView>

      {scannerVisible ? (
        <ThemedView style={styles.scannerPanel}>
          {hasCameraPermission ? (
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={onBarcodeScanned}
              style={styles.camera}
            />
          ) : null}
          <ThemedText style={styles.helperText}>
            QRコードに含まれる連携リンクを自動で読み取ります。
          </ThemedText>
          <Pressable onPress={onCloseScanner} style={styles.buttonMuted}>
            <ThemedText style={styles.buttonText}>スキャンを閉じる</ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}

      {localError ? <ThemedText style={styles.error}>{localError}</ThemedText> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 20,
    borderRadius: 24,
    gap: 14,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.46)",
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  description: {
    color: "#5b6d76",
    lineHeight: 22,
  },
  input: {
    minHeight: 112,
    borderWidth: 1.2,
    borderColor: "#cde2e9",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#f8fcff",
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: "transparent",
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#13a2d7",
  },
  buttonSecondary: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#34add5",
  },
  buttonMuted: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#7f8f96",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  error: {
    color: "#b93352",
  },
  scannerPanel: {
    gap: 12,
    backgroundColor: "transparent",
  },
  camera: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  helperText: {
    color: "#5b6d76",
  },
});
