import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, Vibration } from 'react-native';

const VIBE_INTERVAL = 80;

export default function HomeScreen() {
  const [vibing, setVibing] = useState(false);
  const vibingRef = useRef(false);
  const scale = useRef(new Animated.Value(1)).current;
  const hapticsTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const loopAnim = useRef<Animated.CompositeAnimation | null>(null);

  const startVibe = useCallback(() => {
    if (vibingRef.current) return;
    vibingRef.current = true;
    setVibing(true);

    loopAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.88, duration: 60, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 60, useNativeDriver: true }),
      ]),
    );
    loopAnim.current.start();

    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 50, 30], true);
    }

    hapticsTimer.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, VIBE_INTERVAL);
  }, [scale]);

  const stopVibe = useCallback(() => {
    if (!vibingRef.current) return;
    vibingRef.current = false;
    setVibing(false);

    if (loopAnim.current) {
      loopAnim.current.stop();
      loopAnim.current = null;
    }
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();

    Vibration.cancel();

    if (hapticsTimer.current) {
      clearInterval(hapticsTimer.current);
      hapticsTimer.current = null;
    }
  }, [scale]);

  // クリーンアップ
  useEffect(() => {
    return () => stopVibe();
  }, [stopVibe]);

  const toggleVibe = () => {
    if (vibingRef.current) {
      stopVibe();
    } else {
      startVibe();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>タップで ON / OFF</Text>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          style={[styles.button, vibing && styles.buttonActive]}
          onPress={toggleVibe}
        >
          <Text style={styles.label}>{vibing ? '振動中' : 'VIBE'}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: '#666',
    fontSize: 14,
    marginBottom: 32,
    letterSpacing: 2,
  },
  button: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  },
  buttonActive: {
    backgroundColor: '#a855f7',
    shadowOpacity: 1,
    shadowRadius: 50,
  },
  label: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
});
