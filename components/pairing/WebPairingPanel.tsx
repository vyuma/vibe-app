import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supportsWebVibration } from "@/lib/web-posture-alert";

type Props = {
  isPairing: boolean;
  connected: boolean;
  error: string | null;
  onConnect: (link: string) => Promise<boolean>;
  onDisconnect: () => Promise<void>;
  onEnableAlerts: () => Promise<void>;
};

export function WebPairingPanel({ isPairing, connected, error, onConnect, onDisconnect, onEnableAlerts }: Props) {
  const params = useLocalSearchParams<{ host?: string; port?: string; token?: string; relay?: string; room?: string }>();
  const [link, setLink] = useState("");
  const [vibrationSupported, setVibrationSupported] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  useEffect(() => {
    setVibrationSupported(supportsWebVibration());
    if (typeof params.relay === "string" && typeof params.room === "string" && typeof params.token === "string") {
      const query = new URLSearchParams({ relay: params.relay, room: params.room, token: params.token });
      setLink(`${window.location.origin}/pairing-test?${query}`);
    } else if (typeof params.host === "string" && typeof params.port === "string" && typeof params.token === "string") {
      const query = new URLSearchParams({ host: params.host, port: params.port, token: params.token });
      setLink(`vibeapp://pair?${query}`);
    }
  }, [params.host, params.port, params.token, params.relay, params.room]);

  async function connect() {
    setNotificationError(null);
    try {
      await onEnableAlerts();
    } catch {
      setNotificationError("通知音を有効にできませんでした。画面の通知で接続します。");
    }
    await onConnect(link);
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{connected ? "PCと接続済み" : "PCと接続"}</Text>
      <Text style={styles.description}>
        {connected ? "PCで姿勢登録・測定を始めてください。" : "PCのQRをスマートフォンのカメラで開くか、接続リンクを貼り付けてください。"}
      </Text>
      <Text style={styles.description}>
        {vibrationSupported ? "通知を有効にすると、音と振動でお知らせします。" : "このブラウザは振動に対応していません。音と画面でお知らせします。"}
        {"\n"}測定中はこのページを開いたままにしてください。
      </Text>
      {!connected && (
        <>
          <TextInput
            accessibilityLabel="PCの接続リンク"
            placeholder="接続リンク"
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Pressable accessibilityRole="button" disabled={isPairing || !link.trim()} onPress={() => void connect()}
            style={[styles.button, (isPairing || !link.trim()) && styles.disabled]}>
            <Text style={styles.buttonText}>{isPairing ? "接続中…" : "通知を有効にして接続"}</Text>
          </Pressable>
        </>
      )}
      {connected && (
        <Pressable accessibilityRole="button" onPress={() => void onDisconnect()} style={styles.button}>
          <Text style={styles.buttonText}>切断</Text>
        </Pressable>
      )}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {notificationError && <Text style={styles.error}>{notificationError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 18, marginBottom: 24, borderRadius: 18, backgroundColor: "#edf8fa", gap: 12 },
  title: { fontSize: 20, fontWeight: "700", color: "#24434c" },
  description: { fontSize: 13, lineHeight: 21, color: "#46616a" },
  input: { padding: 12, borderWidth: 1, borderColor: "#bdd8de", borderRadius: 10, backgroundColor: "#fff", fontSize: 13 },
  button: { padding: 14, borderRadius: 24, backgroundColor: "#218dab", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.45 },
  error: { color: "#a13333", fontSize: 13 },
});
