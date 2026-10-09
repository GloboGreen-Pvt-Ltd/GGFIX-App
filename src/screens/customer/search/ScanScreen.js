import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft, Zap, ZapOff, ImageUp, Keyboard as KeyboardIcon, QrCode, ScanBarcode, Camera,
  Smartphone, Store, Phone, ExternalLink, SearchX, RotateCcw, Wrench, Tag, ShoppingBag, Search,
} from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import { resolveDeviceImageSource } from '../../../utils/images';
import { classifyScan, findOrderByCode, orderRoute, phoneKey } from '../../../utils/scanCode';
import { loadCatalog, modelRouteParams, norm } from '../../../utils/searchCatalog';
import { getModelByNumber, lookupImei } from '../../../api/masterData';
import { listMyOrders, getServiceTicket } from '../../../api/orders';
import { listShops, getShopBySlug } from '../../../api/shops';
import { detectProductFromPhoto, warmProductDetect } from '../../../lib/productDetect';

const GREEN_TEXT = '#078F23';
const MINT = '#EAF8EC';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';
const BARCODE_TYPES = ['qr', 'datamatrix', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14'];

const MODES = {
  qr: { title: 'Scan QR code', hint: 'Point at a GGFIX shop QR, a repair ticket label or any QR code', icon: QrCode },
  device: { title: 'Scan your device', hint: "Point at the barcode on your phone's box (model number or IMEI)", icon: ScanBarcode },
  product: { title: 'Search product by camera', hint: 'Point at the device (the back with the cameras works best) and tap the shutter', icon: Camera },
};

// The catalogue model whose model number matches a scanned code — exactly, or
// as the start of a box SKU that adds colour / region letters (SM-S918BZKCINS).
function modelForCode(catalog, code) {
  const c = norm(code).replace(/ /g, '');
  if (!catalog?.models || c.length < 4) return null;
  let best = null;
  let bestLen = 0;
  for (const m of catalog.models) {
    for (const n of m._nums || []) {
      if (n.length >= 4 && n.length > bestLen && c.startsWith(n)) { best = m; bestLen = n.length; }
    }
  }
  return best;
}

// NOTE: Pressables take plain style objects only — NativeWind's cssInterop
// drops function-form `style={({ pressed }) => ...}` on native.
function SheetButton({ icon: Icon, label, onPress, primary }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-85"
      style={{
        flex: 1, height: 42, borderRadius: 12, marginHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: primary ? BRAND.green : '#FFFFFF', borderWidth: primary ? 0 : 1.5, borderColor: BRAND.green,
      }}
    >
      {Icon ? <Icon size={15} color={primary ? '#FFFFFF' : GREEN_TEXT} /> : null}
      <Text style={{ marginLeft: Icon ? 6 : 0, fontSize: rf(12.5), fontWeight: '800', color: primary ? '#FFFFFF' : GREEN_TEXT }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export default function ScanScreen({ navigation, route }) {
  // Home / Search camera opens "product" mode; anything else scans a device box.
  const [mode, setMode] = useState(route?.params?.mode === 'product' ? 'product' : 'device');
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [result, setResult] = useState(null); // { state, ... }
  const lockRef = useRef(false);
  const camRef = useRef(null);
  const isProduct = mode === 'product';
  const catalogRef = useRef(null);
  const M = MODES[mode];

  useEffect(() => {
    if (permission && !permission.granted && permission.status === 'undetermined' && permission.canAskAgain !== false) requestPermission();
  }, [permission, requestPermission]);

  // Warm the catalogue so a scanned model number resolves to a full device.
  useEffect(() => { loadCatalog().then((c) => { catalogRef.current = c; }).catch(() => {}); }, []);
  // Product mode: build the detector's catalogue index before the first photo.
  useEffect(() => { if (isProduct) warmProductDetect(); }, [isProduct]);

  const reset = () => { lockRef.current = false; setResult(null); };
  const open = (name, params) => navigation.replace(name, params);

  const deviceFrom = async (m) => {
    const catalog = catalogRef.current || (await loadCatalog().catch(() => null));
    const full = catalog?.models?.find((x) => x.id === m.id) || m;
    return { model: full, params: modelRouteParams(catalog, full) };
  };

  async function resolve(raw) {
    const c = classifyScan(raw);
    setResult({ state: 'resolving', raw });
    try {
      if (c.kind === 'empty') return reset();
      if (c.kind === 'text') return open('Search', { q: c.text });
      if (c.kind === 'url') return setResult({ state: 'link', url: c.url, host: c.host });
      if (c.kind === 'phone') return setResult({ state: 'phone', phone: c.phone });

      if (c.kind === 'shopLink') {
        const shop = await getShopBySlug(c.slug).catch(() => null);
        if (shop?.id) return open('ShopDetails', { shopId: shop.id });
        return setResult({ state: 'link', url: c.url, host: 'ggfix.in' });
      }

      if (c.kind === 'vcard') {
        // A GGFIX shop QR: find the shop by its phone, else by its exact name.
        const list = c.name ? await listShops(c.name).catch(() => []) : [];
        const keys = new Set(c.phones.map(phoneKey));
        const byPhone = (list || []).find((s) => [s.mobile, s.phone, s.contactPhone, s.ownerPhone].some((p) => p && keys.has(phoneKey(p))));
        const byName = (list || []).filter((s) => String(s.name || s.shopName || '').trim().toLowerCase() === String(c.name || '').trim().toLowerCase());
        const shop = byPhone || (byName.length === 1 ? byName[0] : null);
        if (shop?.id) return open('ShopDetails', { shopId: shop.id });
        return setResult({ state: 'contact', name: c.name, phones: c.phones, address: c.address });
      }

      // Product search: model number / box SKU → that model's search results.
      if (mode === 'product' && (c.kind === 'code' || c.kind === 'imei')) {
        if (c.kind === 'imei') {
          const r = await lookupImei(c.imei);
          const name = r?.matched ? r.device?.modelName : null;
          if (name) return open('Search', { q: name });
          return setResult({ state: 'notFound', raw, typeOnly: true, message: "That's the IMEI barcode — it can't name the product. Scan the model-number barcode on the box (e.g. SM-S918B) or type the product name." });
        }
        const byNumber = await getModelByNumber(c.code).catch(() => null);
        if (byNumber?.name) return open('Search', { q: byNumber.name });
        const local = modelForCode(catalogRef.current || (await loadCatalog().catch(() => null)), c.code);
        if (local) return open('Search', { q: local.name });
        // Shop barcodes (EAN / UPC) carry no model — searching the digits finds nothing.
        if (/^\d{8,14}$/.test(c.code)) {
          return setResult({ state: 'notFound', raw, typeOnly: true, message: "This barcode isn't linked to a product. Scan the model-number barcode on the box (e.g. SM-S918B) or type the product name." });
        }
        return open('Search', { q: c.code });
      }

      if (c.kind === 'uuid' || c.kind === 'code') {
        const code = c.kind === 'uuid' ? c.id : c.code;
        const orders = await listMyOrders().catch(() => []);
        const order = findOrderByCode(orders, code);
        if (order) { const [name, params] = orderRoute(order); return open(name, params); }
        if (c.kind === 'uuid') {
          const ticket = await getServiceTicket(code).catch(() => null);
          if (ticket && (ticket.id || ticket.trackingId)) return open('ServiceTicketDetails', { ticketId: code, fromOrders: true });
          return setResult({ state: 'notFound', raw, message: "This code isn't linked to any of your orders." });
        }
        const model = await getModelByNumber(code);
        if (model?.id) return setResult({ state: 'device', ...(await deviceFrom(model)) });
        return setResult({ state: 'notFound', raw, message: "We couldn't match this code to an order or a device." });
      }

      if (c.kind === 'imei') {
        const r = await lookupImei(c.imei);
        const d = r?.matched ? r.device : null;
        if (d?.modelId) {
          return setResult({ state: 'device', ...(await deviceFrom({ id: d.modelId, name: d.modelName, brandId: d.brandId, categoryId: d.categoryId, imageUrl: d.imageUrl })) });
        }
        return setResult({ state: 'notFound', raw, message: "We couldn't identify the model from this IMEI yet. Search for your model instead." });
      }
      return reset();
    } catch (_) {
      return setResult({ state: 'notFound', raw, message: 'Something went wrong while checking this code. Please try again.' });
    }
  }

  // Product mode: identify the actual device in a photo (visual search), then
  // offer Repair / Sell / Buy for the best match or a close alternative.
  const identify = async (photo) => {
    lockRef.current = true;
    setResult({ state: 'identifying' });
    try {
      // Shared detector (lib/productDetect, same as the Partner app): OCR model
      // number → catalogue name → Google Vision / visual ranking, with a
      // confidence; only a clear high match is auto-selected, else the top 3.
      const r = await detectProductFromPhoto(photo.uri, { width: photo.width, height: photo.height });
      if (r.status === 'none') {
        if (r.label) {
          // Recognised (e.g. "Samsung Galaxy S23") but no confident catalogue
          // match — search that name instead of guessing a device.
          lockRef.current = false;
          return navigation.replace('Search', { q: String(r.label) });
        }
        return setResult({ state: 'notFound', typeOnly: true, message: "Couldn't recognise this product. Fill the frame with the device (or its box label) in good light and try again, or type its name." });
      }
      const items = await Promise.all(r.candidates.map(async (c) => ({
        match: { id: c.id, model: c.name, brand: c.brand, imageUrl: c.ref?.imageUrl || null },
        score: c.confidence,
        ...(await deviceFrom(c.ref)),
      })));
      return setResult({ state: 'product', confidence: r.status === 'exact' ? 'high' : 'medium', items, pick: 0 });
    } catch (_) {
      return setResult({
        state: 'notFound',
        typeOnly: true,
        message: "Can't load the product catalogue. Check your connection and try again, or type the name.",
      });
    }
  };

  const capture = async () => {
    if (lockRef.current || !camRef.current || !camReady) return;
    lockRef.current = true;
    setResult({ state: 'identifying' });
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.6 });
      if (!pic?.uri) throw new Error('no photo');
      await identify({ uri: pic.uri, mimeType: 'image/jpeg', width: pic.width, height: pic.height });
    } catch (_) {
      setResult({ state: 'notFound', typeOnly: true, message: "Couldn't take the photo. Please try again." });
    }
  };

  const onScanned = ({ data }) => {
    if (lockRef.current || !data) return;
    lockRef.current = true;
    resolve(String(data));
  };

  const fromGallery = async () => {
    try {
      const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
      if (pick.canceled || !pick.assets?.[0]?.uri) return;
      if (isProduct) return identify({ uri: pick.assets[0].uri, mimeType: pick.assets[0].mimeType, width: pick.assets[0].width, height: pick.assets[0].height });
      lockRef.current = true;
      setResult({ state: 'resolving', raw: '' });
      const found = await scanFromURLAsync(pick.assets[0].uri, BARCODE_TYPES).catch(() => []);
      if (found?.[0]?.data) return resolve(String(found[0].data));
      return setResult({ state: 'notFound', raw: '', message: 'No QR code or barcode found in that photo.' });
    } catch (_) {
      lockRef.current = false;
    }
  };

  const typeInstead = () => navigation.replace('Search', {});
  const granted = !!permission?.granted;

  // ── result card (bottom sheet) ──
  const renderResult = () => {
    const r = result;
    if (r.state === 'identifying') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}>
          <ActivityIndicator color={BRAND.green} />
          <Text style={{ marginLeft: 9, fontSize: rf(13), fontWeight: '700', color: BRAND.ink }}>Identifying product…</Text>
        </View>
      );
    }
    if (r.state === 'resolving') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}>
          <ActivityIndicator color={BRAND.green} />
          <Text style={{ marginLeft: 9, fontSize: rf(13), fontWeight: '700', color: BRAND.ink }}>Checking code…</Text>
        </View>
      );
    }
    const Head = ({ icon: Icon, title, sub, img }) => (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ height: 46, width: 46, borderRadius: 12, backgroundColor: img ? '#FFFFFF' : MINT, borderWidth: 1, borderColor: BRAND.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 10 }}>
          {img ? <Image source={{ uri: img }} style={{ width: 42, height: 42 }} resizeMode="contain" /> : <Icon size={20} color={GREEN_TEXT} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: rf(14), fontWeight: '800', color: BRAND.ink }} numberOfLines={2}>{title}</Text>
          {sub ? <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 1 }} numberOfLines={2}>{sub}</Text> : null}
        </View>
      </View>
    );
    if (r.state === 'product') {
      const cur = r.items[r.pick] || r.items[0];
      const p = cur.params;
      const name = cur.model.name || cur.match.model;
      const brand = p.brandName || cur.match.brand;
      const sure = r.confidence === 'high' && r.pick === 0;
      return (
        <>
          <Head icon={Smartphone} title={brand && !String(name).toLowerCase().startsWith(String(brand).toLowerCase()) ? `${brand} ${name}` : name} sub={`${sure ? 'Product found' : r.items.length > 1 ? 'Pick your device — closest matches' : 'Best match — check this is your device'} · ${Math.round((cur.score || 0) * 100)}% match`} img={p.modelImageUrl || cur.match.imageUrl} />
          <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
            <SheetButton primary icon={Wrench} label="Repair" onPress={() => open('SelectVariant', { flow: 'REPAIR', ...p })} />
            {cur.model.sellActive !== false ? <SheetButton icon={Tag} label="Sell" onPress={() => open('SelectVariant', { flow: 'SELL', ...p })} /> : null}
            <SheetButton icon={ShoppingBag} label="Buy" onPress={() => open('BuyListing', { title: name, q: name, categoryId: p.categoryId, categoryCode: p.categoryCode })} />
          </View>
          {r.items.length > 1 ? (
            <>
              <Text style={{ marginTop: 12, marginBottom: 6, fontSize: rf(11), fontWeight: '700', color: MUTED }}>Not this one? Other close matches</Text>
              <View style={{ flexDirection: 'row', marginHorizontal: -3 }}>
                {r.items.map((it, i) => (i === r.pick ? null : (
                  <Pressable
                    key={it.match.id}
                    onPress={() => setResult({ ...r, pick: i })}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${it.model.name || it.match.model}`}
                    className="active:opacity-80"
                    style={{ flex: 1, marginHorizontal: 3, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1, borderColor: LINE }}
                  >
                    {it.match.imageUrl ? <Image source={{ uri: it.match.imageUrl }} style={{ width: 34, height: 34 }} resizeMode="contain" /> : <Smartphone size={20} color={GREEN_TEXT} />}
                    <Text numberOfLines={2} style={{ marginTop: 3, fontSize: rf(9.5), fontWeight: '700', color: BRAND.ink, textAlign: 'center' }}>{it.model.name || it.match.model}</Text>
                  </Pressable>
                )))}
              </View>
            </>
          ) : null}
        </>
      );
    }
    if (r.state === 'device') {
      const p = r.params;
      return (
        <>
          <Head icon={Smartphone} title={r.model.name} sub={[p.brandName, p.categoryName].filter(Boolean).join(' · ')} img={p.modelImageUrl} />
          <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
            <SheetButton primary icon={Wrench} label="Repair" onPress={() => open('SelectVariant', { flow: 'REPAIR', ...p })} />
            {r.model.sellActive !== false ? <SheetButton icon={Tag} label="Sell" onPress={() => open('SelectVariant', { flow: 'SELL', ...p })} /> : null}
            <SheetButton icon={ShoppingBag} label="Buy" onPress={() => open('BuyListing', { title: r.model.name, q: r.model.name, categoryId: p.categoryId, categoryCode: p.categoryCode })} />
          </View>
        </>
      );
    }
    if (r.state === 'contact') {
      const phone = r.phones[0];
      return (
        <>
          <Head icon={Store} title={r.name || 'Contact'} sub={[phone, r.address].filter(Boolean).join(' · ')} />
          <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
            {phone ? <SheetButton primary icon={Phone} label="Call" onPress={() => Linking.openURL(`tel:${String(phone).replace(/\s+/g, '')}`)} /> : null}
            {r.name ? <SheetButton icon={Search} label="Find shop" onPress={() => open('Search', { q: r.name })} /> : null}
          </View>
        </>
      );
    }
    if (r.state === 'phone') {
      return (
        <>
          <Head icon={Phone} title={r.phone} sub="Phone number" />
          <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
            <SheetButton primary icon={Phone} label="Call" onPress={() => Linking.openURL(`tel:${String(r.phone).replace(/\s+/g, '')}`)} />
          </View>
        </>
      );
    }
    if (r.state === 'link') {
      return (
        <>
          <Head icon={ExternalLink} title={r.host || 'Link'} sub={r.url} />
          <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
            <SheetButton primary icon={ExternalLink} label="Open link" onPress={() => Linking.openURL(r.url)} />
          </View>
        </>
      );
    }
    // notFound
    return (
      <>
        <Head icon={SearchX} title="No match found" sub={r.message} />
        {r.raw ? <Text style={{ fontSize: rf(11), color: MUTED, marginTop: -6, marginBottom: 10 }} numberOfLines={1} selectable>Scanned: {r.raw}</Text> : null}
        <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
          {r.typeOnly ? (
            <SheetButton primary icon={KeyboardIcon} label="Type product name" onPress={typeInstead} />
          ) : (
            <SheetButton primary icon={Search} label={r.raw ? 'Search this' : 'Search'} onPress={() => open('Search', { q: r.raw || '' })} />
          )}
        </View>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {granted ? (
        <CameraView
          ref={camRef}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          facing="back"
          enableTorch={torch}
          onCameraReady={() => setCamReady(true)}
          barcodeScannerSettings={isProduct ? undefined : { barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={isProduct || result ? undefined : onScanned}
        />
      ) : null}

      {/* Top bar */}
      <SafeAreaView edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" className="active:opacity-70"
            style={{ height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <ArrowLeft size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: rf(16), fontWeight: '800', color: '#FFFFFF' }}>{M.title}</Text>
          {granted && Platform.OS !== 'web' ? (
            <Pressable onPress={() => setTorch((t) => !t)} hitSlop={8} accessibilityRole="button" accessibilityLabel={torch ? 'Torch off' : 'Torch on'} className="active:opacity-70"
              style={{ height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: torch ? BRAND.yellow : 'rgba(255,255,255,0.18)' }}>
              {torch ? <Zap size={18} color={BRAND.ink} /> : <ZapOff size={18} color="#FFFFFF" />}
            </Pressable>
          ) : <View style={{ width: 38 }} />}
        </View>

      </SafeAreaView>

      {/* Viewfinder / permission */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        {granted ? (
          <>
            <View style={{ width: isProduct ? 250 : 236, height: isProduct ? 300 : mode === 'qr' ? 236 : 150 }}>
              {[[0, 0], [0, 1], [1, 0], [1, 1]].map(([v, h]) => (
                <View key={`${v}${h}`} style={{
                  position: 'absolute', width: 34, height: 34, borderColor: BRAND.green,
                  [v ? 'bottom' : 'top']: 0, [h ? 'right' : 'left']: 0,
                  [v ? 'borderBottomWidth' : 'borderTopWidth']: 4, [h ? 'borderRightWidth' : 'borderLeftWidth']: 4,
                  [`border${v ? 'Bottom' : 'Top'}${h ? 'Right' : 'Left'}Radius`]: 14,
                }} />
              ))}
            </View>
            <Text style={{ marginTop: 16, fontSize: rf(12.5), color: '#FFFFFF', textAlign: 'center', lineHeight: rf(18), textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>{M.hint}</Text>
          </>
        ) : permission ? (
          <View style={{ width: '100%', maxWidth: 360, borderRadius: 18, padding: 16, alignItems: 'center', backgroundColor: '#FFFFFF' }}>
            <View style={{ height: 52, width: 52, borderRadius: 26, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={24} color={GREEN_TEXT} />
            </View>
            <Text style={{ marginTop: 10, fontSize: rf(15), fontWeight: '800', color: BRAND.ink, textAlign: 'center' }}>Allow camera to scan</Text>
            <Text style={{ marginTop: 4, fontSize: rf(12), color: MUTED, textAlign: 'center', lineHeight: rf(17) }}>
              GGFIX uses the camera only to read QR codes and barcodes. You can also pick a photo from your gallery.
            </Text>
            <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 14, marginHorizontal: -4 }}>
              {permission.canAskAgain !== false ? (
                <SheetButton primary icon={Camera} label="Allow camera" onPress={requestPermission} />
              ) : (
                <SheetButton primary icon={Camera} label="Open settings" onPress={() => Linking.openSettings?.()} />
              )}
            </View>
          </View>
        ) : (
          <ActivityIndicator color="#FFFFFF" />
        )}
      </View>

      {/* Bottom sheet */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 }}>
          {result ? (
            <>
              {renderResult()}
              {result.state !== 'resolving' && result.state !== 'identifying' ? (
                <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel="Scan again" className="active:opacity-70" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingVertical: 6 }}>
                  <RotateCcw size={14} color={GREEN_TEXT} />
                  <Text style={{ marginLeft: 6, fontSize: rf(12.5), fontWeight: '800', color: GREEN_TEXT }}>{isProduct ? 'Take another photo' : 'Scan again'}</Text>
                </Pressable>
              ) : null}
            </>
          ) : isProduct ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
              <Pressable onPress={fromGallery} accessibilityRole="button" accessibilityLabel="Pick a photo" className="active:opacity-70" style={{ alignItems: 'center', width: 80 }}>
                <View style={{ height: 44, width: 44, borderRadius: 22, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}><ImageUp size={20} color={GREEN_TEXT} /></View>
                <Text style={{ marginTop: 4, fontSize: rf(11), fontWeight: '700', color: BRAND.ink }}>Gallery</Text>
              </Pressable>
              <Pressable
                onPress={capture}
                disabled={!granted || !camReady}
                accessibilityRole="button"
                accessibilityLabel="Take photo to identify product"
                className="active:opacity-80"
                style={{ height: 70, width: 70, borderRadius: 35, borderWidth: 4, borderColor: BRAND.green, alignItems: 'center', justifyContent: 'center', opacity: granted && camReady ? 1 : 0.4 }}
              >
                <View style={{ height: 54, width: 54, borderRadius: 27, backgroundColor: BRAND.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={24} color="#FFFFFF" />
                </View>
              </Pressable>
              <Pressable onPress={typeInstead} accessibilityRole="button" accessibilityLabel="Type instead" className="active:opacity-70" style={{ alignItems: 'center', width: 80 }}>
                <View style={{ height: 44, width: 44, borderRadius: 22, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}><KeyboardIcon size={20} color={GREEN_TEXT} /></View>
                <Text style={{ marginTop: 4, fontSize: rf(11), fontWeight: '700', color: BRAND.ink }}>Type</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
              <SheetButton icon={ImageUp} label="Upload photo" onPress={fromGallery} />
              <SheetButton icon={KeyboardIcon} label="Type instead" onPress={typeInstead} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
