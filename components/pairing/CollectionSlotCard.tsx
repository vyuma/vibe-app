import { Image } from "expo-image";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CharacterCatalogEntry } from "@/lib/characterCatalog";
import type { AcquiredCharacterPayload } from "@/lib/pairing/types";
import { resolveCharacterPortraitSource } from "@/lib/resolveCharacterPortrait";

/**
 * ホーム・習得スロットカード内のキャラ画像：このオブジェクトを編集して位置・大きさを調整する。
 * `offsetX` / `offsetY` はピクセル（正で右・下）。`scale` は 1 を基準に拡大。
 */
export const DEFAULT_ACQUIRED_PORTRAIT_TUNING = {
  scale: 1.22,
  offsetX: 0,
  offsetY: 25,
} as const;

export type AcquiredPortraitTuning = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type CollectionSlotCardProps = {
  /** 表示用スロット番号（1 始まり、001 形式で描画） */
  slotNumber: number;
  width: number;
  height: number;
  borderRadius: number;
  /** カタログに定義がないスロットでは null（常に未習得表示） */
  catalogEntry: CharacterCatalogEntry | null;
  acquiredPayload: AcquiredCharacterPayload | undefined;
  labelFontSize: number;
  labelLineHeight: number;
  labelBoxWidth: number;
  labelBoxHeight: number;
  lockedCardStyle: object;
  acquiredCardStyle: object;
  lockedLabelStyle: object;
  numberTextStyle: object;
  onPressAcquired?: () => void;
  /**
   * 未指定時は DEFAULT_ACQUIRED_PORTRAIT_TUNING。部分上書き可（親から試す場合）。
   */
  acquiredPortraitTune?: Partial<AcquiredPortraitTuning>;
};

/**
 * ホームグリッドの1スロット。未習得は従来の番号のみ、習得は portrait・名前・タグ（最大2）。
 */
export const CollectionSlotCard = memo(function CollectionSlotCard({
  slotNumber,
  width,
  height,
  borderRadius,
  catalogEntry,
  acquiredPayload,
  labelFontSize,
  labelLineHeight,
  labelBoxWidth,
  labelBoxHeight,
  lockedCardStyle,
  acquiredCardStyle,
  lockedLabelStyle,
  numberTextStyle,
  onPressAcquired,
  acquiredPortraitTune,
}: CollectionSlotCardProps) {
  const paddedSlot = String(slotNumber).padStart(3, "0");
  const isAcquired = Boolean(catalogEntry && acquiredPayload);

  const portraitTune = useMemo(
    () => ({
      ...DEFAULT_ACQUIRED_PORTRAIT_TUNING,
      ...acquiredPortraitTune,
    }),
    [acquiredPortraitTune],
  );

  /**
   * キャラ色ブロック：カード上辺・左右の余白を同じ値（contentInset）に揃える。
   * 下は名前・タグ用に metaReserve を確保し、正方形が縦に入らない場合は縮小して inset を再計算する。
   */
  const { previewSide, previewRadius, contentInset } = useMemo(() => {
    const w = width;
    const h = height;
    const metaReserve = Math.max(56, h * 0.3);
    const defaultInset = w * 0.05;
    const minInsetForHeight = w + metaReserve - h;
    let inset = Math.max(defaultInset, minInsetForHeight);
    const maxInset = Math.max(0, (w - 40) / 2);
    inset = Math.min(inset, maxInset);

    let side = w - 2 * inset;
    const maxSideByHeight = h - inset - metaReserve;
    if (side > maxSideByHeight) {
      side = Math.max(40, maxSideByHeight);
      inset = (w - side) / 2;
    }

    return {
      previewSide: side,
      previewRadius: Math.max(12, borderRadius * 0.72),
      contentInset: inset,
    };
  }, [width, height, borderRadius]);

  if (!isAcquired) {
    return (
      <View
        style={[
          styles.cardBase,
          lockedCardStyle,
          { width, height, borderRadius },
        ]}>
        <Text
          style={[
            numberTextStyle,
            styles.slotNumberBase,
            lockedLabelStyle,
            {
              fontSize: labelFontSize,
              lineHeight: labelLineHeight,
              width: labelBoxWidth,
              height: labelBoxHeight,
            },
          ]}>
          {paddedSlot}
        </Text>
      </View>
    );
  }

  const character = catalogEntry!;
  const primary = character.characterColor.primary;
  const soft = character.characterColor.soft;
  const tags = character.personalityTags.slice(0, 2);
  const portraitSource = resolveCharacterPortraitSource(character.id);

  return (
    <Pressable
      onPress={onPressAcquired}
      style={({ pressed }) => [
        styles.cardBase,
        styles.acquiredCardLayout,
        acquiredCardStyle,
        { width, height, borderRadius },
        pressed && styles.acquiredPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${character.name}のカード情報を開く`}>
      {/* 影は Pressable（overflow visible）、中身は角丸でクリップ */}
      <View style={[styles.acquiredClip, { borderRadius, paddingTop: contentInset }]}>
        <View
          style={[
            styles.previewBlock,
            {
              width: previewSide,
              height: previewSide,
              borderRadius: previewRadius,
              backgroundColor: `${soft}55`,
            },
          ]}>
          <Image
            source={portraitSource}
            style={[
              styles.portraitFill,
              {
                transform: [
                  { scale: portraitTune.scale },
                  { translateX: portraitTune.offsetX },
                  { translateY: portraitTune.offsetY },
                ],
              },
            ]}
            contentFit="contain"
            contentPosition="center"
          />
        </View>
        <View style={[styles.metaBlock, { width: previewSide }]}>
          <Text
            style={styles.characterName}
            numberOfLines={1}
            ellipsizeMode="tail">
            {character.name}
          </Text>
          <View style={styles.tagsRow}>
            {tags.map((tag, index) => (
              <View
                key={`${tag}-${index}`}
                style={[styles.tagPill, { backgroundColor: `${primary}28` }]}>
                <Text
                  style={[styles.tagText, { color: primary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  cardBase: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  slotNumberBase: {
    textAlign: "center",
    textAlignVertical: "center",
  },
  acquiredPressed: {
    opacity: 0.92,
  },
  /** 習得カード：上から積む（イラスト大・テキスト下）。影が親でクリップされないよう visible。 */
  acquiredCardLayout: {
    justifyContent: "flex-start",
    alignItems: "stretch",
    overflow: "visible",
  },
  /** 角丸内にテキストを収める（Pressable 側は影用に visible のまま） */
  acquiredClip: {
    flex: 1,
    overflow: "hidden",
    alignItems: "center",
    minWidth: 0,
    width: "100%",
  },
  /** ピーチ枠：正円近いスクエア・はみ出しクリップ */
  previewBlock: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  portraitFill: {
    width: "100%",
    height: "100%",
  },
  metaBlock: {
    flex: 1,
    alignSelf: "center",
    paddingBottom: 8,
    paddingTop: 6,
    justifyContent: "flex-start",
    minWidth: 0,
  },
  characterName: {
    fontSize: 14,
    fontWeight: "700",
    width: "100%",
    color: "#000000",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 4,
    marginTop: 4,
    width: "100%",
    minWidth: 0,
  },
  tagPill: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
    width: "100%",
    textAlign: "center",
  },
});
