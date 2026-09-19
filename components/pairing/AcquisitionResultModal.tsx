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
  useWindowDimensions,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";

import { CharacterResultCard } from "@/components/pairing/CharacterResultCard";
import type { AcquiredCharacterPayload } from "@/lib/pairing/types";

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
const MAX_LAYOUT_WIDTH = 456;

const LOGO_WHITE_IMAGE = require("@/assets/images/logo_white.png");
const SHARE_IMAGE = require("@/assets/images/share.png");

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

/** Figma `モバイル/獲得`。ホームの取得済みカードから開く場合も同じ画面を使う。 */
export function AcquisitionResultModal({
  visible,
  payload,
  onClose,
}: AcquisitionResultModalProps) {
  const { width, height } = useWindowDimensions();
  const captureTargetRef = useRef<View>(null);
  const layoutWidth = Math.min(width, MAX_LAYOUT_WIDTH);
  const scale = layoutWidth / DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);
  const cardWidth = Math.min(s(310), layoutWidth - s(32));
  const contentMinHeight = Math.max(height, s(DESIGN_HEIGHT));

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
          <View style={[styles.canvas, { width: layoutWidth, minHeight: contentMinHeight }]}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ホームに戻る"
              hitSlop={12}
              style={{
                position: "absolute",
                left: (layoutWidth - s(80)) / 2,
                top: s(60),
                width: s(80),
                height: s(48),
              }}>
              <Image source={LOGO_WHITE_IMAGE} style={styles.fill} contentFit="contain" />
            </Pressable>

            <Pressable
              onPress={() => void shareCard()}
              accessibilityRole="button"
              accessibilityLabel="カード画像を共有"
              hitSlop={10}
              style={({ pressed }) => [
                styles.shareButton,
                {
                  right: s(24),
                  top: s(60),
                  width: s(40),
                  height: s(40),
                  borderRadius: s(20),
                },
                pressed && styles.pressed,
              ]}>
              <Image
                source={SHARE_IMAGE}
                style={{ width: s(20), height: s(20) }}
                contentFit="contain"
              />
            </Pressable>

            <View
              ref={captureTargetRef}
              collapsable={false}
              style={{
                width: cardWidth,
                marginTop: s(140),
                alignSelf: "center",
              }}>
              <CharacterResultCard
                payload={payload}
                detailLayout
                detailFlush
                detailScale={scale}
                detailScrollEnabled={false}
                detailPortraitTune={{
                  ...PORTRAIT_TUNE,
                  offsetY: s(PORTRAIT_TUNE.offsetY),
                }}
              />
            </View>
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
    backgroundColor: "rgba(255, 255, 255, 0.24)",
  },
  pressed: {
    opacity: 0.7,
  },
});
