import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sellProgress } from '../../../utils/sellStatus';
import { getSellOrder, getSellOrderQuotations, listSellOrders, getSellPurchase } from '../../../api/orders';
import { getBrands, getModelsByBrand, getRamOptions, getStorageOptions } from '../../../api/masterData';
import { listAddresses } from '../../../api/customer';
import { getShop } from '../../../api/shops';
import { splitTypedSummary } from '../../../utils/typedDevice';
import { useFocusPolling } from '../../../hooks/useFocusPolling';

// Shared by the Quotations Received / Quote Details / Schedule Pickup / Order
// Tracking screens: one sell order with everything they show — the order, its
// quotations, the device's display name + specs, the pickup address, and each
// quoting shop's public profile (photo, address, phone, pickup hours, distance
// from the pickup address). All live data; nothing is filled in.
//
// Refetches on focus. `poll` re-reads the order every 15 s while the screen is
// open (master data and shop profiles are cached, so a poll is one request).
export function useSellOrder(sellOrderId, { poll = false } = {}) {
  const [state, setState] = useState({ loading: true, refreshing: false, error: null, order: null, quotes: [], device: null, address: null, shops: {} });
  const meta = useRef({ device: null, address: undefined, shops: {} });

  const load = useCallback(async (mode = 'load') => {
    // A different sell order (e.g. the Buyer Enquiries listing switcher): drop
    // the previous order's device / address / shop cache.
    if (meta.current.id !== sellOrderId) meta.current = { id: sellOrderId, device: null, address: undefined, shops: {} };
    if (mode === 'refresh') setState((s) => ({ ...s, refreshing: true }));
    try {
      if (!sellOrderId) throw new Error('This sell order link is missing its id.');
      const so = await loadSellOrder(sellOrderId);
      if (!so) throw new Error('Sell order not found.');
      const quotes = Array.isArray(so.quotations) ? so.quotations : await getSellOrderQuotations(sellOrderId).catch(() => []);

      // Device + address: resolved once per screen visit.
      if (!meta.current.device || mode === 'refresh') {
        const [models, rams, storages, brands, addresses] = await Promise.all([
          so.brandId ? getModelsByBrand(so.brandId).catch(() => []) : Promise.resolve([]),
          getRamOptions().catch(() => []),
          getStorageOptions().catch(() => []),
          getBrands().catch(() => []),
          listAddresses().catch(() => []),
        ]);
        const model = (models || []).find((m) => m.id === so.modelId);
        const brand = (brands || []).find((b) => b.id === so.brandId);
        const ram = (rams || []).find((r) => r.id === so.ramOptionId);
        const storage = (storages || []).find((x) => x.id === so.storageOptionId);
        const typed = splitTypedSummary(so.deviceConditionSummary);
        meta.current.device = {
          name: model?.name || so.modelName || typed.name || (brand?.name ? `${brand.name} device` : 'Device'),
          brand: brand?.name || null,
          image: model?.imageUrl || (model?.imageBase64 ? `data:image/png;base64,${model.imageBase64}` : null) || so.images?.front || null,
          specs: [ram?.label || so.ramLabel, storage?.label || so.storageLabel].filter(Boolean).join(' / ') || typed.specs || '',
          color: so.color || null,
          condition: typed.condition || null,
        };
        meta.current.address = so.addressId ? (addresses || []).find((a) => a.id === so.addressId) || null : null;
      }

      // Shop profiles for any shop not fetched yet (distance from the pickup address).
      const a = meta.current.address;
      const coords = a && a.latitude != null && a.longitude != null ? { lat: a.latitude, lng: a.longitude } : {};
      const missing = [...new Set(quotes.map((q) => q.shopId).concat(so.shopId || []).filter(Boolean))]
        .filter((id) => !(id in meta.current.shops));
      if (missing.length) {
        const rows = await Promise.all(missing.map((id) => getShop(id, coords).catch(() => null)));
        missing.forEach((id, i) => { meta.current.shops[id] = rows[i]; });
      }

      setState({
        loading: false, refreshing: false, error: null, order: so, quotes: quotes || [],
        device: meta.current.device, address: meta.current.address, shops: { ...meta.current.shops },
      });
    } catch (e) {
      // A failed background poll keeps what's on screen.
      setState((s) => (mode === 'poll' && s.order
        ? s
        : { ...s, loading: false, refreshing: false, error: e?.message || 'Could not load this sell order.' }));
    }
  }, [sellOrderId]);

  useFocusEffect(useCallback(() => { load('load'); }, [load]));
  useFocusPolling(useCallback(() => { if (poll) load('poll'); }, [load, poll]));

  return { ...state, refresh: () => load('refresh'), reload: () => load('load') };
}

