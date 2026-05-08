import * as Sharing from "expo-sharing";
import { useCallback, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CharacterResultCard } from "@/components/pairing/CharacterResultCard";
import type { AcquiredCharacterPayload } from "@/lib/pairing/types";

const SCALE = 1;
const px = (v: number) => v * SCALE;
/**
 * カード詳細内のキャラ画像チューニング。
 * - widthRatio / heightRatio: 色背景ブロックに対する比率
 * - scale: 追加拡大率（1 が基準）
 * - offsetX / offsetY: px（正で右・下）
 */
const DETAIL_MODAL_PORTRAIT_TUNE = {
  widthRatio: 0.55,
  heightRatio: 0.9,
  scale: 1.2,
  offsetX: 0,
  offsetY: 40,
} as const;

export type CharacterInfoModalProps = {
  visible: boolean;
  payload: AcquiredCharacterPayload | null;
  onClose: () => void;
};

/**
 * Figma mobile「カード詳細」シート。
 */
export function CharacterInfoModal({ visible, payload, onClose }: CharacterInfoModalProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [headerHeight, setHeaderHeight] = useState(56);
  const bodyCaptureRef = useRef<View>(null);

  /**
   * ヘッダー以外（モーダル body）を PNG 化して共有する。
   * 長い ScrollView 全量は、端末・OS によりネイティブが画面外を描画済みでないと画像下端が欠けることがある（実機で要確認）。
   */
  const captureAndShareBody = useCallback(async () => {
    const node = bodyCaptureRef.current;
    if (!node) {
      return;
    }
    const uri = await captureRef(node, {
      format: "png",
      quality: 0.92,
      result: "tmpfile",
    });
    const dialogTitle = "カード詳細";

    if (Platform.OS === "android") {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle });
        return;
      }
    }

    if (Platform.OS === "ios") {
      await Share.share({ url: uri, title: dialogTitle });
      return;
    }

    await Share.share({ message: uri, title: dialogTitle });
  }, []);

  if (payload === null) {
    return null;
  }

  const sheetMaxHeight = height * 0.88;
  const cardScrollMaxHeight = Math.max(160, sheetMaxHeight - headerHeight);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="オーバーレイを閉じる"
        />
        <View
          style={[styles.center, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}
          pointerEvents="box-none">
          <View style={[styles.sheet, { maxHeight: sheetMaxHeight }]} pointerEvents="auto">
            <View
              style={styles.header}
              onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
              <Text style={styles.title}>カード詳細</Text>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={({ pressed }) => pressed && styles.closePressed}>
                <Text style={styles.closeText}>閉じる</Text>
              </Pressable>
            </View>
            <View ref={bodyCaptureRef} style={styles.body} collapsable={false}>
              <CharacterResultCard
                payload={payload}
                detailLayout
                scrollMaxHeight={cardScrollMaxHeight}
                detailPortraitTune={DETAIL_MODAL_PORTRAIT_TUNE}
                onShareImage={captureAndShareBody}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    paddingHorizontal: px(16),
  },
  sheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: px(400),
    borderRadius: px(28),
    backgroundColor: "#ffffff",
    overflow: "hidden",
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: px(20),
    paddingVertical: px(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  title: {
    fontSize: px(17),
    fontWeight: "700",
    color: "#000000",
    letterSpacing: px(0.2),
  },
  closeText: {
    fontSize: px(15),
    fontWeight: "700",
    color: "#666666",
  },
  closePressed: {
    opacity: 0.65,
  },
  body: {
    width: "100%",
    backgroundColor: "#ffffff",
  },
});
