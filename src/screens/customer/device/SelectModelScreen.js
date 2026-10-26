import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Smartphone, Check, Pencil, X, Search, ArrowLeft, ChevronRight, Plus } from 'lucide-react-native';
import { EmptyState, Loader, ScreenHeader } from '../../../components/rnr';
import { HeaderIconButton } from '../../../components/PageHeader';
import DeviceImage from '../../../components/DeviceImage';
import { getModelsByBrand, getSeriesForCategoryBrand } from '../../../api/masterData';
import { resolveDeviceImageSource } from '../../../utils/images';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import OtherNameDialog from './OtherNameDialog';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const MINT = '#EAF8EC';
const YELLOW_SOFT = '#FEF6DA';
const GREEN_LINE = 'rgba(9,173,42,0.45)';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

// Canonical "Select Product" picker used by all flows. Series chips at the top
// FILTER the full model grid below (Cashify-style). Search is a header icon that
// opens a full-screen results list (no persistent search box). Routes to
// SelectVariant (sell/profile/repair).
const HORIZONTAL_PAD = 16;
const GRID_GAP = 12;
function gridMetrics(screenWidth) {
  const numColumns = screenWidth >= 600 ? 4 : 3;
  const cardWidth = Math.floor((screenWidth - HORIZONTAL_PAD * 2 - GRID_GAP * (numColumns - 1)) / numColumns);
  return { numColumns, cardWidth };
}

// Full-screen gallery image viewer: two-finger pinch-to-zoom, one-finger pan while
// zoomed, double-tap to zoom in / reset, and a horizontal swipe (while un-zoomed) to
// move to the prev/next image. Uses react-native-gesture-handler's component API for
// RELIABLE native multi-touch (PanResponder pinch is flaky on Android) driving plain RN
// Animated values with useNativeDriver — NO reanimated/worklets, so it can't hit the
// worklets "installTurboModule" crash. Scale is clamped to [MIN_SCALE, MAX_SCALE] and the
// pan offset to the image bounds. Zoom/position reset for free via the parent's `key={id}`.
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;

function ZoomableImage({ url, base64, size, onSwipe }) {
  const pinchRef = useRef(null);
  const panRef = useRef(null);

  // Rendered scale = committed base * live pinch. Pan uses Animated offset accumulation.
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = useRef(Animated.multiply(baseScale, pinchScale)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const cur = useRef({ scale: 1, x: 0, y: 0 }).current; // committed values (JS side)

  const panLimit = (s) => Math.max(0, (size * s - size) / 2);
  const setOffset = (x, y) => {
    cur.x = x; cur.y = y;
    panX.setOffset(x); panX.setValue(0);
    panY.setOffset(y); panY.setValue(0);
  };

  // Two-finger pinch — gesture-handler tracks both fingers natively (reliable on Android).
  const onPinchEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], { useNativeDriver: true });
  const onPinchStateChange = (e) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cur.scale * e.nativeEvent.scale));
      cur.scale = next;
      baseScale.setValue(next);
      pinchScale.setValue(1);
      if (next <= MIN_SCALE + 0.001) setOffset(0, 0);
      else { const l = panLimit(next); setOffset(Math.max(-l, Math.min(l, cur.x)), Math.max(-l, Math.min(l, cur.y))); }
    }
  };

  // One-finger drag: pan while zoomed, or (un-zoomed) a horizontal swipe to change image.
  const onPanEvent = Animated.event([{ nativeEvent: { translationX: panX, translationY: panY } }], { useNativeDriver: true });
  const onPanStateChange = (e) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      const { translationX, translationY } = e.nativeEvent;
      if (cur.scale <= MIN_SCALE + 0.02) {
        setOffset(0, 0); // not zoomed → keep centred
        if (Math.abs(translationX) > 55 && Math.abs(translationX) > Math.abs(translationY)) {
          onSwipe?.(translationX < 0 ? 'next' : 'previous');
        }
        return;
      }
      const l = panLimit(cur.scale);
      setOffset(
        Math.max(-l, Math.min(l, cur.x + translationX)),
        Math.max(-l, Math.min(l, cur.y + translationY)),
      );
    }
  };

  // Double-tap toggles fit (1x) ↔ DOUBLE_TAP_SCALE, always re-centred.
  const onDoubleTap = (e) => {
    if (e.nativeEvent.state !== State.ACTIVE) return;
    if (cur.scale > MIN_SCALE + 0.02) { cur.scale = MIN_SCALE; baseScale.setValue(MIN_SCALE); setOffset(0, 0); }
    else { cur.scale = DOUBLE_TAP_SCALE; baseScale.setValue(DOUBLE_TAP_SCALE); }
  };

  return (
    <PanGestureHandler
      ref={panRef}
      minPointers={1}
      maxPointers={1}
      avgTouches
      simultaneousHandlers={pinchRef}
      onGestureEvent={onPanEvent}
      onHandlerStateChange={onPanStateChange}
    >
      <Animated.View collapsable={false} style={{ flex: 1, alignSelf: 'stretch' }}>
        <PinchGestureHandler
          ref={pinchRef}
          simultaneousHandlers={panRef}
          onGestureEvent={onPinchEvent}
          onHandlerStateChange={onPinchStateChange}
        >
          <Animated.View collapsable={false} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <TapGestureHandler numberOfTaps={2} onHandlerStateChange={onDoubleTap}>
              <Animated.View style={{ width: size, height: size, transform: [{ translateX: panX }, { translateY: panY }, { scale }] }}>
                <DeviceImage url={url} base64={base64} style={{ width: size, height: size }} contentFit="contain" />
              </Animated.View>
            </TapGestureHandler>
          </Animated.View>
        </PinchGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  );
}

