import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CharacterInfoModal } from "@/components/pairing/CharacterInfoModal";
import { CollectionSlotCard } from "@/components/pairing/CollectionSlotCard";
import { usePairingSession } from "@/hooks/usePairingSession";
import { getCatalogEntryAtSlotIndex } from "@/lib/characterCatalog";
import { normalizeCharacterId } from "@/lib/normalizeCharacterId";
import { parsePairingLink } from "@/lib/pairing";
import type { AcquiredCharacterPayload, PairingInfo } from "@/lib/pairing/types";

// アセット：posture-app の PNG をそのまま流用する。
const LOGO_WHITE_IMAGE = require("../assets/images/logo_white.png");
const ANAGO_IMAGE = require("../assets/images/normal-nago.png");
const QR_FRAME_IMAGE = require("../assets/images/QR.png");
// 日本語: QR 接続直後の触覚設定ガイド（3 ステップ画像）
const HAPTICS_GUIDE_STEP_IMAGES = [
  require("../assets/images/set1.png"),
  require("../assets/images/set2.png"),
  require("../assets/images/set3.png"),
] as const;
/** 日本語: 各 PNG の実ピクセル比（高さ/幅）— 固定アスペクトで余白が空かないようにする */
const HAPTICS_GUIDE_STEP_HEIGHT_OVER_WIDTH = [228 / 460, 292 / 460, 354 / 462] as const;
// 日本語: PC 側で良い姿勢を登録中のときのキャラ画像
const GOOD_POSTURE_REGISTER_CHARACTER_IMAGE = require("../assets/images/happy.png");
// 日本語: 姿勢アラート時のバイブと同期する携帯振動系SE（ループ再生）
const VIBE_LOOP_SOUND = require("../assets/sounds/Cell_Phone-Vibration01-1(Cushion).mp3");
const AnimatedImage = Animated.createAnimatedComponent(Image);

// Figma `mobile/ホーム` フレーム基準のキャンバス幅。
const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
/** 日本語: タブレット・ブラウザ幅でコラムを広げすぎない（Figma 390 付近を維持） */
const MAX_PAIRING_LAYOUT_WIDTH = 456;
const COLLECTION_TOTAL = 111;
const COLLECTION_PAGE_SIZE = 8;

// 互換用の基準スケール（非ホーム領域の既存スタイルで利用）。
const SCALE = 1;
const px = (value: number) => value * SCALE;
const SCAN_GUIDE_RATIO = 0.62;
const SCAN_GUIDE_MIN = 200;
const SCAN_GUIDE_MAX = 360;
const ACQUIRED_CARDS_STORAGE_KEY = "PAIRING_ACQUIRED_CARDS_V1";
const LAST_PAIRING_INFO_STORAGE_KEY = "PAIRING_LAST_PAIRING_INFO_V1";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isAcquiredCharacterPayloadLike(value: unknown): value is AcquiredCharacterPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.measurementId === "string" &&
    candidate.measurementId.length > 0 &&
    typeof candidate.characterId === "string" &&
    candidate.characterId.length > 0
  );
}

function isPairingInfoLike(value: unknown): value is PairingInfo {
  if (!value || typeof value !== "object") {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.host === "string" &&
    o.host.length > 0 &&
    typeof o.port === "number" &&
    Number.isFinite(o.port) &&
    typeof o.token === "string" &&
    o.token.length > 0 &&
    (o.httpProtocol === "http" || o.httpProtocol === "https") &&
    (o.wsProtocol === "ws" || o.wsProtocol === "wss")
  );
}

