import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Smartphone, Check, Pencil, X, Search, Plus, Laptop, Tablet, Watch, Headphones } from 'lucide-react-native';
import { EmptyState, Loader } from '../../../components/rnr';
import DeviceImage from '../../../components/DeviceImage';
import { DP, DP_COLUMN, DevicePickerHeader, DPSection, PickedCard, PickerImage, DPGridTile, gridTileW, DPNextBar, goToPicker } from './DevicePickerChrome';
import { getModelsByBrand, getSeriesForCategoryBrand } from '../../../api/masterData';
import { resolveDeviceImageSource } from '../../../utils/images';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import OtherNameDialog from './OtherNameDialog';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LINE = '#E8EAEE';
const YELLOW_SOFT = '#FFF4D6';

// Canonical model picker used by all flows, styled as the Partner "Device
// Details" model step: picked Category / Brand cards (Change), a "Search model"
// box, a SERIES filter grid ("All" first) that filters the model grid below,
// and a pinned Next. Tap a tile to pick (→ SelectVariant); tap its image to
// open the zoomable preview. Search spans every model of the brand.
const HORIZONTAL_PAD = 16;
const GRID_GAP = 8;

// Category card fallback icon when the category has no image.
function categoryIcon(code, name) {
  const s = `${code || ''} ${name || ''}`.toLowerCase();
  if (/laptop|notebook|macbook/.test(s)) return Laptop;
  if (/tab|ipad/.test(s)) return Tablet;
  if (/watch/.test(s)) return Watch;
  if (/audio|head|ear|buds|speaker/.test(s)) return Headphones;
  return Smartphone;
}