// ---- quote helpers (live fields only) ----
const up = (v) => String(v ?? '').trim().toUpperCase();
export const money = (v) => (Number(v) > 0 ? `₹${Number(v).toLocaleString('en-IN')}` : '—');
export const km = (shop) => (shop?.distanceKm != null && Number.isFinite(Number(shop.distanceKm)) ? `${Number(shop.distanceKm).toFixed(1)} km` : null);

/** Has this order already settled on a shop (no more accepting)? */
export function orderLocked(order) {
  const st = up(order?.status);
  return !!order?.shopId || /CANCEL/.test(st) || !['AWAITING_QUOTATION', 'PENDING', 'DRAFT', ''].includes(st);
}
/** 'accepted' | 'rejected' | 'open' | 'closed' for one quotation of `order`. */
export function quoteState(order, q) {
  const st = up(q?.status);
  if ((order?.shopId && q?.shopId === order.shopId) || st === 'ACCEPTED') return 'accepted';
  if (st === 'REJECTED') return 'rejected';
  return orderLocked(order) ? 'closed' : 'open';
}
/** The highest open / accepted offer — the "Best Offer". */
export function bestQuoteId(order, quotes) {
  let best = null;
  (quotes || []).forEach((q) => {
    if (['rejected', 'closed'].includes(quoteState(order, q))) return;
    if (!best || Number(q.quotationPrice) > Number(best.quotationPrice)) best = q;
  });
  return best?.id || null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "03 Nov 2026, 10:00 AM" (or just the date). */
export function fmtDateTime(v, { time = true } = {}) {
  // A bare "YYYY-MM-DD" (server LocalDate) is that local day — new Date() would read it as UTC.
  const d = v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${v}T00:00:00` : v) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const date = `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return time ? `${date}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` : date;
}
export function ago(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return fmtDateTime(v, { time: false });
}

// App colour theme for the quote → pickup screens (teal brand, gold best
// offer, green success, red reject, navy text).
export const SQ = {
  primary: '#035C6C',
  primarySoft: '#E5F3F5',
  primaryTint: '#F0F8F9',
  primaryLine: 'rgba(3,92,108,0.28)',
  navy: '#1C3053',
  muted: '#606E87',
  line: '#E5E7EB',
  page: '#F5F7F8',
  gold: '#FAA700',
  goldSoft: '#FFF4D6',
  success: '#609138',
  successSoft: '#EEF5E8',
  red: '#F32C26',
  redSoft: '#FDEAE9',
};
// Pickup / visit time confirmed on Schedule Pickup. The server can't store it
// after a quote is accepted, so it's kept on this phone: { mode, date, label, slot }.
export const PICKUP_KEY = 'ggfix.sellPickup.v1';
export async function getSavedPickup(sellOrderId) {
  try { return (JSON.parse(await AsyncStorage.getItem(PICKUP_KEY)) || {})[sellOrderId] || null; } catch (_) { return null; }
}
/** The saved pickup for this order, re-read whenever the screen gains focus. */
export function useSavedPickup(sellOrderId) {
  const [saved, setSaved] = useState(null);
  useFocusEffect(useCallback(() => {
    let off = false;
    if (sellOrderId) getSavedPickup(sellOrderId).then((s) => { if (!off) setSaved(s); });
    return () => { off = true; };
  }, [sellOrderId]));
  return saved;
}
/** "05 Nov 2026 · 10:00 AM – 12:00 PM" — the order's own pickup (server) or the one saved here. */
export function fmtPickup(order, saved) {
  if (order?.pickupDate) {
    const p = sellProgress(order);
    return [fmtDateTime(order.pickupDate, { time: false }), p.pickup.slot].filter(Boolean).join(' · ');
  }
  return saved ? `${saved.label} · ${saved.slot}` : '';
}
/** Quote accepted → Schedule Pickup until a time is set (server or phone), then Track Pickup. */
export const pickupScheduled = (order, saved) => !!(order?.pickupDate || saved);

// Once a shop is chosen, the Partner purchase workflow (GET /sell-orders/{id}/purchase)
// carries the pickup person, inspection, revised price and payout. Merge it into
// the fields sellProgress already reads; `purchase` keeps the raw view for the
// final price request. Fields the order already has win.
export function withPurchase(so, pv) {
  if (!so || !pv) return so;
  const p = pv.pickup || {};
  const pay = pv.payment || {};
  return {
    ...so,
    pickupPersonName: so.pickupPersonName || p.personName,
    pickupPersonPhone: so.pickupPersonPhone || p.personPhone,
    pickupAssignedAt: so.pickupAssignedAt || p.assignedAt,
    pickupStartedAt: so.pickupStartedAt || p.startedAt,
    pickedUpAt: so.pickedUpAt || p.pickedUpAt || p.receivedAt,
    inspectedAt: so.inspectedAt || pv.inspection?.inspectedAt,
    payoutMethod: so.payoutMethod || pay.method,
    paymentReference: so.paymentReference || pay.reference,
    paidAmount: so.paidAmount ?? pay.amount,
    paidAt: so.paidAt || pay.paidAt,
    paymentStatus: so.paymentStatus || (pay.status && pay.status !== 'PENDING' ? pay.status : undefined),
    completedAt: so.completedAt || pv.completedAt,
    purchase: pv,
  };
}
/** GET /sell-orders/{id}, plus its purchase view once a shop is chosen. */
export async function loadSellOrder(id) {
  const so = await getSellOrder(id);
  return so?.shopId ? withPurchase(so, await getSellPurchase(id).catch(() => null)) : so;
}

// How the shop takes the device, as the Partner chose it on the quote:
// 'SHOP_VISIT' | 'PICKUP' | null (unknown, never assumed). A `fulfilment` field
// wins; the live server keeps the choice only as the fixed opening it writes
// into the quote note (ListingQuotationController.noteFor), so only those exact
// server phrases count — never the shop's own remarks.
const FULFILMENT_NOTE = [['Visit the shop to sell', 'SHOP_VISIT'], ['Free pickup from your location', 'PICKUP']];
export function quoteFulfilment(q) {
  const f = up(q?.fulfilment ?? q?.fulfilmentMethod).replace('VISIT_SHOP', 'SHOP_VISIT');
  if (f === 'SHOP_VISIT' || f === 'PICKUP') return f;
  const hit = FULFILMENT_NOTE.find(([p]) => String(q?.note || '').startsWith(p));
  return hit ? hit[1] : null;
}
export const FULFILMENT_LABEL = { SHOP_VISIT: 'Visit Shop', PICKUP: 'Free Pickup' };

/** After acceptance: pickup → Schedule, then Track Pickup; a visit (or unknown method) → the order status, never a pickup. */
export function handoverAction(method, order, saved) {
  if (method === 'PICKUP') return pickupScheduled(order, saved) ? { route: 'SellOrderTracking', label: 'Track Pickup' } : { route: 'SellSchedulePickup', label: 'Schedule Pickup' };
  return { route: 'SellOrderTracking', label: method === 'SHOP_VISIT' ? 'View Visit Status' : 'View Order Status' };
}

/** Google Maps directions to the shop: its coordinates, else its address. */
export function mapsUrl(shop) {
  if (shop?.latitude != null && shop?.longitude != null) return `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`;
  return shop?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}` : null;
}

export const cardShadow ={ shadowColor: '#1C3053', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 };

// Sell order statuses: a sale agreed / done, and closed.
export const SOLD_STATUSES = new Set(['SELL_CONFIRMED', 'COMPLETED', 'PICKED_UP', 'SOLD']);
export const isSold = (o) => SOLD_STATUSES.has(up(o?.status));
export const isCancelled = (o) => /CANCEL/.test(up(o?.status));
const WORKING = { WORKING: 'Working', DEAD: 'Not working' };

/** The customer's sell listings (GET /sell-orders) with display names, newest first. */
export async function fetchSellListings() {
  const orders = (await listSellOrders()) || [];
  const brandIds = [...new Set(orders.map((o) => o.brandId).filter(Boolean))];
  const [brands, rams, storages, ...modelLists] = await Promise.all([
    getBrands().catch(() => []),
    getRamOptions().catch(() => []),
    getStorageOptions().catch(() => []),
    ...brandIds.map((id) => getModelsByBrand(id).catch(() => [])),
  ]);
  const models = modelLists.flat();
  return orders.map((o) => {
    const model = models.find((m) => m.id === o.modelId);
    const brand = (brands || []).find((b) => b.id === o.brandId);
    const typed = splitTypedSummary(o.deviceConditionSummary);
    return {
      id: o.id,
      order: o,
      number: o.sellNumber ? String(o.sellNumber).replace(/^#+/, '') : '',
      name: model?.name || o.modelName || typed.name || (brand?.name ? `${brand.name} device` : 'Device'),
      specs: [(rams || []).find((r) => r.id === o.ramOptionId)?.label || o.ramLabel, (storages || []).find((x) => x.id === o.storageOptionId)?.label || o.storageLabel].filter(Boolean).join(' / '),
      working: WORKING[up(o.workingCondition)] || null,
      image: model?.imageUrl || o.images?.front || null,
    };
  });
}