export default function PairingTestScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const logoAnim = useRef(new Animated.Value(0)).current;
  const anagoAnim = useRef(new Animated.Value(0)).current;
  const measureVibeAnim = useRef(new Animated.Value(0)).current;
  const vibeLoopSoundRef = useRef<Audio.Sound | null>(null);
  /** 同じ measurementId の再送でカード詳細モーダルを繰り返さない */
  const shownAcquisitionModalFor = useRef(new Set<string>());
  const hasHydratedAcquiredCards = useRef(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [visibleCollectionCount, setVisibleCollectionCount] = useState(COLLECTION_PAGE_SIZE);
  const [hasScanned, setHasScanned] = useState(false);
  /** 日本語: QR スキャンでペア成功後に表示する触覚 ON 案内（iOS のみ） */
  const [postQrHapticsGuideVisible, setPostQrHapticsGuideVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isBadPosture, setIsBadPosture] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [acquiredCards, setAcquiredCards] = useState<AcquiredCharacterPayload[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailModalPayload, setDetailModalPayload] = useState<AcquiredCharacterPayload | null>(
    null,
  );
  const {
    pairResponse,
    lastSocketEvent,
    lastAcquiredDispatch,
    isPairing,
    isSocketConnected,
    measuringSessionActive,
    goodPostureRegistrationActive,
    error,
    startPairing,
    startSocket,
    disconnect,
  } = usePairingSession();
  const acquiredByCharacterId = useMemo(() => {
    const map = new Map<string, AcquiredCharacterPayload>();
    for (const card of acquiredCards) {
      map.set(normalizeCharacterId(card.characterId), card);
    }
    return map;
  }, [acquiredCards]);

  const acquiredCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < COLLECTION_TOTAL; i++) {
      const entry = getCatalogEntryAtSlotIndex(i);
      if (entry && acquiredByCharacterId.has(entry.id)) {
        count++;
      }
    }
    return count;
  }, [acquiredByCharacterId]);

  const closeDetailModal = useCallback(() => {
    setDetailModalVisible(false);
    setDetailModalPayload(null);
  }, []);

  const isConnected = Boolean(pairResponse);
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const isLandscape = width > height;
  const layoutWidth = Math.min(width, MAX_PAIRING_LAYOUT_WIDTH);
  const layoutScale = clamp(shortEdge / DESIGN_WIDTH, 0.78, 1.24);
  const sx = useCallback((value: number) => value * layoutScale, [layoutScale]);
  const heroHeight = clamp(
    isLandscape ? shortEdge * 0.4 : longEdge * 0.41,
    sx(isLandscape ? 220 : 280),
    sx(isLandscape ? 340 : 410),
  );
  const logoWidth = clamp(layoutWidth * 0.72, sx(220), sx(300));
  const logoHeight = logoWidth * (100 / 280);
  const logoTop = clamp(heroHeight * 0.12, sx(30), sx(64));
  const qrButtonWidth = clamp(layoutWidth * 0.44, sx(148), sx(190));
  const qrButtonHeight = clamp(longEdge * 0.06, sx(46), sx(56));
  const qrLeft = clamp(layoutWidth * 0.095, sx(20), sx(44));
  const qrTop = clamp(heroHeight * 0.45, sx(130), sx(188));
  const qrHintWidth = clamp(layoutWidth * 0.46, sx(160), sx(220));
  const qrButtonRadius = clamp(qrButtonHeight / 2, sx(23), sx(30));
  const qrButtonLabelFont = clamp(layoutWidth * 0.041, sx(14), sx(18));
  const qrButtonLabelLine = qrButtonLabelFont * 1.2;
  const qrHintFont = clamp(layoutWidth * 0.031, sx(11), sx(14));
  const qrHintLine = clamp(qrHintFont * 1.8, sx(18), sx(26));
  const anagoWidth = clamp(layoutWidth * 0.29, sx(96), sx(132));
  const anagoHeight = anagoWidth * (176 / 112);
  const anagoTop = clamp(heroHeight * 0.39, sx(122), sx(194));
  const anagoRight = clamp(layoutWidth * -0.02, -sx(10), sx(4));
  // 日本語: ヒーロー内で QR・案内文がはみ出さないよう詰める（低い画面・横向き）
  const heroPackBottom = heroHeight - sx(10);
  let heroLogoTop = logoTop;
  let heroQrTop = Math.max(qrTop, heroLogoTop + logoHeight + sx(8));
  let heroQrHintTop = heroQrTop + qrButtonHeight + sx(14);
  let heroQrHintFont = qrHintFont;
  let heroQrHintLine = qrHintLine;
  const heroHintLines = 2;
  const recomputeHeroHintTop = () => {
    heroQrHintTop = heroQrTop + qrButtonHeight + sx(14);
  };
  if (heroQrHintTop + heroHintLines * heroQrHintLine > heroPackBottom) {
    heroQrHintLine = Math.max(sx(14), (heroPackBottom - heroQrHintTop) / heroHintLines);
    heroQrHintFont = clamp(heroQrHintLine / 1.8, sx(10), qrHintFont);
    heroQrHintLine = heroQrHintFont * 1.8;
  }
  if (heroQrHintTop + heroHintLines * heroQrHintLine > heroPackBottom) {
    const overflow = heroQrHintTop + heroHintLines * heroQrHintLine - heroPackBottom;
    heroQrTop = Math.max(heroLogoTop + logoHeight + sx(4), heroQrTop - overflow);
    recomputeHeroHintTop();
  }
  if (heroQrHintTop + heroHintLines * heroQrHintLine > heroPackBottom) {
    const overflow = heroQrHintTop + heroHintLines * heroQrHintLine - heroPackBottom;
    heroLogoTop = Math.max(sx(8), heroLogoTop - overflow);
    heroQrTop = Math.max(heroLogoTop + logoHeight + sx(4), qrTop);
    recomputeHeroHintTop();
    if (heroQrHintTop + heroHintLines * heroQrHintLine > heroPackBottom) {
      heroQrHintLine = Math.max(sx(14), (heroPackBottom - heroQrHintTop) / heroHintLines);
      heroQrHintFont = clamp(heroQrHintLine / 1.8, sx(10), qrHintFont);
      heroQrHintLine = heroQrHintFont * 1.8;
    }
  }
  let heroAnagoTop = anagoTop;
  if (heroAnagoTop + anagoHeight > heroHeight - sx(2)) {
    heroAnagoTop = Math.max(sx(36), heroHeight - sx(2) - anagoHeight);
  }
  const contentMinHeight = Math.max(longEdge - insets.top, sx(DESIGN_HEIGHT));
  // 日本語: Figma モバイル（390 幅）基準の値を等比スケールで固定する。
  // 日本語: コレクションカード幅をわずかに確保（長い性格タグの余裕）
  const collectionPaddingHorizontal = sx(30);
  // 日本語: コレクション見出し（文字・数字）の上余白は左右余白と同値に揃える。
  const collectionPaddingTop = collectionPaddingHorizontal;
  const collectionPaddingBottom = sx(40);
  // 日本語: 白シートをヒーローに重ねる量（マイナス絶対値を大きくするとさらに上）。ホーム UI 表示時のみ効く。
  const collectionMarginTop = -sx(65);
  const collectionRadius = sx(28);
  const collectionHeaderBottom = sx(20);
  const collectionLabelFont = sx(16);
  const collectionLabelLine = sx(19);
  const collectionCountFont = sx(32);
  const collectionCountLine = sx(38);
  const collectionSubFont = sx(16);
  const collectionSubLine = sx(19);
  const collectionGap = clamp(layoutWidth * 0.042, sx(11), sx(18));
  const collectionCardWidth =
    (layoutWidth - collectionPaddingHorizontal * 2 - collectionGap) / 2;
  const collectionCardHeight = collectionCardWidth * (199 / 152.72);
  const collectionCardRadius = clamp(collectionCardWidth * 0.125, sx(14), sx(24));
  const collectionCardLabelFont = clamp(collectionCardWidth * 0.18, sx(22), sx(32));
  const collectionCardLabelLine = collectionCardLabelFont * 1.2;
  const collectionCardLabelBoxWidth = collectionCardWidth * (50 / 152.72);
  const collectionCardLabelBoxHeight = collectionCardHeight * (33 / 199);
  const collectionGridMarginTop = clamp(height * 0.012, sx(8), sx(14));
  const collectionMoreMarginTop = clamp(height * 0.018, sx(10), sx(16));
  const collectionMorePadX = clamp(layoutWidth * 0.041, sx(12), sx(18));
  const collectionMorePadY = clamp(height * 0.01, sx(6), sx(10));
  const collectionMoreFont = clamp(layoutWidth * 0.033, sx(11), sx(14));
  const errorMarginTop = clamp(height * 0.012, sx(8), sx(12));
  const errorFont = clamp(layoutWidth * 0.034, sx(12), sx(14));
  const measureCardSize = clamp(layoutWidth * 0.82, sx(300), sx(352));
  const measureCardRadius = clamp(measureCardSize * 0.075, sx(20), sx(28));
  const measureTitleFont = clamp(layoutWidth * 0.082, sx(28), sx(36));
  const measureTitleLine = measureTitleFont * 1.18;
  const measureTitleTop = measureCardSize * (28 / 320);
  // 日本語: トグル行は Figma 基準 y=88（320 フレーム基準）に固定する。
  const measureToggleTop = measureCardSize * (88 / 320);
  const measureToggleWidth = measureCardSize * (270 / 320);
  const measureToggleHeight = measureCardSize * (64 / 320);
  const measureToggleLeft = (measureCardSize - measureToggleWidth) / 2;
  const measureToggleRadius = clamp(measureToggleHeight * 0.26, sx(14), sx(20));
  const measureTogglePadX = measureCardSize * (24 / 320);
  const measureToggleFont = clamp(layoutWidth * 0.054, sx(18), sx(22));
  const measureToggleLine = measureToggleFont * 1.2;
  const measureAnagoWidth = measureCardSize * (96 / 320);
  const measureAnagoHeight = measureCardSize * (144 / 320);
  const measureAnagoTop = measureCardSize * (214 / 320);
  const measureAnagoLeft = (measureCardSize - measureAnagoWidth) / 2;
  // 日本語: 「測定中」見出しに対して約 3/4 の見え方になるようロゴ幅を連動させる。
  const measureLogoWidth = clamp(measureTitleFont * 3.4, sx(150), sx(220));
  const measureLogoHeight = measureLogoWidth * (19.5 / 56);
  // 日本語: ロゴをさらに上へ 40 相当シフトする。ノッチと被らないよう下限を付ける。
  const measureLogoTop = Math.max(
    insets.top + sx(6),
    insets.top + clamp(longEdge * (10 / 844), sx(6), sx(14)) - sx(40),
  );
  const measureContentTopPadding =
    insets.top +
    clamp(
      isLandscape ? shortEdge * 0.1 : longEdge * 0.16,
      isLandscape ? sx(48) : sx(96),
      isLandscape ? sx(120) : sx(190),
    );
  const registerCardSize = measureCardSize;
  const registerCardRadius = measureCardRadius;
  const registerTitleFont = sx(24);
  const registerTitleLine = sx(29);
  const registerTitleTop = registerCardSize * (32 / 320);
  const registerSubtitleFont = sx(16);
  const registerSubtitleLine = sx(19);
  const registerSubtitleTop = registerCardSize * (85 / 320);
  const registerAnagoWidth = registerCardSize * (168 / 320);
  const registerAnagoHeight = registerCardSize * (270 / 320);
  const registerAnagoTop = registerCardSize * (116 / 320);
  const registerAnagoLeft = (registerCardSize - registerAnagoWidth) / 2;
  // 日本語: 測定 UI は HTTP ペア済みかつ WS 接続中かつ PC 側が measuring のときのみ（切断時に古い状態で残さない）
  const isMeasuring = isConnected && isSocketConnected && measuringSessionActive;
  // 日本語: PC が良い姿勢登録フロー中（測定開始後は measuring UI が優先）
  const isRegisteringGoodPosture =
    isConnected && isSocketConnected && goodPostureRegistrationActive && !measuringSessionActive;
  const shouldVibeAnimate = isMeasuring && isBadPosture && hapticEnabled;

  const highlightQrForLink = !pairResponse && !isPairing;
  const connectionBannerFont = clamp(layoutWidth * 0.032, sx(11), sx(13));
  const connectionBannerLine = connectionBannerFont * 1.45;
  // 日本語: 端末サイズ差を吸収するため、ガイドサイズを比率 + clamp で算出する。
  const scanGuideSize = clamp(shortEdge * SCAN_GUIDE_RATIO, SCAN_GUIDE_MIN, SCAN_GUIDE_MAX);
  const scannerCloseBottom = insets.bottom + px(20);
  // 日本語: QR 直後の触覚ガイド（参照デザイン：左右に余白、カード間は詰める）
  const hapticsGuideCardWidth = Math.min(sx(310), layoutWidth - sx(44));
  const hapticsGuideScrollPadTop = heroLogoTop + logoHeight + sx(10);
  const hapticsGuideTitleFont = clamp(layoutWidth * 0.058, sx(20), sx(26));
  const hapticsGuideTitleLine = hapticsGuideTitleFont * 1.15;
  const hapticsGuideSubtitleFont = clamp(layoutWidth * 0.038, sx(13), sx(15));
  const hapticsGuideSubtitleLine = hapticsGuideSubtitleFont * 1.35;
  const hapticsGuideHeaderGapAfterLogo = sx(8);
  const hapticsGuideHeaderToCardsGap = sx(14);
  const hapticsGuideStepGap = sx(8);
  const hapticsGuideOuterPad = sx(16);

  const animatedStyles = useMemo(() => {
    const logoTranslateY = logoAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, -sx(2), 0],
    });
    const logoOpacity = logoAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.94, 1, 0.94],
    });
    const anagoTranslateY = anagoAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, sx(3), 0],
    });
    const anagoRotate = anagoAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: ["-1.2deg", "1.2deg", "-1.2deg"],
    });
    // 日本語: 測定中の振動演出は中程度の強さ（微細な左右揺れ + 残像）に揃える。
    const measureVibeTranslateX = measureVibeAnim.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: [-sx(2.4), sx(3.2), -sx(2.8), sx(2), -sx(2.4)],
    });
    const ghostOpacityNear = measureVibeAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.2, 0.14, 0.2],
    });
    const ghostOpacityFar = measureVibeAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.16, 0.1, 0.16],
    });
    const ghostNearTranslateX = measureVibeAnim.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: [sx(1.6), -sx(2.2), sx(1.8), -sx(1.4), sx(1.6)],
    });
    const ghostFarTranslateX = measureVibeAnim.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: [sx(3.2), -sx(2.8), sx(3.4), -sx(2.2), sx(3.2)],
    });

    return {
      logo: {
        transform: [{ translateY: logoTranslateY }],
        opacity: logoOpacity,
      },
      anago: {
        transform: [{ translateY: anagoTranslateY }, { rotate: anagoRotate }],
      },
      measureAnagoVibe: {
        transform: [{ translateX: measureVibeTranslateX }],
      },
      measureAnagoGhostNear: {
        opacity: ghostOpacityNear,
        transform: [{ translateX: ghostNearTranslateX }],
      },
      measureAnagoGhostFar: {
        opacity: ghostOpacityFar,
        transform: [{ translateX: ghostFarTranslateX }],
      },
    };
  }, [anagoAnim, logoAnim, measureVibeAnim, sx]);

  useEffect(() => {
    async function hydrateAcquiredCards() {
      try {
        const raw = await AsyncStorage.getItem(ACQUIRED_CARDS_STORAGE_KEY);
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          return;
        }
        const restored = parsed
          .filter(isAcquiredCharacterPayloadLike)
          .map((card) => ({
            ...card,
            characterId: normalizeCharacterId(card.characterId),
          }));
        setAcquiredCards(restored);
      } catch (storageError) {
        console.warn("failed to restore acquired cards", storageError);
      } finally {
        hasHydratedAcquiredCards.current = true;
      }
    }

    void hydrateAcquiredCards();
  }, []);

  // 日本語: 前回 QR で保存した PairingInfo を復元し、再スキャンなしで pair + WS を再試行する
  useEffect(() => {
    let cancelled = false;

    async function restoreLastPairingSession() {
      try {
        const raw = await AsyncStorage.getItem(LAST_PAIRING_INFO_STORAGE_KEY);
        if (!raw || cancelled) {
          return;
        }
        const parsed = JSON.parse(raw) as unknown;
        if (!isPairingInfoLike(parsed)) {
          await AsyncStorage.removeItem(LAST_PAIRING_INFO_STORAGE_KEY);
          return;
        }
        const paired = await startPairing(parsed, getAutoDeviceName());
        if (cancelled) {
          return;
        }
        if (paired) {
          startSocket();
        } else {
          await AsyncStorage.removeItem(LAST_PAIRING_INFO_STORAGE_KEY);
        }
      } catch (restoreError) {
        console.warn("failed to restore pairing session", restoreError);
        try {
          await AsyncStorage.removeItem(LAST_PAIRING_INFO_STORAGE_KEY);
        } catch {
          /* 無視 */
        }
      }
    }

    void restoreLastPairingSession();

    return () => {
      cancelled = true;
    };
    // 日本語: マウント時のみ意図的に復元する（依存を増やすと二重ペアを招く）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only restore
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (pairResponse && !isSocketConnected && !isPairing) {
        startSocket();
      }
    }, [pairResponse, isSocketConnected, isPairing, startSocket]),
  );

  useEffect(() => {
    if (!hasHydratedAcquiredCards.current) {
      return;
    }
    async function persistAcquiredCards() {
      try {
        await AsyncStorage.setItem(ACQUIRED_CARDS_STORAGE_KEY, JSON.stringify(acquiredCards));
      } catch (storageError) {
        console.warn("failed to persist acquired cards", storageError);
      }
    }
    void persistAcquiredCards();
  }, [acquiredCards]);

  useEffect(() => {
    if (!scannerVisible) {
      setHasScanned(false);
    }
  }, [scannerVisible]);

  useEffect(() => {
    if (lastSocketEvent?.type === "posture_bad") {
      setIsBadPosture(true);
      return;
    }
    if (lastSocketEvent?.type === "posture_good") {
      setIsBadPosture(false);
    }
    if (lastSocketEvent?.type === "acquired_characters_cleared") {
      setAcquiredCards([]);
      shownAcquisitionModalFor.current.clear();
      setDetailModalPayload(null);
      setDetailModalVisible(false);
      void AsyncStorage.removeItem(ACQUIRED_CARDS_STORAGE_KEY);
    }
  }, [lastSocketEvent]);

  // 日本語: PC がセッション終了（切断・ペア解除）したらモバイルもホーム相当へ戻す
  useEffect(() => {
    const ev = lastSocketEvent;
    if (!ev || !pairResponse) {
      return;
    }
    const serverEndedPairing =
      ev.type === "disconnected" || (ev.type === "snapshot" && ev.paired === false);
    if (!serverEndedPairing) {
      return;
    }
    setPostQrHapticsGuideVisible(false);
    setDetailModalVisible(false);
    setDetailModalPayload(null);
    void AsyncStorage.removeItem(LAST_PAIRING_INFO_STORAGE_KEY);
    void disconnect();
  }, [disconnect, lastSocketEvent, pairResponse]);

  // 日本語: QR 直後ガイドに閉じるがないため、PC の良い姿勢登録開始または測定開始で次画面へ進む
  useEffect(() => {
    if (!postQrHapticsGuideVisible) {
      return;
    }
    const ev = lastSocketEvent;
    const pcStartedGoodRegistration =
      ev?.type === "good_posture_registration_started" ||
      (goodPostureRegistrationActive && !measuringSessionActive);
    const pcStartedMeasuring = ev?.type === "measuring_started" || measuringSessionActive;
    if (pcStartedGoodRegistration || pcStartedMeasuring) {
      setPostQrHapticsGuideVisible(false);
    }
  }, [
    goodPostureRegistrationActive,
    lastSocketEvent,
    measuringSessionActive,
    postQrHapticsGuideVisible,
  ]);

  useEffect(() => {
    if (!lastAcquiredDispatch) {
      return;
    }
    const payload = lastAcquiredDispatch.payload;
    setAcquiredCards((current) => {
      if (current.some((card) => card.measurementId === payload.measurementId)) {
        return current;
      }
      const withoutSameCharacter = current.filter((card) => card.characterId !== payload.characterId);
      return [...withoutSameCharacter, payload];
    });
    if (!shownAcquisitionModalFor.current.has(payload.measurementId)) {
      shownAcquisitionModalFor.current.add(payload.measurementId);
      setDetailModalPayload(payload);
      setDetailModalVisible(true);
    }
  }, [lastAcquiredDispatch]);

  useEffect(() => {
    if (!isSocketConnected || !isBadPosture || !hapticEnabled) {
      if (Platform.OS !== "web") {
        Vibration.cancel();
      }
      return;
    }

    if (Platform.OS === "web") {
      return;
    }

    // expo-haptics は使わず Vibration API のみ（Android はパターン、iOS は単発を繰り返し）。
    if (Platform.OS === "android") {
      Vibration.vibrate([0, 900, 350], true);
      return () => Vibration.cancel();
    }

    const pulse = () => {
      Vibration.vibrate();
    };
    pulse();
    const intervalId = setInterval(pulse, 900);

    return () => {
      clearInterval(intervalId);
      Vibration.cancel();
    };
  }, [hapticEnabled, isBadPosture, isSocketConnected]);

  useEffect(() => {
    if (!isSocketConnected || !isBadPosture || !hapticEnabled) {
      const orphan = vibeLoopSoundRef.current;
      vibeLoopSoundRef.current = null;
      if (orphan) {
        void orphan.stopAsync().then(() => orphan.unloadAsync()).catch(() => {});
      }
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(VIBE_LOOP_SOUND, { isLooping: true });
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        vibeLoopSoundRef.current = sound;
        await sound.playAsync();
      } catch (e) {
        console.warn("vibe loop sound failed", e);
      }
    })();

    return () => {
      cancelled = true;
      const s = vibeLoopSoundRef.current;
      vibeLoopSoundRef.current = null;
      if (s) {
        void s.stopAsync().then(() => s.unloadAsync()).catch(() => {});
      }
    };
  }, [hapticEnabled, isBadPosture, isSocketConnected]);

  useEffect(() => {
    const runningAnimations: Animated.CompositeAnimation[] = [];
    const logoLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoAnim, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const anagoLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(anagoAnim, {
          toValue: 1,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anagoAnim, {
          toValue: 0,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    logoLoop.start();
    anagoLoop.start();
    runningAnimations.push(logoLoop, anagoLoop);

    return () => {
      runningAnimations.forEach((animation) => animation.stop());
    };
  }, [anagoAnim, logoAnim]);

  useEffect(() => {
    if (!shouldVibeAnimate) {
      measureVibeAnim.stopAnimation();
      measureVibeAnim.setValue(0);
      return;
    }
    const vibeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(measureVibeAnim, {
          toValue: 1,
          duration: 120,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(measureVibeAnim, {
          toValue: 0,
          duration: 120,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    vibeLoop.start();
    return () => {
      vibeLoop.stop();
      measureVibeAnim.setValue(0);
    };
  }, [measureVibeAnim, shouldVibeAnimate]);

  async function handleConnectFromLink(link: string): Promise<boolean> {
    const parsed = parsePairingLink(link);
    if (!parsed.ok) {
      setLocalError(parsed.reason);
      return false;
    }
    setLocalError(null);
    const paired = await startPairing(parsed.pairingInfo, getAutoDeviceName());
    if (paired) {
      try {
        await AsyncStorage.setItem(
          LAST_PAIRING_INFO_STORAGE_KEY,
          JSON.stringify(parsed.pairingInfo),
        );
      } catch (persistError) {
        console.warn("failed to persist pairing info", persistError);
      }
      startSocket();
      return true;
    }
    return false;
  }

  const handleRetrySocket = useCallback(() => {
    startSocket();
  }, [startSocket]);

  async function handleOpenScanner() {
    if (Platform.OS === "web") {
      setLocalError("QRスキャンはモバイル端末のカメラでのみ利用できます。");
      return;
    }
    const currentPermission = permission?.granted
      ? permission
      : await requestPermission();
    if (!currentPermission?.granted) {
      setLocalError("カメラ権限が必要です。");
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
    const pairedOk = await handleConnectFromLink(result.data);
    if (pairedOk) {
      setPostQrHapticsGuideVisible(true);
    }
  }

  // 日本語: QR 直後の触覚案内は測定 UI より優先（接続直後に measuring へ切り替わっても必ず一度表示する）
  if (postQrHapticsGuideVisible) {
    return (
      <Fragment>
        <View style={[styles.screen, styles.hapticsGuideScreenRoot]}>
          <LinearGradient
            colors={["#34add5", "#e0e4c9"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              flex: 1,
              width: layoutWidth,
              maxWidth: MAX_PAIRING_LAYOUT_WIDTH,
              alignSelf: "center",
            }}>
            <Animated.View
              style={[
                styles.logo,
                animatedStyles.logo,
                {
                  left: (layoutWidth - logoWidth) / 2,
                  top: heroLogoTop,
                  width: logoWidth,
                  height: logoHeight,
                },
              ]}>
              <Image source={LOGO_WHITE_IMAGE} style={styles.fill} contentFit="contain" />
            </Animated.View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.hapticsGuideScrollContent,
                {
                  paddingTop: hapticsGuideScrollPadTop,
                  paddingBottom: insets.bottom + sx(20),
                },
              ]}
              showsVerticalScrollIndicator={false}>
            <View
              style={[
                styles.hapticsGuideOuterSheet,
                {
                  width: hapticsGuideCardWidth + hapticsGuideOuterPad * 2,
                  padding: hapticsGuideOuterPad,
                  borderRadius: sx(24),
                  shadowRadius: sx(8.52),
                },
              ]}>
              <View style={{ alignItems: "center", width: "100%" }}>
                <Text
                  style={[
                    styles.hapticsGuideTitle,
                    {
                      marginTop: hapticsGuideHeaderGapAfterLogo,
                      fontSize: hapticsGuideTitleFont,
                      lineHeight: hapticsGuideTitleLine,
                    },
                  ]}>
                  接続完了
                </Text>
                <Text
                  style={[
                    styles.hapticsGuideSubtitle,
                    {
                      marginTop: sx(6),
                      marginBottom: hapticsGuideHeaderToCardsGap,
                      fontSize: hapticsGuideSubtitleFont,
                      lineHeight: hapticsGuideSubtitleLine,
                      paddingHorizontal: sx(12),
                    },
                  ]}>
                  スマホの触覚をONにしてください
                </Text>
                {HAPTICS_GUIDE_STEP_IMAGES.map((source, index) => {
                  const stepHeight =
                    hapticsGuideCardWidth * HAPTICS_GUIDE_STEP_HEIGHT_OVER_WIDTH[index];
                  return (
                    <View
                      key={`haptics-step-${index}`}
                      style={[
                        styles.hapticsGuideStepCard,
                        {
                          width: hapticsGuideCardWidth,
                          borderRadius: sx(20),
                          marginBottom:
                            index < HAPTICS_GUIDE_STEP_IMAGES.length - 1
                              ? hapticsGuideStepGap
                              : 0,
                          shadowRadius: sx(6),
                        },
                      ]}>
                      <Image
                        source={source}
                        style={{
                          width: hapticsGuideCardWidth,
                          height: stepHeight,
                          borderRadius: sx(20),
                        }}
                        contentFit="contain"
                      />
                    </View>
                  );
                })}
              </View>
            </View>
            </ScrollView>
          </View>
        </View>
        <CharacterInfoModal
          visible={detailModalVisible}
          payload={detailModalPayload}
          onClose={closeDetailModal}
        />
      </Fragment>
    );
  }

  if (isRegisteringGoodPosture) {
    return (
      <Fragment>
        <View style={styles.screen}>
          <LinearGradient
            colors={["#34add5", "#e0e4c9"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[
              styles.measureScreenBackground,
              { paddingTop: measureContentTopPadding, width: "100%" },
            ]}>
            <View
              style={{
                flex: 1,
                width: layoutWidth,
                maxWidth: MAX_PAIRING_LAYOUT_WIDTH,
                alignSelf: "center",
                alignItems: "center",
              }}>
              <StatusBar style="light" />
              <Image
                source={LOGO_WHITE_IMAGE}
                style={[
                  styles.measureTopLogo,
                  {
                    top: measureLogoTop,
                    left: (layoutWidth - measureLogoWidth) / 2,
                    width: measureLogoWidth,
                    height: measureLogoHeight,
                  },
                ]}
                contentFit="contain"
              />
              <View
                style={[
                  styles.registerCardOuter,
                  {
                    width: registerCardSize,
                    borderRadius: registerCardRadius,
                    shadowRadius: sx(8.52),
                  },
                ]}>
                <View
                  style={[
                    styles.registerCardInner,
                    {
                      width: registerCardSize,
                      height: registerCardSize,
                      borderRadius: registerCardRadius,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.registerPostureTitle,
                      {
                        top: registerTitleTop,
                        fontSize: registerTitleFont,
                        lineHeight: registerTitleLine,
                      },
                    ]}>
                    良い姿勢を登録中
                  </Text>
                  <Text
                    style={[
                      styles.registerPostureSubtitle,
                      {
                        top: registerSubtitleTop,
                        fontSize: registerSubtitleFont,
                        lineHeight: registerSubtitleLine,
                      },
                    ]}>
                    PCで姿勢登録をしてください
                  </Text>
                  <Image
                    source={GOOD_POSTURE_REGISTER_CHARACTER_IMAGE}
                    style={{
                      position: "absolute",
                      left: registerAnagoLeft,
                      top: registerAnagoTop,
                      width: registerAnagoWidth,
                      height: registerAnagoHeight,
                    }}
                    contentFit="contain"
                  />
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
        <CharacterInfoModal
          visible={detailModalVisible}
          payload={detailModalPayload}
          onClose={closeDetailModal}
        />
      </Fragment>
    );
  }

  if (isMeasuring) {
    return (
      <Fragment>
        <View style={styles.screen}>
          <LinearGradient
            colors={["#34add5", "#e0e4c9"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[
              styles.measureScreenBackground,
              { paddingTop: measureContentTopPadding, width: "100%" },
            ]}>
            <View
              style={{
                flex: 1,
                width: layoutWidth,
                maxWidth: MAX_PAIRING_LAYOUT_WIDTH,
                alignSelf: "center",
                alignItems: "center",
              }}>
              <Image
                source={LOGO_WHITE_IMAGE}
                style={[
                  styles.measureTopLogo,
                  {
                    top: measureLogoTop,
                    left: (layoutWidth - measureLogoWidth) / 2,
                    width: measureLogoWidth,
                    height: measureLogoHeight,
                  },
                ]}
                contentFit="contain"
              />
              <View
                style={[
                  styles.measureCard,
                  {
                    width: measureCardSize,
                    height: measureCardSize,
                    borderRadius: measureCardRadius,
                  },
                ]}>
                <Text
                  style={[
                    styles.measureTitle,
                    {
                      top: measureTitleTop,
                      fontSize: measureTitleFont,
                      lineHeight: measureTitleLine,
                    },
                  ]}>
                  測定中
                </Text>
                <View
                  style={[
                    styles.measureToggleRow,
                    {
                      left: measureToggleLeft,
                      top: measureToggleTop,
                      width: measureToggleWidth,
                      height: measureToggleHeight,
                      borderRadius: measureToggleRadius,
                      paddingHorizontal: measureTogglePadX,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.measureToggleLabel,
                      { fontSize: measureToggleFont, lineHeight: measureToggleLine },
                    ]}>
                    触覚
                  </Text>
                  <View style={styles.measureSwitchWrap}>
                    <Switch
                      value={hapticEnabled}
                      onValueChange={setHapticEnabled}
                      trackColor={{ false: "#c8c8c8", true: "#13a2d7" }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>
                <Animated.View
                  style={[
                    styles.measureAnago,
                    {
                      left: measureAnagoLeft,
                      top: measureAnagoTop,
                      width: measureAnagoWidth,
                      height: measureAnagoHeight,
                    },
                    shouldVibeAnimate && animatedStyles.measureAnagoVibe,
                  ]}>
                  {shouldVibeAnimate ? (
                    <Fragment>
                      <AnimatedImage
                        source={ANAGO_IMAGE}
                        style={[styles.measureAnagoGhost, animatedStyles.measureAnagoGhostFar]}
                        contentFit="contain"
                      />
                      <AnimatedImage
                        source={ANAGO_IMAGE}
                        style={[styles.measureAnagoGhost, animatedStyles.measureAnagoGhostNear]}
                        contentFit="contain"
                      />
                    </Fragment>
                  ) : null}
                  <Image source={ANAGO_IMAGE} style={styles.fill} contentFit="contain" />
                </Animated.View>
              </View>
            </View>
          </LinearGradient>
        </View>
        <CharacterInfoModal
          visible={detailModalVisible}
          payload={detailModalPayload}
          onClose={closeDetailModal}
        />
      </Fragment>
    );
  }

  return (
    <Fragment>
    <View style={styles.screen}>
      <View
        style={{
          flex: 1,
          width: layoutWidth,
          maxWidth: MAX_PAIRING_LAYOUT_WIDTH,
          alignSelf: "center",
        }}>
      <ScrollView contentContainerStyle={[styles.content, { minHeight: contentMinHeight }]}>
        {/* 上部グラデーション帯（Figma Frame 43：高さ 346） */}
        <LinearGradient
          colors={["#34add5", "#e0e4c9"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.heroGradient, { height: heroHeight }]}>

          {/* ロゴ：中央配置（Figma Frame 15：56×19.5） */}
          <Animated.View
            style={[
              styles.logo,
              animatedStyles.logo,
              {
                left: (layoutWidth - logoWidth) / 2,
                top: heroLogoTop,
                width: logoWidth,
                height: logoHeight,
              },
            ]}>
            <Image source={LOGO_WHITE_IMAGE} style={styles.fill} contentFit="contain" />
          </Animated.View>

          {/* QRスキャンボタン（Figma ボタン：170×51 / radius 100） */}
          <Pressable
            disabled={isPairing}
            onPress={() => void handleOpenScanner()}
            style={({ pressed }) => [
              styles.qrButton,
              highlightQrForLink && styles.qrButtonEmphasized,
              {
                left: qrLeft,
                top: heroQrTop,
                width: qrButtonWidth,
                height: qrButtonHeight,
                borderRadius: qrButtonRadius,
                shadowRadius: sx(12),
                shadowOffset: { width: 0, height: sx(6) },
              },
              pressed && styles.qrButtonPressed,
            ]}>
            <Text
              style={[
                styles.qrButtonLabel,
                { fontSize: qrButtonLabelFont, lineHeight: qrButtonLabelLine },
              ]}>
              QRをスキャン
            </Text>
          </Pressable>

          {/* 案内文（Figma：12px / lineHeight 24） */}
          <Text
            style={[
              styles.qrHint,
              {
                left: qrLeft,
                top: heroQrHintTop,
                width: qrHintWidth,
                fontSize: heroQrHintFont,
                lineHeight: heroQrHintLine,
              },
            ]}>
            PCに表示されているQRコードを{"\n"}読み取ってください
          </Text>

          {/* 右側のアナゴ（Figma Frame 30：x=258 / 74×482） */}
          <Animated.View
            style={[
              styles.heroAnago,
              animatedStyles.anago,
              {
                right: anagoRight,
                top: heroAnagoTop,
                width: anagoWidth,
                height: anagoHeight,
              },
            ]}>
            <Image source={ANAGO_IMAGE} style={styles.fill} contentFit="contain" />
          </Animated.View>
        </LinearGradient>

        {/* コレクションシート（Figma Frame 42：bg #FDFDFD / y=291） */}
        <View
          style={[
            styles.collectionSheet,
            {
              paddingHorizontal: collectionPaddingHorizontal,
              paddingTop: collectionPaddingTop,
              paddingBottom: collectionPaddingBottom,
              marginTop: collectionMarginTop,
              borderTopLeftRadius: collectionRadius,
              borderTopRightRadius: collectionRadius,
            },
          ]}>
          {/* ヘッダー：コレクション 0 / 111 */}
          <View style={[styles.collectionHeader, { marginBottom: collectionHeaderBottom }]}>
            <Text
              style={[
                styles.collectionLabel,
                {
                  fontSize: collectionLabelFont,
                  lineHeight: collectionLabelLine,
                  marginRight: sx(23),
                  paddingBottom: sx(2),
                },
              ]}>
              コレクション
            </Text>
            <Text
              style={[
                styles.collectionCount,
                {
                  fontSize: collectionCountFont,
                  lineHeight: collectionCountLine,
                  marginRight: sx(8),
                },
              ]}>
              {acquiredCount}
            </Text>
            <Text
              style={[
                styles.collectionDivider,
                {
                  fontSize: collectionSubFont,
                  lineHeight: collectionSubLine,
                  marginRight: sx(5),
                  paddingBottom: sx(2),
                },
              ]}>
              /
            </Text>
            <Text
              style={[
                styles.collectionTotal,
                {
                  fontSize: collectionSubFont,
                  lineHeight: collectionSubLine,
                  paddingBottom: sx(2),
                },
              ]}>
              {COLLECTION_TOTAL}
            </Text>
          </View>

          {/* 日本語: PC 連携状態の案内（未ペア / 接続確立中 / 切断のみ。HTTP+WS 済みで案内なしのときは枠を出さない） */}
          {(isPairing || !pairResponse || (pairResponse && !isSocketConnected)) ? (
            <View
              style={[
                styles.connectionBanner,
                {
                  marginBottom: collectionHeaderBottom,
                  paddingVertical: sx(10),
                  paddingHorizontal: sx(12),
                  borderRadius: sx(12),
                },
              ]}>
            {isPairing ? (
              <Text
                style={[
                  styles.connectionBannerText,
                  { fontSize: connectionBannerFont, lineHeight: connectionBannerLine },
                ]}>
                PCとの接続を確立しています…
              </Text>
            ) : null}
            {!isPairing && !pairResponse ? (
              <Fragment>
                <Text
                  style={[
                    styles.connectionBannerText,
                    { fontSize: connectionBannerFont, lineHeight: connectionBannerLine },
                  ]}>
                  PCの姿勢測定と同期するには、QRコードのスキャンが必要です。
                </Text>
                {acquiredCount > 0 ? (
                  <Text
                    style={[
                      styles.connectionBannerMuted,
                      {
                        fontSize: connectionBannerFont,
                        lineHeight: connectionBannerLine,
                        marginTop: sx(6),
                      },
                    ]}>
                    コレクションのカードはこの端末に保存されています（アプリを閉じても残ります）。PC連携とは別です。
                  </Text>
                ) : null}
              </Fragment>
            ) : null}
            {!isPairing && pairResponse && !isSocketConnected ? (
              <Fragment>
                <Text
                  style={[
                    styles.connectionBannerText,
                    { fontSize: connectionBannerFont, lineHeight: connectionBannerLine },
                  ]}>
                  リアルタイム通信が切断されています。PCで測定を開始しても、この画面は切り替わりません。再接続するか、QRを再スキャンしてください。
                </Text>
                <Pressable
                  onPress={handleRetrySocket}
                  style={({ pressed }) => [
                    styles.connectionRetryButton,
                    {
                      marginTop: sx(10),
                      paddingVertical: sx(8),
                      paddingHorizontal: sx(14),
                      borderRadius: sx(999),
                    },
                    pressed && styles.connectionRetryButtonPressed,
                  ]}>
                  <Text
                    style={[
                      styles.connectionRetryLabel,
                      { fontSize: connectionBannerFont, lineHeight: connectionBannerLine },
                    ]}>
                    再接続を試す
                  </Text>
                </Pressable>
              </Fragment>
            ) : null}
            </View>
          ) : null}

          <View
            style={[
              styles.collectionGrid,
              {
                marginTop: collectionGridMarginTop,
                columnGap: collectionGap,
                rowGap: collectionGap,
              },
            ]}>
            {Array.from({ length: Math.min(visibleCollectionCount, COLLECTION_TOTAL) }).map((_, index) => {
              const catalogEntry = getCatalogEntryAtSlotIndex(index);
              const acquiredPayload = catalogEntry
                ? acquiredByCharacterId.get(catalogEntry.id)
                : undefined;
              return (
                <CollectionSlotCard
                  key={`slot-${index}`}
                  slotNumber={index + 1}
                  width={collectionCardWidth}
                  height={collectionCardHeight}
                  borderRadius={collectionCardRadius}
                  catalogEntry={catalogEntry}
                  acquiredPayload={acquiredPayload}
                  labelFontSize={collectionCardLabelFont}
                  labelLineHeight={collectionCardLabelLine}
                  labelBoxWidth={collectionCardLabelBoxWidth}
                  labelBoxHeight={collectionCardLabelBoxHeight}
                  lockedCardStyle={[styles.collectionCard, styles.collectionCardLocked]}
                  acquiredCardStyle={[styles.collectionCard, styles.collectionCardAcquired]}
                  lockedLabelStyle={styles.collectionCardLabelLocked}
                  numberTextStyle={[styles.collectionCardNumber, styles.collectionCardLabel]}
                  onPressAcquired={
                    acquiredPayload
                      ? () => {
                          setDetailModalPayload(acquiredPayload);
                          setDetailModalVisible(true);
                        }
                      : undefined
                  }
                />
              );
            })}
          </View>

          {visibleCollectionCount < COLLECTION_TOTAL ? (
            <Pressable
              onPress={() =>
                setVisibleCollectionCount((current) =>
                  Math.min(current + COLLECTION_PAGE_SIZE, COLLECTION_TOTAL),
                )
              }
              style={[
                styles.collectionMoreButton,
                {
                  marginTop: collectionMoreMarginTop,
                  paddingHorizontal: collectionMorePadX,
                  paddingVertical: collectionMorePadY,
                },
              ]}>
              <Text style={[styles.collectionMoreText, { fontSize: collectionMoreFont }]}>
                さらに表示
              </Text>
            </Pressable>
          ) : null}

          {localError ? (
            <Text style={[styles.errorText, { marginTop: errorMarginTop, fontSize: errorFont }]}>
              {localError}
            </Text>
          ) : null}
          {error ? (
            <Text style={[styles.errorText, { marginTop: errorMarginTop, fontSize: errorFont }]}>
              {error}
            </Text>
          ) : null}
        </View>

      </ScrollView>
      </View>

      {scannerVisible ? (
        <View style={styles.scannerOverlay}>
          {Boolean(permission?.granted) ? (
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handleBarcodeScanned}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View pointerEvents="none" style={styles.scanGuideContainer}>
            <Image
              source={QR_FRAME_IMAGE}
              style={[styles.scanGuideImage, { width: scanGuideSize, height: scanGuideSize }]}
              contentFit="contain"
            />
          </View>
          <Pressable
            onPress={() => setScannerVisible(false)}
            style={[styles.scannerCloseButton, { bottom: scannerCloseBottom }]}>
            <Text style={styles.scannerCloseText}>閉じる</Text>
          </Pressable>
        </View>
      ) : null}

    </View>
    <CharacterInfoModal
      visible={detailModalVisible}
      payload={detailModalPayload}
      onClose={closeDetailModal}
    />
    </Fragment>
  );
}

// 触覚デバイス名（接続時に PC 側へ表示される）。
function getAutoDeviceName(): string {
  const constants = Platform.constants as Record<string, unknown>;
  const model =
    (typeof constants?.Model === "string" && constants.Model) ||
    (typeof constants?.Brand === "string" && constants.Brand) ||
    (typeof constants?.model === "string" && constants.model) ||
    null;
  const osVersion =
    (typeof constants?.osVersion === "string" && constants.osVersion) ||
    (typeof constants?.Release === "string" && constants.Release) ||
    null;
  if (model && osVersion) {
    return `vibe-app (${model} / ${Platform.OS} ${osVersion})`;
  }
  if (model) {
    return `vibe-app (${model})`;
  }
  return `vibe-app (${Platform.OS})`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FDFDFD",
  },
  measureScreenBackground: {
    flex: 1,
    alignItems: "center",
  },
  content: {
    flexGrow: 1,
    minHeight: px(DESIGN_HEIGHT),
    backgroundColor: "#FDFDFD",
  },

  // 上部グラデーション帯（Frame 43：390×346）。
  heroGradient: {
    width: "100%",
    height: px(346),
    position: "relative",
    overflow: "visible",
  },
  statusBarTime: {
    position: "absolute",
    left: px(52),
    top: px(26),
    width: px(37),
    fontSize: px(17),
    lineHeight: px(22),
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
  },
  logo: {
    position: "absolute",
    left: 0,
    top: px(40),
    width: px(280),
    height: px(100),
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  qrButton: {
    position: "absolute",
    left: px(37),
    top: px(155),
    width: px(170),
    height: px(51),
    borderRadius: 100,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0a4f6a",
    shadowOpacity: 0.18,
    shadowRadius: px(12),
    shadowOffset: { width: 0, height: px(6) },
    elevation: 4,
  },
  qrButtonPressed: {
    opacity: 0.85,
  },
  qrButtonEmphasized: {
    borderWidth: 2,
    borderColor: "#13a2d7",
  },
  qrButtonLabel: {
    fontSize: px(16),
    lineHeight: px(19),
    fontWeight: "700",
    color: "#13a2d7",
  },
  qrHint: {
    position: "absolute",
    left: px(37),
    top: px(220),
    width: px(179),
    fontSize: px(12),
    lineHeight: px(24),
    fontWeight: "700",
    color: "#ffffff",
  },
  // 右側のアナゴ（Figma Frame 30 基準で位置決め。
  // ソース PNG のアスペクト比に合わせて height を調整）。
  heroAnago: {
    position: "absolute",
    right: px(-8),
    top: px(135),
    width: px(112),
    height: px(176),
  },

  // コレクションシート（Frame 42）。marginTop は JSX 側の collectionMarginTop が優先（ここに書いても反映されない）。
  collectionSheet: {
    width: "100%",
    backgroundColor: "#FDFDFD",
    paddingHorizontal: px(33),
    paddingTop: px(33),
    paddingBottom: px(40),
    borderTopLeftRadius: px(28),
    borderTopRightRadius: px(28),
  },
  collectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: px(20),
  },
  connectionBanner: {
    width: "100%",
    backgroundColor: "rgba(12, 159, 214, 0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(12, 159, 214, 0.35)",
  },
  connectionBannerText: {
    fontWeight: "700",
    color: "#333333",
  },
  connectionBannerMuted: {
    fontWeight: "600",
    color: "#666666",
  },
  connectionRetryButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(12, 159, 214, 0.2)",
  },
  connectionRetryButtonPressed: {
    opacity: 0.88,
  },
  connectionRetryLabel: {
    fontWeight: "700",
    color: "#0c9fd6",
  },
  collectionLabel: {
    fontSize: px(16),
    lineHeight: px(19),
    fontWeight: "700",
    color: "#666666",
    marginRight: px(23),
    paddingBottom: px(2),
  },
  collectionCount: {
    fontSize: px(32),
    lineHeight: px(38),
    fontWeight: "700",
    color: "#0c9fd6",
    marginRight: px(8),
  },
  collectionDivider: {
    fontSize: px(16),
    lineHeight: px(19),
    fontWeight: "700",
    color: "#666666",
    marginRight: px(5),
    paddingBottom: px(2),
  },
  collectionTotal: {
    fontSize: px(16),
    lineHeight: px(19),
    fontWeight: "700",
    color: "#666666",
    paddingBottom: px(2),
  },
  collectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: px(18),
    rowGap: px(18),
  },
  collectionCard: {
    width: px(152.72),
    height: px(199),
    borderRadius: px(19.06),
    backgroundColor: "#EBEBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  collectionCardLocked: {
    backgroundColor: "#EBEBEB",
    boxShadow:
      "inset -2.31395px -2.31395px 4.62791px rgba(0, 0, 0, 0.15), inset 2.31395px 2.31395px 4.62791px rgba(0, 0, 0, 0.35)",
  },
  collectionCardAcquired: {
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: px(12),
    shadowOffset: { width: 0, height: px(8) },
    elevation: 6,
  },
  collectionCardNumber: {
    textAlign: "center",
    textAlignVertical: "center",
  },
  collectionCardLabel: {
    fontSize: px(27.77),
    lineHeight: px(33.14),
    fontWeight: "700",
    color: "#989898",
  },
  collectionCardLabelLocked: {
    color: "#989898",
  },
  collectionMoreButton: {
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "rgba(12,159,214,0.12)",
  },
  collectionMoreText: {
    fontWeight: "700",
    color: "#0c9fd6",
  },
  errorText: {
    marginTop: px(10),
    color: "#b93352",
    fontWeight: "700",
    fontSize: px(13),
  },

  // QR スキャンオーバーレイ（Figma `QRスキャン` フレームに準拠）。
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#d0d0d0",
    alignItems: "center",
    justifyContent: "center",
  },
  scanGuideContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanGuideImage: {
    width: px(312),
    height: px(312),
  },
  scannerCloseButton: {
    position: "absolute",
    bottom: px(56),
    paddingHorizontal: px(20),
    paddingVertical: px(11),
    borderRadius: 999,
    backgroundColor: "rgba(30,30,30,0.46)",
  },
  scannerCloseText: {
    color: "#ffffff",
    fontWeight: "700",
  },

  // 日本語: QR 成功直後の触覚 ON 案内（ホームと同じロゴ位置・同じグラデ背景）
  hapticsGuideScreenRoot: {
    flex: 1,
    overflow: "hidden",
  },
  hapticsGuideScrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: px(16),
  },
  hapticsGuideOuterSheet: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  hapticsGuideTitle: {
    fontWeight: "800",
    color: "#13a2d7",
    textAlign: "center",
  },
  hapticsGuideSubtitle: {
    fontWeight: "600",
    color: "#6a6a6a",
    textAlign: "center",
  },
  hapticsGuideStepCard: {
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: px(2) },
    elevation: 6,
  },

  // 測定中カード（QR 読み取り後の専用画面）。
  measureCard: {
    width: px(320),
    height: px(320),
    borderRadius: px(24),
    backgroundColor: "#ffffff",
    position: "relative",
    overflow: "hidden",
  },
  measureTopLogo: {
    position: "absolute",
    alignSelf: "center",
  },
  measureTitle: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    fontSize: px(32),
    lineHeight: px(38),
    fontWeight: "700",
    color: "#13a2d7",
  },
  measureToggleRow: {
    position: "absolute",
    width: px(270),
    height: px(64),
    borderRadius: px(16),
    backgroundColor: "#f5f5f5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: px(24),
  },
  measureToggleLabel: {
    fontSize: px(20),
    lineHeight: px(24),
    fontWeight: "700",
    color: "#666666",
  },
  measureSwitchWrap: {
    justifyContent: "center",
    height: "100%",
    paddingTop: px(2),
  },
  measureAnago: {
    position: "absolute",
    width: px(80),
    height: px(120),
  },
  measureAnagoGhost: {
    ...StyleSheet.absoluteFillObject,
  },

  // 日本語: PC 良い姿勢登録中（測定画面と同じロゴ位置・グラデ背景）
  registerCardOuter: {
    backgroundColor: "transparent",
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  registerCardInner: {
    backgroundColor: "#ffffff",
    overflow: "hidden",
    position: "relative",
  },
  registerPostureTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontWeight: "700",
    color: "#13a2d7",
  },
  registerPostureSubtitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontWeight: "700",
    color: "#989898",
  },
});
