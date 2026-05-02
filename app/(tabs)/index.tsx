import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.card}>
        <ThemedText type="title">vibe-app</ThemedText>
        <ThemedText style={styles.description}>
          連携テスト画面では、リンクの貼り付けとQRスキャンの両方を利用できます。
        </ThemedText>
        <Link href="../pairing-test" style={styles.linkButton}>
          <ThemedText style={styles.linkText}>連携画面を開く</ThemedText>
        </Link>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    padding: 20,
    borderRadius: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#d6e0da',
    backgroundColor: '#f8fbf9',
  },
  description: {
    color: '#5d6b66',
  },
  linkButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#1f5c44',
    overflow: 'hidden',
  },
  linkText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
