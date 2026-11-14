// Buy → Order Details → View Receipt.
// A simplified PURCHASE RECEIPT (not a GST tax invoice) laid out like the
// Amazon receipt reference, NearGFix-branded. Real data only: the order
// (marketplace API), the seller (public shop API) and the customer (profile +
// saved address). Anything missing is left out — never invented.
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getShop } from '../../../api/shops';
import { getProfile, listAddresses } from '../../../api/customer';

const TEAL = '#035C6C';
const ORANGE = '#F09406';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (v, time) => {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
  return time ? `${date}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : date;
};
const joinAddr = (a) => {
  if (!a) return '';
  if (typeof a === 'string') return a;
  return [a.addressLine || a.line1, a.area || a.locality || a.line2, a.taluk, a.district || a.city, a.state, a.pincode].filter(Boolean).join(', ');
};

// Same rules as the shop invoice (InvoiceGeneratorScreen.numberToIndianWords).
export function numberToIndianWords(num) {
  if (num === null || num === undefined || isNaN(num)) return '';
  const n = Math.round(Number(num));
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ` ${ones[x % 10]}` : ''));
  const three = (x) => { const h = Math.floor(x / 100); const r = x % 100; return (h ? `${ones[h]} Hundred${r ? ' and ' : ''}` : '') + (r ? two(r) : ''); };
  let s = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thou = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) s += `${two(crore)} Crore `;
  if (lakh) s += `${two(lakh)} Lakh `;
  if (thou) s += `${two(thou)} Thousand `;
  if (rest) s += three(rest);
  return s.trim();
}

/** Load seller + customer for an order (best-effort; missing parts stay empty). */
export async function loadReceiptData(o) {
  const [shop, profile, addresses] = await Promise.all([
    o?.shopId ? getShop(o.shopId).catch(() => null) : null,
    getProfile().catch(() => null),
    listAddresses().catch(() => []),
  ]);
  const def = (addresses || []).find((a) => a.isDefault) || (addresses || [])[0] || null;
  return { shop: shop || {}, profile: profile || {}, address: o?.deliveryAddress || def };
}

// GST State/UT codes (shown only when the state is known — never guessed).
const STATE_CODES = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', punjab: '03', chandigarh: '04', uttarakhand: '05', haryana: '06', delhi: '07',
  rajasthan: '08', 'uttar pradesh': '09', bihar: '10', sikkim: '11', 'arunachal pradesh': '12', nagaland: '13', manipur: '14',
  mizoram: '15', tripura: '16', meghalaya: '17', assam: '18', 'west bengal': '19', jharkhand: '20', odisha: '21', chhattisgarh: '22',
  'madhya pradesh': '23', gujarat: '24', 'dadra and nagar haveli and daman and diu': '26', maharashtra: '27', karnataka: '29', goa: '30',
  lakshadweep: '31', kerala: '32', 'tamil nadu': '33', puducherry: '34', 'andaman and nicobar islands': '35', telangana: '36',
  'andhra pradesh': '37', ladakh: '38',
};
const stateCodeOf = (txt) => {
  const t = String(txt || '').toLowerCase();
  const hit = Object.keys(STATE_CODES).sort((a, b) => b.length - a.length).find((k) => t.includes(k));
  return hit ? STATE_CODES[hit] : '';
};
// Address → display lines (comma-separated text or a saved-address object).
const addrLines = (a) => {
  if (!a) return [];
  if (typeof a === 'string') return a.split(',').map((x) => x.trim()).filter(Boolean);
  const l1 = [a.addressLine || a.line1].filter(Boolean).join(', ');
  const l2 = [a.area || a.locality || a.line2, a.taluk].filter(Boolean).join(', ');
  const l3 = [a.district || a.city, a.state].filter(Boolean).join(', ').toUpperCase() + (a.pincode ? `, ${a.pincode}` : '');
  return [l1, l2, l3].filter((x) => x && x.trim() && x.trim() !== ',');
};
const addrBlock = (lines) => {
  // Pack comma-split text into ~3 readable lines.
  if (lines.length <= 3) return lines;
  const per = Math.ceil(lines.length / 3);
  const out = [];
  for (let i = 0; i < lines.length; i += per) out.push(lines.slice(i, i + per).join(', '));
  return out;
};

export function buildReceiptHtml(o, { shop = {}, profile = {}, address } = {}) {
  const qty = Number(o.quantity || 1);
  const unit = o.unitPrice != null ? Number(o.unitPrice) : Number(o.totalAmount || 0) / qty;
  const net = unit * qty;
  const total = Number(o.totalAmount || net);
  const done = ['DELIVERED', 'COMPLETED'].includes(String(o.status || '').toUpperCase());
  const paid = o.paymentStatus === 'PAID' || done;
  const payMode = o.paymentMethod === 'COD' ? 'Cash on Delivery' : o.paymentMethod ? 'Pay at Shop' : '';
  const ev = (o.events || []).slice().reverse().find((e) => ['DELIVERED', 'COMPLETED'].includes(String(e.status || '').toUpperCase()));
  const receiptDate = ev?.at || (done ? o.updatedAt : null) || o.createdAt;
  const payAt = paid ? (ev?.at || o.paidAt || o.updatedAt) : null;
  const orderNo = String(o.orderNumber || o.id || '').replace(/^#/, '');
  const receiptNo = `RCPT-${orderNo}`;
  const txnRef = o.paymentReference || o.transactionId || o.paymentTxnId || o.paymentId || '';
  const shopName = o.shopName || shop.name || '';
  const shopAddr = shop.address || o.shopAddress || '';
  const shopMobile = shop.mobile || shop.phone || '';
  const ownerName = o.shopOwnerName || shop.ownerName || shop.ownerFullName || '';
  // Owner's own mobile from the Partner shop profile; else the shop's registered number.
  const ownerMobile = o.shopOwnerPhone || shop.ownerMobile || '';
  const custName = profile.fullName || profile.name || '';
  const billLines = addrBlock(addrLines(address));
  const pin = (typeof address === 'object' && address?.pincode) || (String(address || '').match(/d{6}/) || [])[0] || '';
  const billState = typeof address === 'object' && address ? address.state : address;
  const stateCode = stateCodeOf(billState);
  const sellLines = addrBlock(addrLines(shopAddr));
  const words = numberToIndianWords(total);
  const fmtMob = (n) => (n ? (String(n).startsWith('+') ? n : `+91 ${n}`) : '');
  const mob = fmtMob(ownerMobile);          // owner's own number (users.phone)
  const shopMob = fmtMob(o.shopPhone || shopMobile); // shop contact number (kept separately)
  const dtt = (v) => {
    const d = v ? new Date(v) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} hrs`;
  };

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 12mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11.5px; margin: 0; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { font-size: 34px; font-weight: 900; color: #111; letter-spacing: -1px; line-height: 1; }
  .logo b { color: ${TEAL}; }
  .smile { width: 118px; height: 12px; border-bottom: 4px solid ${ORANGE}; border-radius: 0 0 60px 60px; margin-top: -2px; margin-left: 8px; }
  .ttl { text-align: right; font-size: 14px; } .ttl b { font-size: 15px; }
  .two { display: flex; justify-content: space-between; margin-top: 22px; gap: 24px; line-height: 1.45; }
  .two > div { flex: 1; } .r { text-align: right; }
  .gap { margin-top: 26px; }
  table { width: 100%; border-collapse: collapse; }
  .items { margin-top: 14px; }
  .items th, .items td { border: 1px solid #333; padding: 5px 6px; vertical-align: top; }
  .items th { background: #D9D9D9; font-size: 11.5px; text-align: center; }
  .items td.n { text-align: right; white-space: nowrap; vertical-align: middle; } .items td.c { text-align: center; vertical-align: middle; }
  .box { border: 1px solid #333; border-top: 0; padding: 7px 8px; }
  .tot { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; }
  .own { text-align: right; line-height: 1.55; padding: 10px 14px; }
  .own .nm { font-size: 15px; font-weight: 800; }
  .rc { margin: 8px 0 18px 4px; }
  .pay td { border: 1px solid #333; padding: 6px 8px; font-size: 10.5px; vertical-align: top; }
  </style></head><body>

  <div class="hdr">
    <div><div class="logo">near<b>G</b>fix<span style="font-weight:400;font-size:26px">.in</span></div><div class="smile"></div></div>
    <div class="ttl"><b>Bill of Supply/Cash Memo</b><br/>(Original for Recipient)</div>
  </div>

  <div class="two">
    <div><b>Sold By :</b><br/>
      ${shopName ? `${esc(shopName.toUpperCase())}<br/>` : ''}
      ${sellLines.map((l) => `${esc(l)}<br/>`).join('')}IN
      ${shop.gstNumber ? `<br/><b>GSTIN:</b> ${esc(shop.gstNumber)}` : ''}
    </div>
    <div class="r"><b>Billing Address :</b><br/>
      ${custName ? `${esc(custName)}<br/>` : ''}
      ${billLines.map((l) => `${esc(l)}<br/>`).join('')}IN
      ${stateCode ? `<br/><b>State/UT Code:</b> ${stateCode}` : ''}
    </div>
  </div>

  <div class="two gap">
    <div><b>Order Number:</b> ${esc(orderNo)}<br/><b>Order Date:</b> ${esc(dt(o.createdAt))}</div>
    <div class="r"><b>Invoice Number:</b> ${esc(receiptNo)}<br/><b>Invoice Details :</b> ${esc(`NGF-${orderNo}`)}<br/><b>Invoice Date :</b> ${esc(dt(receiptDate))}</div>
  </div>

  <table class="items">
    <thead><tr>
      <th style="width:34px">Sl.<br/>No</th><th style="text-align:left">Description</th>
      <th style="width:78px">Unit<br/>Price</th><th style="width:38px">Qty</th>
      <th style="width:80px">Net<br/>Amount</th><th style="width:84px">Total<br/>Amount</th>
    </tr></thead>
    <tbody><tr>
      <td class="c">1</td>
      <td>${esc(o.productTitle || 'Product')}${o.productId ? `<br/>Item ID: ${esc(String(o.productId).slice(0, 8).toUpperCase())}` : ''}</td>
      <td class="n">${inr(unit)}</td><td class="c">${qty}</td><td class="n">${inr(net)}</td><td class="n">${inr(total)}</td>
    </tr></tbody>
  </table>
  <div class="box tot"><span>TOTAL:</span><span>${inr(total)}</span></div>
  <div class="box"><b>Amount in Words:</b><br/><b style="font-size:13px">${esc(words)} only</b></div>
  <div class="box own">
    ${shopName ? `<div>For ${esc(shopName.toUpperCase())}</div>` : ''}
    ${ownerName ? `<div class="nm">Owner: ${esc(ownerName)}</div>` : ''}
    ${mob ? `<div>Owner Mobile: ${esc(mob)}</div>` : ''}
    ${shopMob ? `<div>${mob ? 'Shop Mobile: ' : ''}${esc(shopMob)}</div>` : ''}
  </div>
  <div class="rc">Whether tax is payable under reverse charge - No</div>

  <table class="pay"><tr>
    <td style="width:34%"><b>Payment Transaction ID:</b><br/>${esc(txnRef || '—')}</td>
    <td style="width:24%"><b>Date &amp; Time:</b> ${esc(payAt ? dtt(payAt) : '—')}</td>
    <td style="width:18%"><b>Invoice Value:</b><br/>${Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    <td style="width:24%"><b>Mode of Payment:</b> ${esc(payMode || '—')}<br/><b>Status:</b> ${paid ? 'Paid' : 'Pending'}</td>
  </tr></table>
  </body></html>`;
}

const fileStem = (o) => `NearGFix_Receipt_${String(o.orderNumber || o.id || 'order').replace(/[^A-Za-z0-9_-]+/g, '_')}`;

/** Preview (system print preview — Save as PDF / Print). */
export async function viewReceipt(html) {
  await Print.printAsync({ html });
}

/** Share the PDF (WhatsApp, Drive, mail…). */
// One PDF per order version, reused by Share / Download (no regeneration on repeat taps).
const pdfCache = new Map();
async function namedPdf(html, o) {
  const key = `${o.id || o.orderNumber}|${o.updatedAt || ''}|${o.status || ''}`;
  // eslint-disable-next-line global-require
  const FS = require('expo-file-system/legacy');
  const cached = pdfCache.get(key);
  if (cached && (await FS.getInfoAsync(cached).catch(() => ({}))).exists) return cached;
  const { uri } = await Print.printToFileAsync({ html });
  // A real, named file in the app cache (share targets reject the print
  // module's random temp name and path).
  const dest = `${FS.cacheDirectory}${fileStem(o)}.pdf`;
  await FS.deleteAsync(dest, { idempotent: true }).catch(() => {});
  await FS.copyAsync({ from: uri, to: dest });
  if (!(await FS.getInfoAsync(dest)).exists) throw new Error('Receipt PDF could not be created.');
  pdfCache.set(key, dest);
  return dest;
}

/** Share the actual PDF file through the native share sheet (WhatsApp, Gmail, Bluetooth…). */
let sharing = false;
export async function shareReceipt(html, o) {
  if (sharing) return; // one share sheet at a time
  sharing = true;
  try {
    const file = await namedPdf(html, o);
    console.log('[Receipt] share file:', file); // eslint-disable-line no-console
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('expo-sharing unavailable');
      // Android: shareAsync may not resolve until (or ever after) the chooser
      // closes — don't hold the locks on it; release once the sheet is up.
      const p = Sharing.shareAsync(file, { mimeType: 'application/pdf', dialogTitle: `${fileStem(o)}.pdf`, UTI: 'com.adobe.pdf' });
      p.catch((e) => { if (!/cancel/i.test(String(e?.message || ''))) console.error('[Receipt] share sheet error:', e?.message || e); }); // eslint-disable-line no-console
      await Promise.race([p, new Promise((r) => setTimeout(r, 1500))]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Receipt] expo-sharing failed, using Android send intent:', err?.message || err);
      if (Platform.OS !== 'android') throw err;
      // Android fallback: ACTION_SEND with a content:// URI (readable by the target app).
      // eslint-disable-next-line global-require
      const FS = require('expo-file-system/legacy');
      // eslint-disable-next-line global-require
      const IL = require('expo-intent-launcher');
      const contentUri = await FS.getContentUriAsync(file);
      await IL.startActivityAsync('android.intent.action.SEND', {
        type: 'application/pdf',
        extra: { 'android.intent.extra.STREAM': contentUri, 'android.intent.extra.SUBJECT': `${fileStem(o)}.pdf` },
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });
    }
  } catch (e) {
    // Closing the share sheet is not an error.
    if (/cancel/i.test(String(e?.message || ''))) return;
    // eslint-disable-next-line no-console
    console.error('[Receipt] share failed:', e?.message || e);
    throw e;
  } finally { sharing = false; }
}

/** Download the PDF: native Downloads module when built in; Expo Go → remembered folder (asked once); else share. */
export async function downloadReceipt(html, o) {
  const uri = await namedPdf(html, o);
  const stem = fileStem(o);
  try {
    // eslint-disable-next-line global-require
    const { saveToDownloads } = require('../../../lib/downloads');
    const saved = await saveToDownloads({ stem, extension: 'pdf', mimeType: 'application/pdf', sourceUri: uri });
    return `${saved?.name || `${stem}.pdf`} saved to Downloads`;
  } catch (_) { /* fall through */ }
  if (Platform.OS === 'android') {
    // eslint-disable-next-line global-require
    const FS = require('expo-file-system/legacy');
    const SAF = FS?.StorageAccessFramework;
    if (SAF) {
      const KEY = 'ggfix.invoiceDownloadDir'; // same folder as invoice downloads
      const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
      const write = async (dir) => {
        const dest = await SAF.createFileAsync(dir, stem, 'application/pdf');
        await FS.writeAsStringAsync(dest, b64, { encoding: FS.EncodingType.Base64 });
      };
      const dir = await AsyncStorage.getItem(KEY).catch(() => null);
      if (dir) { try { await write(dir); return `${stem}.pdf saved`; } catch (_) { await AsyncStorage.removeItem(KEY).catch(() => {}); } }
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (perm?.granted) { await write(perm.directoryUri); await AsyncStorage.setItem(KEY, perm.directoryUri).catch(() => {}); return `${stem}.pdf saved`; }
    }
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${stem}.pdf`, UTI: 'com.adobe.pdf' });
  return null;
}
