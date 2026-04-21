import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usePairingSession } from '@/hooks/usePairingSession';
import { parsePairingLink } from '@/lib/pairing';

export default function PairingTestScreen() {
  const [rawLink, setRawLink] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
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
    if (Platform.OS === 'web') {
      setLocalError('QRスキャンはモバイル端末のカメラでのみ利用できます。');
      return;
    }

    const currentPermission = permission?.granted
      ? permission
      : await requestPermission();

    if (!currentPermission.granted) {
      setLocalError('カメラ権限が必要です。');
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
      <ThemedView style={styles.panel}>
        <ThemedText type="title">連携テスト</ThemedText>
        <ThemedText style={styles.description}>
          デスクトップのペアリングリンクを貼り付けるか、QRコードを読み取ってすぐ接続できます。
        </ThemedText>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          onChangeText={setRawLink}
          placeholder="vibeapp://pair?host=..."
          style={styles.input}
          value={rawLink}
        />

        <ThemedView style={styles.buttonRow}>
          <Pressable disabled={isPairing} onPress={() => void handleConnect()} style={styles.button}>
            <ThemedText style={styles.buttonText}>
              {isPairing ? '接続中...' : '接続'}
            </ThemedText>
          </Pressable>
          <Pressable disabled={isPairing} onPress={() => void handleOpenScanner()} style={styles.buttonSecondary}>
            <ThemedText style={styles.buttonText}>QRをスキャン</ThemedText>
          </Pressable>
          <Pressable disabled={!pairResponse} onPress={() => void disconnect()} style={styles.buttonMuted}>
            <ThemedText style={styles.buttonText}>切断</ThemedText>
          </Pressable>
        </ThemedView>

        {scannerVisible ? (
          <ThemedView style={styles.scannerPanel}>
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
              style={styles.camera}
            />
            <ThemedText style={styles.helperText}>
              QRコード内の `vibeapp://pair?...` リンクを読み取ります。
            </ThemedText>
            <Pressable onPress={() => setScannerVisible(false)} style={styles.buttonMuted}>
              <ThemedText style={styles.buttonText}>スキャンを閉じる</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {localError ? <ThemedText style={styles.error}>{localError}</ThemedText> : null}
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      </ThemedView>

      <ThemedView style={styles.panel}>
        <ThemedText type="subtitle">接続状態</ThemedText>
        <ThemedView style={styles.row}>
          <ThemedText>ホスト</ThemedText>
          <ThemedText type="defaultSemiBold">{pairingInfo?.host ?? '-'}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.row}>
          <ThemedText>ポート</ThemedText>
          <ThemedText type="defaultSemiBold">
            {pairingInfo ? String(pairingInfo.port) : '-'}
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.row}>
          <ThemedText>接続済み</ThemedText>
          <ThemedText type="defaultSemiBold">{pairResponse ? 'はい' : 'いいえ'}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.row}>
          <ThemedText>デバイス名</ThemedText>
          <ThemedText type="defaultSemiBold">{pairResponse?.deviceName ?? '-'}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.row}>
          <ThemedText>WebSocket</ThemedText>
          <ThemedText type="defaultSemiBold">{isSocketConnected ? 'はい' : 'いいえ'}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.row}>
          <ThemedText>姿勢シグナル</ThemedText>
          <ThemedText type="defaultSemiBold">
            {getPostureLabel(lastSocketEvent?.type)}
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.row}>
          <ThemedText>最新シーケンス</ThemedText>
          <ThemedText type="defaultSemiBold">
            {lastSocketEvent ? String(lastSocketEvent.sequence) : '0'}
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.row}>
          <ThemedText>最新イベント</ThemedText>
          <ThemedText type="defaultSemiBold">
            {lastSocketEvent ? lastSocketEvent.type : '-'}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
  },
  panel: {
    padding: 16,
    borderRadius: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#d6e0da',
    backgroundColor: '#f8fbf9',
  },
  description: {
    color: '#5d6b66',
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#c8d6cf',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#1f5c44',
  },
  buttonSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#3d7a63',
  },
  buttonMuted: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#6f8078',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'transparent',
  },
  error: {
    color: '#b54848',
  },
  scannerPanel: {
    gap: 12,
    backgroundColor: 'transparent',
  },
  camera: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  helperText: {
    color: '#5d6b66',
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

function getPostureLabel(eventType: string | undefined): string {
  if (eventType === "posture_bad") {
    return "姿勢悪い";
  }

  if (eventType === "posture_good") {
    return "姿勢いい";
  }

  return "-";
}
