import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import type { PairResponse, PairingInfo, PairingSocketEvent } from "@/lib/pairing/types";

export type IosAlertMode = "vibration" | "rigid" | "heavy" | "notification";

type PairingStatusPanelProps = {
  pairingInfo: PairingInfo | null;
  pairResponse: PairResponse | null;
  lastSocketEvent: PairingSocketEvent | null;
  isSocketConnected: boolean;
  showIosAlertMode: boolean;
  iosAlertMode: IosAlertMode;
  onChangeIosAlertMode: (mode: IosAlertMode) => void;
};

export function PairingStatusPanel({
  pairingInfo,
  pairResponse,
  lastSocketEvent,
  isSocketConnected,
  showIosAlertMode,
  iosAlertMode,
  onChangeIosAlertMode,
}: PairingStatusPanelProps) {
  return (
    <ThemedView style={styles.panel}>
      <ThemedText type="subtitle">接続状態</ThemedText>
      <StatusRow label="ホスト" value={pairingInfo?.host ?? "-"} />
      <StatusRow label="ポート" value={pairingInfo ? String(pairingInfo.port) : "-"} />
      <StatusRow label="接続済み" value={pairResponse ? "はい" : "いいえ"} />
      <StatusRow label="デバイス名" value={pairResponse?.deviceName ?? "-"} />
      <StatusRow label="WebSocket" value={isSocketConnected ? "はい" : "いいえ"} />
      <StatusRow
        label="姿勢シグナル"
        value={getPostureLabel(lastSocketEvent?.type)}
      />
      {showIosAlertMode ? (
        <ThemedView style={styles.modePanel}>
          <ThemedText>iPhone通知方式</ThemedText>
          <ThemedView style={styles.modeButtons}>
            <ModeButton
              isActive={iosAlertMode === "vibration"}
              label="バイブレーション"
              onPress={() => onChangeIosAlertMode("vibration")}
            />
            <ModeButton
              isActive={iosAlertMode === "rigid"}
              label="Rigid"
              onPress={() => onChangeIosAlertMode("rigid")}
            />
            <ModeButton
              isActive={iosAlertMode === "heavy"}
              label="Heavy"
              onPress={() => onChangeIosAlertMode("heavy")}
            />
            <ModeButton
              isActive={iosAlertMode === "notification"}
              label="Error"
              onPress={() => onChangeIosAlertMode("notification")}
            />
          </ThemedView>
        </ThemedView>
      ) : null}
      <StatusRow
        label="最新シーケンス"
        value={lastSocketEvent ? String(lastSocketEvent.sequence) : "0"}
      />
      <StatusRow label="最新イベント" value={lastSocketEvent?.type ?? "-"} />
    </ThemedView>
  );
}

type StatusRowProps = {
  label: string;
  value: string;
};

function StatusRow({ label, value }: StatusRowProps) {
  return (
    <ThemedView style={styles.row}>
      <ThemedText>{label}</ThemedText>
      <ThemedText type="defaultSemiBold">{value}</ThemedText>
    </ThemedView>
  );
}

type ModeButtonProps = {
  label: string;
  isActive: boolean;
  onPress: () => void;
};

function ModeButton({ label, isActive, onPress }: ModeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeButton, isActive && styles.modeButtonActive]}>
      <ThemedText style={styles.modeButtonText}>{label}</ThemedText>
    </Pressable>
  );
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

const styles = StyleSheet.create({
  panel: {
    padding: 16,
    borderRadius: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#d6e0da",
    backgroundColor: "#f8fbf9",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "transparent",
  },
  modePanel: {
    gap: 8,
    backgroundColor: "transparent",
  },
  modeButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: "transparent",
  },
  modeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#6f8078",
  },
  modeButtonActive: {
    backgroundColor: "#1f5c44",
  },
  modeButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
