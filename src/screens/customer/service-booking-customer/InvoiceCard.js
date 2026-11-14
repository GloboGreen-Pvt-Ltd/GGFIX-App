// Invoice card for Service → Booking Details (before Service History).
// View  → the customer invoice screen (InvoiceReceipt).
// Download → a PDF built on the phone from the same ticket data (expo-print),
//            then saved / shared (expo-sharing). Web prints / saves as PDF.
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Download, Eye, ReceiptText } from 'lucide-react-native';
import { Card } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import DeliveryInvoiceReportScreen from '../../owner/AllBooking/DeliveryInvoiceReportScreen';
import { shopNumber } from '../../../utils/shopNumber';
import { rf } from '../../../utils/responsive';

const TEAL = '#035C6C';
const ORANGE = '#F09406';
const INK = '#111111';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';

// The invoice exists once the shop has generated it (or the job moved past it).
const INVOICE_STATES = new Set(['INVOICE_GENERATED', 'INVOICE_READY', 'READY', 'DELIVERED_PROCESSING', 'DELIVERED', 'COMPLETED']);
export function invoiceAvailable(ticket, booking) {
  const st = (v) => String(v || '').toUpperCase();
  if (INVOICE_STATES.has(st(ticket?.status)) || INVOICE_STATES.has(st(booking?.status))) return true;
  return (booking?.events || []).some((e) => INVOICE_STATES.has(st(e?.status)));
}

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function invoiceHtml({ ticket: t, items, total, number }) {
  const when = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const rows = (items || []).map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it?.label || it?.name || 'Service')}</td><td class="r">${inr(it?.amount)}</td></tr>`).join('')
    || `<tr><td>1</td><td>${esc(t?.repairServicesSummary || t?.issueDescription || 'Repair service')}</td><td class="r">${inr(total)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:24px}
    h1{color:${TEAL};margin:0 0 4px;font-size:22px} .muted{color:#6B7280;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:16px} th,td{border-bottom:1px solid #E5E7EB;padding:8px;font-size:13px;text-align:left}
    th{background:#E5F3F5;color:${TEAL}} .r{text-align:right} .tot td{font-weight:bold;font-size:14px;border-top:2px solid ${TEAL}}
    .box{border:1px solid #E5E7EB;border-radius:10px;padding:12px;margin-top:12px;font-size:13px}
  </style></head><body>
    <h1>Invoice</h1>
    <div class="muted">Booking #${esc(number || '')} · Generated ${esc(when)}</div>
    <div class="box"><b>Device:</b> ${esc(t?.deviceDisplayName || '-')}<br/><b>Complaint:</b> ${esc(t?.issueDescription || '-')}</div>
    <table><thead><tr><th>#</th><th>Service</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows}<tr class="tot"><td></td><td>${t?.finalPrice != null ? 'Final Total' : 'Estimated Total'}</td><td class="r">${inr(total)}</td></tr></tbody></table>
    <p class="muted" style="margin-top:24px">Thank you for choosing NearGFix.</p>
  </body></html>`;
}

export default function InvoiceCard({ ticket, booking, items, total, navigation }) {
  const [busy, setBusy] = useState(false);
  const ready = invoiceAvailable(ticket, booking);
  const number = shopNumber(booking?.bookingNumber || ticket?.bookingNumber);
  const bookingId = booking?.id;

  // View / Download: the shop's own invoice (Partner Deliver Invoice design + its PDF).
  const ticketId = ticket?.id;
  const onView = () => {
    if (ticketId) navigation.navigate('CustomerInvoice', { ticketId, customer: true });
    else if (bookingId) navigation.navigate('InvoiceReceipt', { bookingId });
    else notify('Invoice', 'Invoice is not linked to this booking yet.');
  };
  // Download stays on this page: the shop's invoice PDF is built by a hidden
  // instance of the invoice screen; afterwards "Preview" opens it.
  const [hidden, setHidden] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const onDownload = async () => {
    if (ticketId) { setBusy(true); setHidden(true); return; }
    setBusy(true);
    try {
      const html = invoiceHtml({ ticket, items, total, number });
      if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${number || ''}`.trim(), UTI: 'com.adobe.pdf' });
      } else {
        notify('Invoice saved', uri);
      }
    } catch (e) {
      notify("Couldn't download invoice", e?.message || 'Try again');
    } finally { setBusy(false); }
  };

  const Btn = ({ icon: I, label, onPress, solid }) => (
    <Pressable
      onPress={onPress}
      disabled={!ready || busy}
      accessibilityRole="button"
      className="active:opacity-85"
      style={{ flex: 1, height: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: solid ? TEAL : '#FFFFFF', borderWidth: 1.5, borderColor: TEAL, opacity: ready ? 1 : 0.45 }}
    >
      {busy && solid ? <ActivityIndicator color="#FFFFFF" /> : <I size={16} color={solid ? '#FFFFFF' : TEAL} />}
      <Text style={{ marginLeft: 6, fontSize: rf(13), fontWeight: '800', color: solid ? '#FFFFFF' : TEAL }}>{label}</Text>
    </Pressable>
  );

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: '#FFF4E3', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <ReceiptText size={17} color={ORANGE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: rf(15), fontWeight: '800', color: INK }}>Invoice</Text>
          <Text style={{ fontSize: rf(11.5), color: MUTED, marginTop: 1 }}>
            {ready ? `Booking #${String(number || '').replace(/^#/, '')}` : 'Available once the shop generates the invoice'}
          </Text>
        </View>
        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: ready ? '#E5F3F5' : '#F3F4F6' }}>
          <Text style={{ fontSize: rf(11), fontWeight: '700', color: ready ? TEAL : MUTED }}>{ready ? 'Ready' : 'Pending'}</Text>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: LINE, marginVertical: 12 }} />
      <View style={{ flexDirection: 'row' }}>
        <Btn icon={Eye} label={downloaded ? 'Preview' : 'View'} onPress={onView} />
        <View style={{ width: 10 }} />
        <Btn icon={Download} label={busy ? 'Downloading…' : downloaded ? 'Downloaded' : 'Download'} onPress={onDownload} solid />
      </View>
      {downloaded ? (
        <Text style={{ marginTop: 8, fontSize: rf(11.5), color: TEAL, textAlign: 'center' }}>Invoice saved — tap Preview to open it.</Text>
      ) : null}
      {hidden ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, overflow: 'hidden' }}>
          <DeliveryInvoiceReportScreen
            navigation={{ goBack() {}, navigate() {}, canGoBack: () => false, setOptions() {} }}
            route={{ params: {
              ticketId, customer: true, autoDownload: true,
              onDone: (ok) => {
                setHidden(false); setBusy(false);
                if (ok) setDownloaded(true);
                else notify("Couldn't download invoice", 'The shop has not generated the invoice yet, or it could not be saved.');
              },
            } }}
          />
        </View>
      ) : null}
    </Card>
  );
}
