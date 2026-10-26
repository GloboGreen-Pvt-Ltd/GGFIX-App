// Classifies whatever the Home scanner read (QR or barcode) so the scanner can
// route it. Pure — no network. Formats seen in the GGFIX ecosystem:
//   · shop QR (Partner "My QR"): a vCard — FN / ORG = shop name, TEL = phone
//   · ticket label QR (Partner print slip): the ticket trackingId or ticket UUID
//   · box / sticker barcodes: IMEI (15 digits) or a model number (e.g. A2633)
//   · anything else: a link, a phone number, or plain text to search for
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const digitsOnly = (s) => String(s || '').replace(/[^0-9]/g, '');
// Last 10 digits — Indian mobile numbers with or without +91 / 0.
export const phoneKey = (s) => digitsOnly(s).slice(-10);

function vcardField(lines, key) {
  const re = new RegExp(`^${key}(;[^:]*)?:(.*)$`, 'i');
  return lines.map((l) => l.match(re)).filter(Boolean).map((m) => m[2].trim()).filter(Boolean);
}

export function parseVCard(text) {
  // Unfold continuation lines (RFC 6350 §3.2) before reading fields.
  const lines = String(text).replace(/\r\n[ \t]/g, '').split(/\r?\n/);
  const name = vcardField(lines, 'FN')[0] || vcardField(lines, 'ORG')[0] || null;
  const phones = vcardField(lines, 'TEL').map((t) => t.replace(/^tel:/i, '').trim()).filter((t) => phoneKey(t).length >= 10);
  const adr = vcardField(lines, 'ADR')[0];
  const address = adr ? adr.split(';').map((x) => x.trim()).filter(Boolean).join(', ') : null;
  return { name, phones, address };
}

export function classifyScan(raw) {
  const text = String(raw || '').trim();
  if (!text) return { kind: 'empty' };

  if (/^BEGIN:VCARD/i.test(text)) return { kind: 'vcard', ...parseVCard(text) };
  if (/^MECARD:/i.test(text)) {
    const get = (k) => (text.match(new RegExp(`${k}:([^;]*)`, 'i')) || [])[1] || null;
    const tel = get('TEL');
    return { kind: 'vcard', name: get('N'), phones: tel ? [tel] : [], address: get('ADR') };
  }
  if (/^tel:/i.test(text)) return { kind: 'phone', phone: text.slice(4).trim() };

  if (/^https?:\/\//i.test(text)) {
    let host = ''; let path = '';
    try { const u = new URL(text); host = u.hostname.toLowerCase(); path = u.pathname; } catch (_) {}
    const shop = /(^|\.)ggfix\.in$/.test(host) ? path.match(/^\/(?:shop|shops|s)\/([^/?#]+)/i) : null;
    if (shop) return { kind: 'shopLink', slug: decodeURIComponent(shop[1]), url: text };
    return { kind: 'url', url: text, host };
  }

  if (UUID_RE.test(text)) return { kind: 'uuid', id: text.toLowerCase() };

  const compact = text.replace(/\s+/g, '');
  const digits = digitsOnly(compact);
  if (/^\d{15}$/.test(compact)) return { kind: 'imei', imei: compact };
  if (/^(\+?91)?[6-9]\d{9}$/.test(compact)) return { kind: 'phone', phone: compact };
  // Order / tracking numbers and model numbers: one short token, letters + digits.
  if (/^#?[A-Za-z0-9][A-Za-z0-9\-_/]{2,24}$/.test(compact) && /\d/.test(compact)) {
    return { kind: 'code', code: compact.replace(/^#/, '') };
  }
  if (digits.length >= 8 && digits.length === compact.length) return { kind: 'code', code: compact };
  return { kind: 'text', text };
}

const normCode = (s) => String(s || '').replace(/^#/, '').replace(/[\s\-_]/g, '').toUpperCase();

// Finds one of the customer's own orders that a scanned code refers to.
export function findOrderByCode(orders, code) {
  const want = normCode(code);
  if (!want) return null;
  return (orders || []).find((o) => [
    o.orderNumber, o.trackingId, o.referenceId, o.id,
    o.payload?.trackingId, o.payload?.ticketId, o.payload?.bookingId, o.payload?.sellOrderId,
    o.payload?.bookingNumber, o.payload?.ticketNumber,
  ].some((v) => v && normCode(v) === want)) || null;
}

// Where an order opens (same targets as My Orders' cards).
export function orderRoute(o) {
  const type = String(o?.orderType || '').toUpperCase();
  if (type === 'SELL') {
    const sid = o.referenceId || o.payload?.sellOrderId;
    return sid ? ['SellOrderDetails', { sellOrderId: sid }] : ['MyOrders', { initialTab: 'Sell' }];
  }
  if (type === 'BUY') return ['MyOrders', { initialTab: 'Buy' }];
  if (o?.payload?.ticketId) return ['ServiceTicketDetails', { ticketId: o.payload.ticketId, fromOrders: true }];
  const ref = o?.payload?.bookingId || o?.referenceId;
  if (ref) return ['RepairOrderDetails', { bookingId: ref, fromOrders: true }];
  return ['RepairOrders', {}];
}
