import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft, Search, X, Mic, QrCode, Camera, Clock, TrendingUp, Wrench, Tag, ShoppingBag,
  Smartphone, Store, ChevronRight, Sparkles, MicOff,
} from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { goToTab } from '../../../navigation/goToTab';
import * as IntentLauncher from 'expo-intent-launcher';
import { BRAND } from '../../../theme/brand';
import { resolveDeviceImageSource } from '../../../utils/images';
import { loadCatalog, searchCatalog, modelRouteParams, parseQuery } from '../../../utils/searchCatalog';
import { listProducts } from '../../../api/marketplace';
import { listShops } from '../../../api/shops';

const GREEN_TEXT = '#078F23';
const MINT = '#EAF8EC';
const LINE = '#E6E6E6';
const YELLOW_SOFT = '#FEF6DA';
const RED_SOFT = '#FEECEC';
const MUTED = '#6B6B6B';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 };
const RECENT_KEY = 'search.recent';
const POPULAR = ['iPhone 13', 'Screen replacement', 'Battery', 'Galaxy S23', 'Laptop repair', 'Sell iPhone 12', 'Earbuds'];

const ACTION = {
  repair: { label: 'Repair', icon: Wrench, bg: MINT, fg: GREEN_TEXT },
  sell: { label: 'Sell', icon: Tag, bg: YELLOW_SOFT, fg: BRAND.ink },
  buy: { label: 'Buy', icon: ShoppingBag, bg: RED_SOFT, fg: BRAND.red },
};
const orderFor = (intent) => (intent ? [intent, ...['repair', 'sell', 'buy'].filter((k) => k !== intent)] : ['repair', 'sell', 'buy']);
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Web Speech API (Chrome / Edge / Safari). Native builds fall back to the
// keyboard's own mic — Expo Go ships no speech-to-text module.
const WebSpeech = Platform.OS === 'web' && typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null;

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function ActionChip({ kind, onPress }) {
  const a = ACTION[kind];
  const Icon = a.icon;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={a.label}
      className="active:opacity-75"
      style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, marginLeft: 5, backgroundColor: a.bg }}
    >
      <Icon size={11} color={a.fg} />
      <Text style={{ marginLeft: 4, fontSize: rf(10.5), fontWeight: '800', color: a.fg }}>{a.label}</Text>
    </Pressable>
  );
}

function SectionHead({ title, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 7, paddingHorizontal: 2 }}>
      <Text style={{ flex: 1, fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }}>{title}</Text>
      {right}
    </View>
  );
}

const Card = ({ children }) => (
  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: LINE, overflow: 'hidden', ...cardShadow }}>{children}</View>
);

// Result tile: icon with the name under it on the left, the Repair / Sell / Buy
// chips on the same line to the right (siblings — no button inside a button).
function TileRow({ first, onPress, uri, Icon, title, chips }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderTopWidth: first ? 0 : 1, borderTopColor: BRAND.line }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} className="active:opacity-85" style={{ width: 96, alignItems: 'center' }}>
        <Thumb uri={uri} Icon={Icon} />
        <Text numberOfLines={2} style={{ marginTop: 4, fontSize: rf(11), fontWeight: '800', color: BRAND.ink, textAlign: 'center' }}>{title}</Text>
      </Pressable>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>{chips}</View>
    </View>
  );
}

function Row({ first, onPress, left, title, sub, right, below, label }) {
  const rowLine = { borderTopWidth: first ? 0 : 1, borderTopColor: BRAND.line };
  const head = (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label || title}
      className="active:opacity-85"
      style={{ flexDirection: 'row', alignItems: 'center', ...(below ? null : { paddingHorizontal: 10, paddingVertical: 8, ...rowLine }) }}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0, marginLeft: 9 }}>
        <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink }} numberOfLines={2}>{title}</Text>
        {sub ? <Text style={{ fontSize: rf(10.5), color: MUTED, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
  if (!below) return head;
  // Action chips sit under the name (long model names stay readable) and are
  // siblings of the row's tap area — never buttons nested inside a button.
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 8, ...rowLine }}>
      {head}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginLeft: 47 }}>{below}</View>
    </View>
  );
}