// SERIES filter tile (Partner OptionTile): selected = mint fill + teal border.
function SeriesTile({ width, label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      className="active:opacity-80"
      style={{
        width, minHeight: 46, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: selected ? DP.mint : '#FFFFFF', borderWidth: selected ? 1.5 : 1, borderColor: selected ? DP.teal : DP.line,
      }}
    >
      <Text
        style={{ fontSize: 12.5, lineHeight: 16, fontWeight: selected ? '800' : '600', color: selected ? DP.teal : DP.ink, textAlign: 'center' }}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Model tile (Partner GridTile): image (tap → preview) over a 2-line name.
const modelSrc = (m) => resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 });
const MODEL_IMG_H = 70;
function ModelTile({ m, width, selected, current, onPress, onImagePress }) {
  const hasImg = !!(m.imageUrl || m.imageBase64);
  const imgW = Math.max(40, Math.min(width - 12, 88));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={m.name}
      accessibilityState={{ selected: !!selected }}
      className="active:opacity-80"
      style={{
        width, minHeight: 132, paddingHorizontal: 4, paddingVertical: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
        backgroundColor: selected ? DP.mint : '#FFFFFF', borderWidth: selected ? 1.5 : 1, borderColor: selected ? DP.teal : DP.line,
      }}
    >
      {selected ? (
        <View style={{ position: 'absolute', top: 6, right: 6, height: 18, width: 18, borderRadius: 9, backgroundColor: DP.teal, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <Check size={11} color="#FFFFFF" strokeWidth={3} />
        </View>
      ) : null}
      {hasImg ? (
        <Pressable onPress={onImagePress} hitSlop={4} accessibilityRole="imagebutton" accessibilityLabel={`View ${m.name} image`}>
          <PickerImage uri={modelSrc(m)} width={imgW} height={MODEL_IMG_H} fallback={<Smartphone size={40} color={DP.ink} strokeWidth={1.5} />} />
        </Pressable>
      ) : (
        <View style={{ height: MODEL_IMG_H, alignItems: 'center', justifyContent: 'center' }}>
          <Smartphone size={40} color={DP.ink} strokeWidth={1.5} />
        </View>
      )}
      <Text
        style={{ marginTop: 8, fontSize: 13, lineHeight: 16, fontWeight: selected ? '700' : '500', color: DP.ink, textAlign: 'center', width: '100%' }}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {m.name}
      </Text>
      {current ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: DP.teal }}>
          <Check size={10} color={DP.teal} />
          <Text style={{ marginLeft: 4, fontSize: 10, fontWeight: '800', color: DP.teal }}>Current</Text>
        </View>
      ) : null}
    </Pressable>
  );
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
              <Animated.View style={{ width: size, height: size, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', transform: [{ translateX: panX }, { translateY: panY }, { scale }] }}>
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
    categoryImage, brandImage,
  } = route?.params || {};
  const isEditing = !!editSellOrderId;
  const currentModelId = editHints?.modelId || null;

  const [models, setModels] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [pickedId, setPickedId] = useState(null); // last model picked here (Next re-opens it after Back)
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

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = screenWidth >= 600;
  const colW = Math.min(screenWidth - HORIZONTAL_PAD * 2, 720); // DP_COLUMN content width
  const seriesW = gridTileW(colW, isTablet ? 6 : 4, 0, GRID_GAP);
  const modelW = gridTileW(colW, isTablet ? 5 : 3, 0, GRID_GAP);
  const previewSize = Math.max(200, Math.min(screenWidth - 40, screenHeight - 300, 720));

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

  // What the grid shows: search results (all models) while typing, else the
  // series-filtered grid.
  const searching = !!q.trim();
  const listModels = searching ? searchResults : gridModels;

  // Model already chosen here (or the order's current model when editing) —
  // highlighted in the grid and enables Next.
  const chosen = models.find((m) => m.id === (pickedId || currentModelId)) || null;

  // Only models with an image can be opened in the gallery; prev/next moves through
  // this list so the viewer always shows a real image.
  const imageModels = useMemo(
    () => listModels.filter((m) => m.imageUrl || m.imageBase64),
    [listModels],
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
    setPickedId(m.id);
    const pickedSeries = (series || []).find((s) => s.id === m.seriesId);
    const baseParams = {
      flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName,
      brandId, brandName,
      categoryImage, brandImage,
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
  // Change → back to an earlier picker; reuse its params when it's in the stack
  // (popTo replaces params), else open it with what it needs.
  const changeTo = (name, fallback) => {
    const routes = navigation.getState?.()?.routes || [];
    const existing = [...routes].reverse().find((r) => r.name === name);
    goToPicker(navigation, name, existing?.params || fallback);
  };
  const catTitle = categoryName || deviceTypeName;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <DevicePickerHeader navigation={navigation} onBack={() => { if (navigation.canGoBack()) navigation.goBack(); }} />
      {isEditing && editHints?.modelName ? (
        <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: LINE, paddingHorizontal: 16, paddingVertical: 10 }}>
          <View style={[{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: YELLOW_SOFT, borderWidth: 1, borderColor: BRAND.yellowLine }, DP_COLUMN]}>
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

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PAD, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={DP_COLUMN}>
          {catTitle ? (
            <>
              <DPSection title="Category" />
              <PickedCard
                image={resolveDeviceImageSource({ url: categoryImage })}
                icon={categoryIcon(categoryCode, catTitle)}
                title={catTitle}
                onChange={() => changeTo('SelectCategory', { flow, editSellOrderId, editHints })}
              />
            </>
          ) : null}
          {brandName ? (
            <>
              <DPSection title="Brand" />
              <PickedCard
                image={resolveDeviceImageSource({ url: brandImage })}
                initial={brandName}
                title={brandName}
                subtitle={customBrand ? 'Not in list' : null}
                onChange={() => changeTo('SelectBrand', {
                  flow, categoryId, categoryCode, categoryName, deviceTypeId, deviceTypeName, categoryImage,
                  editSellOrderId, editHints,
                })}
              />
            </>
          ) : null}

          <DPSection title="Model" />
          {loading ? (
            <Loader inline label="Loading products..." className="justify-center py-6" />
          ) : (
            <>
              {/* Search spans every model of the brand; series filter hides while typing. */}
              {models.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 14, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: DP.line, backgroundColor: '#FFFFFF' }}>
                  <Search size={20} color={DP.muted} />
                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder="Search model"
                    placeholderTextColor="#9CA3AF"
                    cursorColor={DP.teal}
                    returnKeyType="search"
                    accessibilityLabel="Search model"
                    // Web only: drop the browser focus ring inside the rounded field.
                    style={[{ flex: 1, marginLeft: 10, paddingVertical: 0, fontSize: 15, color: DP.ink }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
                  />
                  {q ? (
                    <Pressable onPress={() => setQ('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
                      <X size={18} color={DP.muted} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {/* ── SERIES filter: "All" + one tile per series with models ── */}
              {seriesWithModels.length > 0 && !searching ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginBottom: 14 }}>
                  <SeriesTile width={seriesW} label="All" selected={!selSeriesId} onPress={() => setSelSeriesId(null)} />
                  {seriesWithModels.map((s) => (
                    <SeriesTile key={s.id} width={seriesW} label={s.name} selected={selSeriesId === s.id} onPress={() => setSelSeriesId(s.id)} />
                  ))}
                </View>
              ) : null}

              {listModels.length === 0 && !searching && !customBrand ? (
                <EmptyState
                  icon={<Smartphone size={28} color={BRAND.green} />}
                  accent={BRAND.green}
                  accentSoft={DP.mint}
                  title="No products found"
                  description="No models published for this selection yet."
                />
              ) : null}
              {listModels.length === 0 && searching ? (
                <Text style={{ fontSize: 13, color: DP.muted, marginBottom: 10 }}>
                  No model matches “{q.trim()}”{allowOther ? ' — tap Other to type it.' : '.'}
                </Text>
              ) : null}

              {/* ── Model grid (3 per row; 5 on tablets) + Other ── */}
              {listModels.length > 0 || allowOther ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                  {listModels.map((m) => (
                    <ModelTile
                      key={m.id}
                      m={m}
                      width={modelW}
                      selected={chosen?.id === m.id}
                      current={isEditing && m.id === currentModelId}
                      onPress={() => onPick(m)}
                      onImagePress={() => openPreview(m)}
                    />
                  ))}
                  {allowOther ? (
                    <DPGridTile
                      width={modelW}
                      icon={Plus}
                      imageSize={60}
                      minHeight={132}
                      label="Other"
                      accessibilityLabel="Other, type the model"
                      onPress={() => { setOtherName(q.trim()); setOtherOpen(true); }}
                    />
                  ) : null}
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>


      {/* Full-screen model preview (Partner image viewer): pinch / pan / double-tap + swipe */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={closePreview} statusBarTranslucent navigationBarTranslucent>
        {/* A Modal is its own window: give it its own safe-area + gesture-handler roots (Android). */}
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.94)' }}>
              {/* Header: gesture hint + close button */}
              <View style={{ paddingTop: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ flexShrink: 1, marginRight: 12, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }} numberOfLines={1}>
                  {imageModels.length > 1 ? 'Pinch · double-tap · swipe' : 'Pinch · double-tap'}
                </Text>
                <Pressable
                  onPress={closePreview}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close preview"
                  style={{ height: 44, width: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={22} color="#FFFFFF" />
                </Pressable>
              </View>
              {/* Zoomable image card with swipe navigation */}
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {preview && (preview.imageUrl || preview.imageBase64) ? (
                  <ZoomableImage
                    key={preview.id}
                    url={preview.imageUrl}
                    base64={preview.imageBase64}
                    size={previewSize}
                    onSwipe={swipePreview}
                  />
                ) : (
                  <Smartphone size={140} color="#FFFFFF" />
                )}
              </View>

              {/* Footer: name · i / N · Select this model */}
              <View style={[{ paddingHorizontal: 16, paddingBottom: 18, alignItems: 'center' }, DP_COLUMN]}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' }} numberOfLines={2}>
                  {preview?.name}
                </Text>
                {preview && imageModels.length > 1 ? (
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                    {previewIndex + 1} / {imageModels.length}
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => { const m = preview; closePreview(); if (m) onPick(m); }}
                  accessibilityRole="button"
                  accessibilityLabel="Select this model"
                  className="active:opacity-80"
                  style={{ marginTop: 14, height: 48, alignSelf: 'stretch', borderRadius: 12, backgroundColor: DP.teal, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>Select this model</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </Modal>

      {otherDialog}
    </View>
  );
}