export default function SelectModelScreen({ navigation, route }) {
  const flow = route?.params?.flow || 'PROFILE';
  const {
    categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
    brandId, brandName, seriesName: routeSeriesName, editSellOrderId, editHints,
  } = route?.params || {};
  const isEditing = !!editSellOrderId;
  const currentModelId = editHints?.modelId || null;

  const insets = useSafeAreaInsets();
  const [models, setModels] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null); // index into imageModels for the full-screen viewer
  const [selSeriesId, setSelSeriesId] = useState(
    route?.params?.seriesId || editHints?.seriesId || null,
  );

  /**
   * "Other" — a model that isn't in the catalogue. Repair booking and Sell (as on
   * Select Brand). Carries modelId: null with the typed modelName. A typed
   * brand has no list at all, so the dialog opens straight away.
   */
  const allowOther = flow === 'REPAIR' || flow === 'SELL';
  const customBrand = !!route?.params?.customBrand;
  const [otherOpen, setOtherOpen] = useState(customBrand && allowOther);
  const [otherName, setOtherName] = useState('');

  const { width: screenWidth } = useWindowDimensions();
  const { cardWidth } = gridMetrics(screenWidth);
  const imgBox = cardWidth - 16;   // image box / tap area (nearly the full card width)
  const imgInner = imgBox;         // image fills the box → big images like the target screenshot

  useEffect(() => {
    let cancelled = false;
    if (!brandId) { setLoading(false); return undefined; }
    (async () => {
      try {
        const [modelList, seriesList] = await Promise.all([
          getModelsByBrand(brandId),
          getSeriesForCategoryBrand(categoryId, brandId).catch(() => []),
        ]);
        if (cancelled) return;
        let ms = modelList || [];
        if (UUID_RE.test(String(categoryId || ''))) {
          ms = ms.filter((m) => !m.categoryId || m.categoryId === categoryId);
        }
        // Sell flow only offers models the admin marked "Sell Active".
        if (flow === 'SELL') ms = ms.filter((m) => m.sellActive !== false);
        setModels(ms);
        setSeries(seriesList || []);
      } catch (_) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [brandId, categoryId]);

  const seriesWithModels = useMemo(() => {
    const ids = new Set(models.map((m) => m.seriesId).filter(Boolean));
    return (series || []).filter((s) => ids.has(s.id));
  }, [series, models]);

  const selectedSeries = seriesWithModels.find((s) => s.id === selSeriesId) || null;

  // Grid (chips-filtered) vs search (spans all models).
  const gridModels = useMemo(() => {
    let list = selSeriesId ? models.filter((m) => m.seriesId === selSeriesId) : models;
    if (isEditing && currentModelId) {
      const cur = list.find((m) => m.id === currentModelId);
      if (cur) list = [cur, ...list.filter((m) => m.id !== currentModelId)];
    }
    return list;
  }, [models, selSeriesId, isEditing, currentModelId]);

  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];  // empty query → show the "Start typing to search" prompt, not the full list
    return models.filter((m) => (m.name || '').toLowerCase().includes(needle));
  }, [models, q]);

  // Only models with an image can be opened in the gallery; prev/next moves through
  // this list so the viewer always shows a real image.
  const imageModels = useMemo(
    () => gridModels.filter((m) => m.imageUrl || m.imageBase64),
    [gridModels],
  );
  const preview = previewIndex != null && previewIndex < imageModels.length ? imageModels[previewIndex] : null;
  const openPreview = (m) => {
    const i = imageModels.findIndex((x) => x.id === m.id);
    if (i >= 0) setPreviewIndex(i);
  };
  const closePreview = () => setPreviewIndex(null);
  const swipePreview = (direction) => {
    setPreviewIndex((i) => {
      if (i == null) return i;
      if (direction === 'previous') return i > 0 ? i - 1 : i;
      return i < imageModels.length - 1 ? i + 1 : i;
    });
  };

  const onPick = (m) => {
    const pickedSeries = (series || []).find((s) => s.id === m.seriesId);
    const baseParams = {
      flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
      brandId, brandName,
      seriesId: m.seriesId || selSeriesId || undefined,
      seriesName: pickedSeries?.name || routeSeriesName || undefined,
      modelId: m.id, modelName: m.name,
      modelImageUrl: resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 }) || undefined,
      editSellOrderId, editHints,
      ...(editSellOrderId && editHints?.modelId === m.id ? {
        ramOptionId: editHints.ramOptionId,
        storageOptionId: editHints.storageOptionId,
        color: editHints.color,
        imei: editHints.imei,
      } : {}),
    };
    if (flow === 'OWNER_LIST') {
      navigation.navigate('OwnerSellChooseSalesCategory', baseParams);
      return;
    }
    navigation.navigate('SelectVariant', baseParams);
  };

  const closeOther = () => {
    setOtherOpen(false);
    setOtherName('');
    // A typed brand has no list to fall back to, so cancelling returns to the
    // brand picker rather than an empty screen.
    if (customBrand && navigation.canGoBack()) navigation.goBack();
  };
  const onPickOther = () => {
    const name = otherName.trim();
    if (!name) return;
    setOtherOpen(false);
    setOtherName('');
    setSearchOpen(false);
    setQ('');
    navigation.navigate('SelectVariant', {
      ...(route?.params || {}),
      flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
      brandId, brandName,
      modelId: null, modelName: name, customModel: true, modelImageUrl: undefined,
      ramOptionId: undefined, storageOptionId: undefined, color: undefined,
      editSellOrderId, editHints,
    });
  };
  const otherDialog = (
    <OtherNameDialog
      visible={otherOpen}
      title="Other model"
      description={`${brandName ? `Brand: ${brandName}. ` : ''}Type the model as printed on the device. It is saved on this ${flow === 'SELL' ? 'sell order' : 'booking'} only — it is not added to the catalogue.`}
      label="MODEL NAME"
      placeholder="e.g. Blaze 2 Pro"
      value={otherName}
      onChangeText={setOtherName}
      onCancel={closeOther}
      onSubmit={onPickOther}
    />
  );
  const otherCard = allowOther ? (
    <Pressable
      onPress={() => setOtherOpen(true)}
      className="active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel="Other, type the model"
      style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
        borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderStyle: 'dashed', borderColor: GREEN_LINE,
      }}
    >
      <View style={{ height: 36, width: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: MINT, marginRight: 10 }}>
        <Plus size={18} color={GREEN_TEXT} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: rf(13), fontWeight: '800', color: GREEN_TEXT }} numberOfLines={1}>Other — type the model</Text>
        <Text style={{ fontSize: rf(11), color: BRAND.muted, marginTop: 1 }} numberOfLines={1}>For a device that isn’t in the list</Text>
      </View>
      <ChevronRight size={15} color={GREEN_TEXT} />
    </Pressable>
  ) : null;

  // ── Full-screen search mode ───────────────────────────────────────────────
  if (searchOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8, paddingTop: insets.top + 8,
            backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: LINE,
          }}
        >
          <Pressable
            onPress={() => { setSearchOpen(false); setQ(''); }}
            className="active:opacity-70"
            style={{ height: 40, width: 40, alignItems: 'center', justifyContent: 'center' }}
            hitSlop={8}
            accessibilityLabel="Close search"
          >
            <ArrowLeft size={22} color={BRAND.ink} />
          </Pressable>
          <View
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', height: 42, paddingHorizontal: 12,
              borderRadius: 12, backgroundColor: BRAND.line, borderWidth: 1, borderColor: LINE,
            }}
          >
            <Search size={17} color={BRAND.green} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder={`Search ${brandName || 'model'}`}
              placeholderTextColor={BRAND.muted}
              // Web only: drop the browser focus ring inside the rounded field.
              style={[{ flex: 1, marginLeft: 8, paddingVertical: 0, fontSize: rf(14), color: BRAND.ink }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
              returnKeyType="search"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search">
                <X size={17} color={BRAND.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
          {searchResults.length === 0 ? (
            <EmptyState
              icon={q ? <Smartphone size={28} color={BRAND.green} /> : <Search size={28} color={BRAND.green} />}
              accent={BRAND.green}
              accentSoft={MINT}
              title={q ? 'No products found' : 'Search products'}
              description={q ? `Nothing matches "${q.trim()}".` : `Type a model name to search ${brandName || 'products'}.`}
            />
          ) : null}
          {searchResults.length === 0 && allowOther && q.trim() ? (
            <Pressable
              onPress={() => { setOtherName(q.trim()); setOtherOpen(true); }}
              className="active:opacity-80"
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: BRAND.green, backgroundColor: '#FFFFFF' }}
            >
              <Plus size={15} color={GREEN_TEXT} />
              <Text style={{ marginLeft: 6, fontSize: rf(12.5), fontWeight: '700', color: GREEN_TEXT }} numberOfLines={1}>Use "{q.trim()}" as Other model</Text>
            </Pressable>
          ) : null}
          {searchResults.length === 0 ? null : (
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, overflow: 'hidden', ...cardShadow }}>
              {searchResults.map((m, i) => {
                const hasImg = !!(m.imageUrl || m.imageBase64);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => onPick(m)}
                    className="active:opacity-80"
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: BRAND.line,
                    }}
                  >
                    <View style={{ height: 52, width: 52, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: '#FFFFFF' }}>
                      {hasImg ? (
                        <DeviceImage url={m.imageUrl} base64={m.imageBase64} style={{ width: 52, height: 52 }} contentFit="contain" />
                      ) : (
                        <Smartphone size={24} color={BRAND.green} />
                      )}
                    </View>
                    <Text style={{ flex: 1, fontSize: rf(13.5), fontWeight: '600', color: BRAND.ink }} numberOfLines={1}>{m.name}</Text>
                    <ChevronRight size={15} color={BRAND.muted} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
        {otherDialog}
      </View>
    );
  }

  // ── Normal mode: series chips + model grid ────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScreenHeader
        title="Select Product"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        right={<HeaderIconButton icon={Search} label="Search models" onPress={() => setSearchOpen(true)} />}
      />
      {isEditing && editHints?.modelName ? (
        <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: LINE, paddingHorizontal: 16, paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: YELLOW_SOFT, borderWidth: 1, borderColor: BRAND.yellowLine }}>
            <Pencil size={13} color={BRAND.yellow} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ fontSize: rf(10), fontWeight: '800', color: BRAND.ink, letterSpacing: 0.8 }}>
                EDITING ORDER
              </Text>
              <Text style={{ fontSize: rf(12), fontWeight: '600', color: BRAND.body }} numberOfLines={1}>
                Currently: {editHints.brandName ? `${editHints.brandName} · ` : ''}{editHints.modelName}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {loading ? (
        <Loader label="Loading products..." />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PAD, paddingTop: 14, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
        >
          {otherCard}

          {/* ── Series chips (compact) ────────────────────────────────── */}
          {seriesWithModels.length > 0 ? (
            <View style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: rf(15), fontWeight: '800', color: BRAND.ink, marginBottom: 10 }}>Select Series</Text>
              {selectedSeries ? (
                <View style={{ flexDirection: 'row' }}>
                  <Pressable
                    onPress={() => setSelSeriesId(null)}
                    className="active:opacity-80"
                    accessibilityLabel={`Clear ${selectedSeries.name} filter`}
                    style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: BRAND.green, borderWidth: 1, borderColor: BRAND.green }}
                  >
                    <Text style={{ fontSize: rf(12.5), fontWeight: '700', color: '#FFFFFF', marginRight: 8 }} numberOfLines={1}>
                      {selectedSeries.name}
                    </Text>
                    <X size={15} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                  {seriesWithModels.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelSeriesId(s.id)}
                      className="active:opacity-80"
                      style={{
                        width: cardWidth, minHeight: 40, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12,
                        alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE,
                      }}
                    >
                      <Text style={{ fontSize: rf(12), fontWeight: '600', color: BRAND.ink, textAlign: 'center' }} numberOfLines={2}>
                        {s.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* ── Models grid ───────────────────────────────────────────── */}
          {gridModels.length === 0 && customBrand ? null : gridModels.length === 0 ? (
            <EmptyState
              icon={<Smartphone size={28} color={BRAND.green} />}
              accent={BRAND.green}
              accentSoft={MINT}
              title="No products found"
              description="No models published for this selection yet."
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
              {gridModels.map((m) => {
                const isCurrent = isEditing && m.id === currentModelId;
                const hasImg = !!(m.imageUrl || m.imageBase64);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => onPick(m)}
                    className="active:opacity-80"
                    style={{
                      width: cardWidth,
                      padding: 8,
                      alignItems: 'center',
                      borderRadius: 16,
                      backgroundColor: isCurrent ? MINT : '#FFFFFF',
                      borderWidth: isCurrent ? 1.5 : 1,
                      borderColor: isCurrent ? BRAND.green : LINE,
                      ...cardShadow,
                    }}
                  >
                    <Pressable
                      onPress={() => openPreview(m)}
                      disabled={!hasImg}
                      style={{ height: imgBox, width: imgBox, marginBottom: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                    >
                      {hasImg ? (
                        <DeviceImage
                          url={m.imageUrl}
                          base64={m.imageBase64}
                          style={{ width: imgInner, height: imgInner }}
                          contentFit="contain"
                        />
                      ) : (
                        <Smartphone size={Math.round(imgBox * 0.4)} color={BRAND.green} />
                      )}
                    </Pressable>
                    <Text
                      numberOfLines={2}
                      style={{ fontSize: rf(11), fontWeight: '800', color: BRAND.ink, textAlign: 'center', width: '100%' }}
                    >
                      {m.name}
                    </Text>
                    {isCurrent ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BRAND.greenLine }}>
                        <Check size={10} color={GREEN_TEXT} />
                        <Text style={{ marginLeft: 4, fontSize: rf(9.5), fontWeight: '800', color: GREEN_TEXT }}>Current</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Full-screen gallery image viewer (pinch / pan / double-tap + swipe) */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={closePreview}>
        {/* RN Modal renders in its own window; gesture-handler needs a local root here (Android). */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(30,30,30,0.95)' }}>
            {/* Header: gesture hint + close button */}
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: rf(11), fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>🤏 Pinch · double-tap · swipe</Text>
              <Pressable
                onPress={closePreview}
                hitSlop={12}
                accessibilityLabel="Close preview"
                style={{ height: 42, width: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={22} color="#FFFFFF" />
              </Pressable>
            </View>
            {/* Zoomable image with swipe navigation */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {preview && (preview.imageUrl || preview.imageBase64) ? (
                <ZoomableImage
                  key={preview.id}
                  url={preview.imageUrl}
                  base64={preview.imageBase64}
                  size={screenWidth - 40}
                  onSwipe={swipePreview}
                />
              ) : (
                <Smartphone size={140} color="#FFFFFF" />
              )}
            </View>

            {/* Footer: name + select */}
            <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
              <Text style={{ fontSize: rf(15), fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 }} numberOfLines={2}>
                {preview?.name}
              </Text>
              <Pressable
                onPress={() => { const m = preview; closePreview(); if (m) onPick(m); }}
                className="active:opacity-80"
                style={{ borderRadius: 16, paddingVertical: 15, alignItems: 'center', backgroundColor: BRAND.green }}
              >
                <Text style={{ fontSize: rf(15), fontWeight: '800', color: '#FFFFFF' }}>Select this product</Text>
              </Pressable>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      {otherDialog}
    </View>
  );
}
