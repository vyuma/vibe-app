import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import type { PairResponse, PairingInfo, PairingSocketEvent } from "@/lib/pairing/types";

type PairingStatusPanelProps = {
  pairingInfo: PairingInfo | null;
  pairResponse: PairResponse | null;
  lastSocketEvent: PairingSocketEvent | null;
  isSocketConnected: boolean;
  isVibrationActive: boolean;
};

export function PairingStatusPanel({
  pairingInfo,
  pairResponse,
  lastSocketEvent,
  isSocketConnected,
  isVibrationActive,
}: PairingStatusPanelProps) {
  const connectionLabel = getConnectionLabel(pairResponse, isSocketConnected);
  const postureLabel = getPostureLabel(lastSocketEvent?.type);

  return (
    <ThemedView style={styles.panel}>
      <ThemedText type="subtitle">連携ステータス</ThemedText>
      <StatusRow label="接続" value={connectionLabel} />
      <StatusRow label="デバイス名" value={pairResponse?.deviceName ?? "未接続"} />
      <StatusRow
        label="バイブ状態"
        value={isVibrationActive ? "通知中" : "待機中"}
      />
      <StatusRow label="姿勢判定" value={postureLabel} />
      <StatusRow label="ホスト" value={pairingInfo?.host ?? "未設定"} />
      <StatusRow label="ポート" value={pairingInfo ? String(pairingInfo.port) : "未設定"} />
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

function getPostureLabel(eventType: string | undefined): string {
  if (eventType === "posture_bad") {
    return "姿勢が崩れています";
  }

  if (eventType === "posture_good") {
    return "姿勢は安定しています";
  }

  return "判定待ち";
}

function getConnectionLabel(
  pairResponse: PairResponse | null,
  isSocketConnected: boolean,
): string {
  if (!pairResponse) {
    return "未接続";
  }
  if (isSocketConnected) {
    return "接続中";
  }
  return "再接続中";
}

const styles = StyleSheet.create({
  panel: {
    padding: 18,
    borderRadius: 24,
    gap: 14,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "transparent",
  },
});
