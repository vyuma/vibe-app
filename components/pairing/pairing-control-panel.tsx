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
      <ThemedText type="title">連携テスト</ThemedText>
      <ThemedText style={styles.description}>
        デスクトップのペアリングリンクを貼り付けるか、QRコードを読み取ってすぐ接続できます。
      </ThemedText>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={onChangeRawLink}
        placeholder="vibeapp://pair?host=..."
        style={styles.input}
        value={rawLink}
      />

      <ThemedView style={styles.buttonRow}>
        <Pressable disabled={isPairing} onPress={onConnect} style={styles.button}>
          <ThemedText style={styles.buttonText}>
            {isPairing ? "接続中..." : "接続"}
          </ThemedText>
        </Pressable>
        <Pressable
          disabled={isPairing}
          onPress={onOpenScanner}
          style={styles.buttonSecondary}>
          <ThemedText style={styles.buttonText}>QRをスキャン</ThemedText>
        </Pressable>
        <Pressable
          disabled={!isConnected}
          onPress={onDisconnect}
          style={styles.buttonMuted}>
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
            QRコード内の `vibeapp://pair?...` リンクを読み取ります。
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
    padding: 16,
    borderRadius: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#d6e0da",
    backgroundColor: "#f8fbf9",
  },
  description: {
    color: "#5d6b66",
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#c8d6cf",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#ffffff",
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: "transparent",
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#1f5c44",
  },
  buttonSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#3d7a63",
  },
  buttonMuted: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#6f8078",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  error: {
    color: "#b54848",
  },
  scannerPanel: {
    gap: 12,
    backgroundColor: "transparent",
  },
  camera: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  helperText: {
    color: "#5d6b66",
  },
});
