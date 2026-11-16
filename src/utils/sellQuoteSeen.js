import AsyncStorage from '@react-native-async-storage/async-storage';
import { systemNotify } from './systemNotify';

// Per sell order, on this phone: how many quotations the customer has SEEN
// (drives the red "new enquiry" dot) and how many we've NOTIFIED about (so a
// "New Buyer Enquiry" banner fires once per new quote, never repeated).
const KEY = 'ggfix.sellQuotes.v1';
let store = null;

async function read() {
  if (store) return store;
  try { store = JSON.parse(await AsyncStorage.getItem(KEY)) || null; } catch (_) { store = null; }
  if (!store || typeof store !== 'object') store = { seen: {}, notified: {}, init: false };
  store.seen = store.seen || {};
  store.notified = store.notified || {};
  return store;
}
async function save() {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(store)); } catch (_) {}
}

/** { [sellOrderId]: quotations seen } */
export async function getSeenQuotes() {
  return { ...(await read()).seen };
}

/** The customer opened this order's quotations — they're all seen now. */
export async function markQuotesSeen(sellOrderId, count) {
  if (!sellOrderId) return;
  const s = await read();
  const n = Number(count) || 0;
  if ((s.seen[sellOrderId] || 0) >= n && (s.notified[sellOrderId] || 0) >= n) return;
  s.seen[sellOrderId] = Math.max(s.seen[sellOrderId] || 0, n);
  s.notified[sellOrderId] = Math.max(s.notified[sellOrderId] || 0, n);
  await save();
}

/**
 * rows: [{ sellOrderId, count, name }] from live sell orders. Posts one
 * "New Buyer Enquiry" phone notification per order whose quotation count went
 * up since the last check. The very first run only records the counts.
 */
export async function notifyNewSellQuotes(rows) {
  const s = await read();
  const list = (rows || []).filter((r) => r && r.sellOrderId);
  if (!s.init) {
    list.forEach((r) => { s.notified[r.sellOrderId] = Math.max(s.notified[r.sellOrderId] || 0, Number(r.count) || 0); });
    s.init = true;
    await save();
    return;
  }
  let changed = false;
  for (const r of list) {
    const n = Number(r.count) || 0;
    if (n > (s.notified[r.sellOrderId] || 0)) {
      s.notified[r.sellOrderId] = n;
      changed = true;
      systemNotify('New Buyer Enquiry', `You received an enquiry for ${r.name || 'your device'}.`, { kind: 'SELL_QUOTES', sellOrderId: r.sellOrderId });
    }
  }
  if (changed) await save();
}