const Thumb = ({ uri, Icon = Smartphone, round }) => (
  <View style={{ height: 38, width: 38, borderRadius: round ? 19 : 10, backgroundColor: uri ? '#FFFFFF' : MINT, borderWidth: 1, borderColor: BRAND.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {uri ? <Image resizeMethod="resize" source={{ uri }} style={{ width: 34, height: 34 }} resizeMode="contain" /> : <Icon size={17} color={GREEN_TEXT} />}
  </View>
);

export default function SearchScreen({ navigation, route }) {
  const [q, setQ] = useState(route?.params?.q || '');
  const [catalog, setCatalog] = useState(null);
  const [catalogErr, setCatalogErr] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [products, setProducts] = useState({ q: '', list: [], loading: false });
  const [shops, setShops] = useState({ q: '', list: [], loading: false });
  const [recent, setRecent] = useState([]);
  const [listening, setListening] = useState(false);
  const [voiceTip, setVoiceTip] = useState(false);
  const inputRef = useRef(null);
  const recRef = useRef(null);

  useEffect(() => {
    let alive = true;
    loadCatalog().then((c) => { if (alive) { setCatalog(c); setCatalogErr(!!c.partial); } }).catch(() => { if (alive) setCatalogErr(true); });
    (async () => {
      try { const v = JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) || '[]'); if (alive && Array.isArray(v)) setRecent(v); } catch (_) {}
    })();
    return () => { alive = false; try { recRef.current?.abort?.(); } catch (_) {} };
  }, []);

  // Opened from the Home mic → start listening straight away.
  useEffect(() => {
    if (route?.params?.voice) startVoice();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const query = q.trim();
  const retryCatalog = () => {
    setRetrying(true);
    loadCatalog().then((c) => { setCatalog(c); setCatalogErr(!!c.partial); })
      .catch(() => setCatalogErr(true))
      .finally(() => setRetrying(false));
  };
  const results = useMemo(() => (catalog && query ? searchCatalog(catalog, query) : null), [catalog, query]);

  // Buy products + shops come from their search endpoints (debounced).
  useEffect(() => {
    const text = parseQuery(query).text || query;
    if (text.length < 2) { setProducts({ q: '', list: [], loading: false }); setShops({ q: '', list: [], loading: false }); return undefined; }
    setProducts((s) => ({ ...s, loading: true }));
    setShops((s) => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      listProducts({ q: text }).then((list) => setProducts({ q: text, list: (list || []).slice(0, 6), loading: false }))
        .catch(() => setProducts({ q: text, list: [], loading: false }));
      listShops(text).then((list) => {
        const needle = text.toLowerCase();
        const hits = (list || []).filter((s) => [s.name, s.shopName, s.city, s.address].some((v) => String(v || '').toLowerCase().includes(needle)));
        setShops({ q: text, list: hits.slice(0, 5), loading: false });
      }).catch(() => setShops({ q: text, list: [], loading: false }));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const remember = async (text) => {
    const v = String(text || '').trim();
    if (!v) return;
    const next = [v, ...recent.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8);
    setRecent(next);
    try { await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch (_) {}
  };
  const clearRecent = async () => {
    setRecent([]);
    try { await AsyncStorage.removeItem(RECENT_KEY); } catch (_) {}
  };
  const go = (name, params) => { remember(query); Keyboard.dismiss(); navigation.navigate(name, params); };

  // ── voice ──
  async function startVoice() {
    if (Platform.OS === 'android') {
      // Android's own speech recogniser (Google voice input) — returns the text.
      try {
        setVoiceTip(false);
        setListening(true);
        const r = await IntentLauncher.startActivityAsync('android.speech.action.RECOGNIZE_SPEECH', {
          extra: {
            'android.speech.extra.LANGUAGE_MODEL': 'free_form',
            'android.speech.extra.LANGUAGE': 'en-IN',
            'android.speech.extra.PROMPT': 'Say a phone, brand or repair',
          },
        });
        const heard = r?.extra?.['android.speech.extra.RESULTS']?.[0];
        if (heard) setQ(String(heard));
      } catch (_) {
        setVoiceTip(true);
        setTimeout(() => inputRef.current?.focus?.(), 150);
      } finally {
        setListening(false);
      }
      return;
    }
    if (!WebSpeech) {
      // No in-app speech engine (Expo Go) — the keyboard's mic does the dictation.
      setVoiceTip(true);
      setTimeout(() => inputRef.current?.focus?.(), 150);
      return;
    }
    try {
      recRef.current?.abort?.();
      const rec = new WebSpeech();
      rec.lang = 'en-IN';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = Array.from(e.results).map((r) => r[0]?.transcript || '').join(' ').trim();
        if (text) setQ(text);
      };
      rec.onerror = () => { setListening(false); setVoiceTip(true); };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      setVoiceTip(false);
      setListening(true);
      rec.start();
    } catch (_) {
      setListening(false);
      setVoiceTip(true);
    }
  }
  const stopVoice = () => { try { recRef.current?.stop?.(); } catch (_) {} setListening(false); };

  // ── navigation targets ──
  const openModel = (m, kind) => {
    const p = modelRouteParams(catalog, m);
    if (kind === 'buy') return go('BuyListing', { title: m.name, q: m.name, categoryId: p.categoryId, categoryCode: p.categoryCode });
    return go('SelectVariant', { flow: kind === 'sell' ? 'SELL' : 'REPAIR', ...p });
  };
  const openBrand = (b, kind) => {
    if (kind === 'buy') return go('BuyListing', { title: b.name, brandId: b.id });
    return go('SelectModel', { flow: kind === 'sell' ? 'SELL' : 'REPAIR', brandId: b.id, brandName: b.name });
  };
  const catParams = (c) => ({ categoryId: c.id, categoryCode: (c.code || '').toUpperCase(), categoryName: c.name });
  const openCategory = (c, kind) => {
    if (kind === 'sell') return go('SellSelectDevice', { flow: 'SELL', ...catParams(c) });
    if (kind === 'buy') return go('BuyCategory', { categoryId: c.id, categoryName: c.name });
    return go('RepairSelectDevice', { flow: 'REPAIR', ...catParams(c) });
  };

  const intent = results?.intent || null;
  const order = orderFor(intent);
  const nothing = results && !results.models.length && !results.brands.length && !results.categories.length && !results.services.length
    && !products.loading && !shops.loading && !products.list.length && !shops.list.length;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: LINE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 9 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" className="active:opacity-70"
            style={{ height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4FBF8', borderWidth: 1, borderColor: '#DCE7E2', marginRight: 8 }}>
            <ArrowLeft size={19} color={BRAND.ink} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, paddingLeft: 12, paddingRight: 6, backgroundColor: BRAND.bg, borderWidth: 1, borderColor: listening ? BRAND.green : LINE }}>
            <Search size={17} color={BRAND.green} />
            <TextInput
              ref={inputRef}
              autoFocus={!route?.params?.voice}
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => remember(query)}
              placeholder={listening ? 'Listening… speak now' : 'Search phones, repairs, brands…'}
              placeholderTextColor={listening ? GREEN_TEXT : MUTED}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search"
              style={[{ flex: 1, marginLeft: 8, paddingVertical: 0, fontSize: rf(13.5), color: BRAND.ink }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search" style={{ padding: 5 }}>
                <X size={16} color={MUTED} />
              </Pressable>
            ) : null}
            <Pressable onPress={listening ? stopVoice : startVoice} hitSlop={6} accessibilityRole="button" accessibilityLabel={listening ? 'Stop voice search' : 'Voice search'} className="active:opacity-70"
              style={{ height: 32, width: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: listening ? BRAND.green : 'transparent' }}>
              {listening ? <MicOff size={16} color="#FFFFFF" /> : <Mic size={17} color={BRAND.ink} />}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 28 }}>
        {listening ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderRadius: 14, padding: 10, backgroundColor: MINT, borderWidth: 1, borderColor: 'rgba(9,173,42,0.35)' }}>
            <View style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: BRAND.green, alignItems: 'center', justifyContent: 'center' }}>
              <Mic size={15} color="#FFFFFF" />
            </View>
            <Text style={{ flex: 1, marginLeft: 9, fontSize: rf(12), fontWeight: '700', color: BRAND.ink }}>Listening… say a phone, brand or repair</Text>
            <Pressable onPress={stopVoice} accessibilityRole="button" className="active:opacity-70" style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#FFFFFF' }}>
              <Text style={{ fontSize: rf(11), fontWeight: '800', color: GREEN_TEXT }}>Stop</Text>
            </Pressable>
          </View>
        ) : null}
        {voiceTip && !listening ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderRadius: 14, padding: 10, backgroundColor: YELLOW_SOFT, borderWidth: 1, borderColor: 'rgba(243,191,35,0.45)' }}>
            <Mic size={16} color={BRAND.ink} />
            <Text style={{ flex: 1, marginLeft: 8, fontSize: rf(11.5), color: BRAND.ink, lineHeight: rf(16) }}>
              Voice search: tap the 🎤 mic on your keyboard and speak — your words appear in the search box.
            </Text>
            <Pressable onPress={() => setVoiceTip(false)} hitSlop={8} accessibilityLabel="Dismiss" style={{ padding: 3 }}>
              <X size={14} color={MUTED} />
            </Pressable>
          </View>
        ) : null}

        {catalogErr && query ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderRadius: 14, padding: 10, backgroundColor: YELLOW_SOFT, borderWidth: 1, borderColor: 'rgba(243,191,35,0.45)' }}>
            <Text style={{ flex: 1, fontSize: rf(11.5), color: BRAND.ink, lineHeight: rf(16) }}>Couldn't load the full device list — showing brands and services only.</Text>
            <Pressable onPress={retryCatalog} disabled={retrying} accessibilityRole="button" accessibilityLabel="Retry loading devices" className="active:opacity-75"
              style={{ marginLeft: 8, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: BRAND.green, opacity: retrying ? 0.6 : 1 }}>
              {retrying ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={{ fontSize: rf(11), fontWeight: '800', color: '#FFFFFF' }}>Retry</Text>}
            </Pressable>
          </View>
        ) : null}

        {/* ── Results ── */}
        {query && !catalog && !catalogErr ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 }}>
            <ActivityIndicator color={BRAND.green} />
            <Text style={{ marginLeft: 8, fontSize: rf(12), color: MUTED }}>Loading devices…</Text>
          </View>
        ) : null}

        {results?.categories?.length ? (
          <>
            <SectionHead title="Quick actions" />
            <Card>
              {results.categories.map((c, i) => (
                <TileRow key={c.id} first={i === 0} title={c.name} Icon={Sparkles}
                  uri={resolveDeviceImageSource({ url: c.imageUrl, base64: c.imageBase64 })}
                  onPress={() => openCategory(c, order[0])}
                  chips={order.map((k) => <ActionChip key={k} kind={k} onPress={() => openCategory(c, k)} />)} />
              ))}
            </Card>
          </>
        ) : null}

        {results?.models?.length ? (
          <>
            <SectionHead title="Devices" right={<Text style={{ fontSize: rf(10.5), color: MUTED }}>{results.models.length}{results.models.length >= 12 ? '+' : ''}</Text>} />
            <Card>
              {results.models.map((m, i) => (
                <TileRow key={m.id} first={i === 0} title={m.name}
                  uri={resolveDeviceImageSource({ url: m.imageUrl, base64: m.imageBase64 })}
                  onPress={() => openModel(m, order[0])}
                  chips={order.filter((k) => k !== 'sell' || m.sellActive !== false).map((k) => <ActionChip key={k} kind={k} onPress={() => openModel(m, k)} />)} />
              ))}
            </Card>
          </>
        ) : null}

        {results?.brands?.length ? (
          <>
            <SectionHead title="Brands" />
            <Card>
              {results.brands.map((b, i) => (
                <TileRow key={b.id} first={i === 0} title={b.name}
                  uri={resolveDeviceImageSource({ url: b.imageUrl, base64: b.imageBase64 })}
                  onPress={() => openBrand(b, order[0])}
                  chips={order.map((k) => <ActionChip key={k} kind={k} onPress={() => openBrand(b, k)} />)} />
              ))}
            </Card>
          </>
        ) : null}

        {results?.services?.length ? (
          <>
            <SectionHead title="Repair services" />
            <Card>
              {results.services.map((s, i) => {
                const c = catalog?.catById?.get(s.deviceCategoryId);
                return (
                  <Row key={s.id} first={i === 0} title={s.name} sub={c ? `${c.name} repair` : 'Repair'}
                    left={<Thumb Icon={Wrench} />}
                    onPress={c ? () => openCategory(c, 'repair') : () => { remember(query); goToTab(navigation, 'Repair'); }}
                    right={<ChevronRight size={15} color={GREEN_TEXT} />} />
                );
              })}
            </Card>
          </>
        ) : null}

        {products.list.length ? (
          <>
            <SectionHead title="Buy" right={<Pressable onPress={() => go('BuyListing', { title: `“${products.q}”`, q: products.q })} hitSlop={8} accessibilityRole="button"><Text style={{ fontSize: rf(11), fontWeight: '700', color: GREEN_TEXT }}>See all</Text></Pressable>} />
            <Card>
              {products.list.map((p, i) => (
                <Row key={p.id} first={i === 0} title={p.title || p.productName || 'Product'} sub={[p.storageLabel, p.color, p.condition].filter(Boolean).join(' · ')}
                  left={<Thumb uri={resolveDeviceImageSource({ url: p.imageUrl || p.productImage })} />}
                  onPress={() => go('BuyProductDetails', { productId: p.id })}
                  right={<Text style={{ fontSize: rf(12.5), fontWeight: '800', color: GREEN_TEXT }}>{p.price ? inr(p.price) : ''}</Text>} />
              ))}
            </Card>
          </>
        ) : null}

        {shops.list.length ? (
          <>
            <SectionHead title="Shops" />
            <Card>
              {shops.list.map((s, i) => (
                <Row key={s.id} first={i === 0} title={s.name || s.shopName} sub={[s.address, s.city].filter(Boolean).join(', ')}
                  left={<Thumb uri={resolveDeviceImageSource({ url: s.frontImageUrl || s.imageUrl })} Icon={Store} round />}
                  onPress={() => go('ShopDetails', { shopId: s.id })}
                  right={<ChevronRight size={15} color={GREEN_TEXT} />} />
              ))}
            </Card>
          </>
        ) : null}

        {query && (products.loading || shops.loading) && catalog ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
            <ActivityIndicator size="small" color={BRAND.green} />
            <Text style={{ marginLeft: 7, fontSize: rf(11), color: MUTED }}>Searching shops & products…</Text>
          </View>
        ) : null}

        {(nothing || (query && catalogErr && !catalog && !products.list.length && !shops.list.length && !products.loading && !shops.loading)) ? (
          <View style={{ alignItems: 'center', marginTop: 26, paddingHorizontal: 20 }}>
            <View style={{ height: 52, width: 52, borderRadius: 26, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
              <Search size={22} color={GREEN_TEXT} />
            </View>
            <Text style={{ marginTop: 10, fontSize: rf(14), fontWeight: '800', color: BRAND.ink }}>No results for “{query}”</Text>
            <Text style={{ marginTop: 4, fontSize: rf(11.5), color: MUTED, textAlign: 'center' }}>
              {catalogErr ? "Couldn't load the device list — check your connection and try again." : 'Try a phone name like “iPhone 13”, a brand, or a repair like “battery”.'}
            </Text>
            <Pressable onPress={() => navigation.navigate('Scan', { mode: 'product' })} accessibilityRole="button" className="active:opacity-85"
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: BRAND.green, backgroundColor: '#FFFFFF' }}>
              <Camera size={15} color={GREEN_TEXT} />
              <Text style={{ marginLeft: 6, fontSize: rf(12), fontWeight: '800', color: GREEN_TEXT }}>Scan your device instead</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
