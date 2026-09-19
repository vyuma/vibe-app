import * as Sharing from "expo-sharing";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useRef } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { CharacterResultCard } from "@/components/pairing/CharacterResultCard";
import type { AcquiredCharacterPayload } from "@/lib/pairing/types";

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
const MAX_LAYOUT_WIDTH = 456;

const LOGO_WHITE_IMAGE = require("@/assets/images/logo_white.png");
// Figma プロトタイプ / 獲得 / 共有 (580:7110), original 40×40 export.
const SHARE_IMAGE = require("@/assets/images/acquisition-share.svg");

const PORTRAIT_TUNE = {
  widthRatio: 0.55,
  heightRatio: 0.9,
  scale: 1.2,
  offsetX: 0,
  offsetY: 40,
} as const;

export type AcquisitionResultModalProps = {
  visible: boolean;
  payload: AcquiredCharacterPayload | null;
  onClose: () => void;
};

/** 新規獲得時の全画面表示。保存済みカードの閲覧にはCharacterInfoModalを使う。 */
export function AcquisitionResultModal({
  visible,
  payload,
  onClose,
}: AcquisitionResultModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const captureTargetRef = useRef<View>(null);
  const layoutWidth = Math.min(width, MAX_LAYOUT_WIDTH);
  const scale = layoutWidth / DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);
  const cardWidth = Math.min(s(310), layoutWidth - s(32));
  const contentMinHeight = Math.max(height, s(DESIGN_HEIGHT));
  const headerTop = Math.max(s(60), insets.top + 8);
  const cardTop = Math.max(s(140), headerTop + s(80));

  const shareCard = useCallback(async () => {
    if (!captureTargetRef.current) {
      return;
    }
    const uri = await captureRef(captureTargetRef.current, {
      format: "png",
      quality: 0.92,
      result: "tmpfile",
    });
    const title = payload?.characterName ?? "ピンアナゴ獲得";

    if (Platform.OS === "android" && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: title });
      return;
    }
    if (Platform.OS === "ios") {
      await Share.share({ url: uri, title });
      return;
    }
    await Share.share({ message: uri, title });
  }, [payload?.characterName]);

  if (!payload) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <LinearGradient
          colors={["#34add5", "#e0e4c9"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { minHeight: contentMinHeight }]}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.canvas, { width: layoutWidth, minHeight: contentMinHeight, paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ホームに戻る"
              hitSlop={12}
              style={{
                position: "absolute",
                left: (layoutWidth - s(80)) / 2,
                top: headerTop,
                width: s(80),
                height: s(48),
              }}>
              <Image source={LOGO_WHITE_IMAGE} style={styles.fill} contentFit="contain" />
            </Pressable>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="戻る"
              style={({ pressed }) => [
                styles.backButton,
                { left: s(24), top: headerTop, minHeight: 44 },
                pressed && styles.pressed,
              ]}>
              <Text style={styles.backLabel}>戻る</Text>
            </Pressable>

            <Pressable
              onPress={() => void shareCard()}
              accessibilityRole="button"
              accessibilityLabel="カード画像を共有"
              hitSlop={Math.max(2, (44 - s(40)) / 2)}
              style={({ pressed }) => [
                styles.shareButton,
                {
                  right: s(40),
                  top: headerTop + s(2),
                  width: s(40),
                  height: s(40),
                  borderRadius: s(20),
                },
                pressed && styles.pressed,
              ]}>
              <Image
                source={SHARE_IMAGE}
                style={{ width: s(40), height: s(40) }}
                contentFit="contain"
              />
            </Pressable>

            <View
              ref={captureTargetRef}
              collapsable={false}
              style={{
                width: cardWidth,
                marginTop: cardTop,
                alignSelf: "center",
              }}>
              <CharacterResultCard
                payload={payload}
                detailLayout
                detailFlush
                detailScale={scale}
                detailScrollEnabled={false}
                scrollMaxHeight={s(800)}
                detailPortraitTune={{
                  ...PORTRAIT_TUNE,
                  offsetY: s(PORTRAIT_TUNE.offsetY),
                }}
              />
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ホームに戻る"
              style={({ pressed }) => [
                styles.homeButton,
                { width: cardWidth, marginTop: s(24), marginBottom: 24 },
                pressed && styles.pressed,
              ]}>
              <Text style={styles.homeLabel}>ホームに戻る</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#34add5",
  },
  scroll: {
    flex: 1,
  },
  content: {
    alignItems: "center",
  },
  canvas: {
    position: "relative",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  shareButton: {
    position: "absolute",
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",

  },
  backButton: {
    position: "absolute",
    zIndex: 2,
    minWidth: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  backLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  homeButton: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: "#ffffff",
  },
  homeLabel: {
    color: "#16758f",
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
});
