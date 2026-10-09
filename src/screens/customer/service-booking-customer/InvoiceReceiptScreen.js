import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Loader, EmptyState } from '../../../components/rnr';
import { getRepairBooking } from '../../../api/orders';
import { getShop } from '../../../api/shops';
import { getProfile, listAddresses } from '../../../api/customer';
import { resolveBookingDevice } from '../../../utils/bookingDevice';
import { cleanIssueSummary } from '../../../utils/pickupEstimateMeta';
import { rf } from '../../../utils/responsive';

const GST_RATE = 0.18; // 18% repair-service GST, split CGST 9% + SGST 9%
const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Cell({ children, w, header, right, bold }) {
  return (
    <View style={{ width: w }} className={`px-1.5 py-1 border-r border-border ${header ? 'bg-background' : ''}`}>
      <Text
        className={` ${header ? 'font-extrabold text-text-muted' : (bold ? 'font-extrabold text-text' : 'text-text')} ${right ? 'text-right' : ''}`} style={{ fontSize: rf(9) }}
        numberOfLines={2}
      >
        {children}
      </Text>
    </View>
  );
}

export default function InvoiceReceiptScreen({ route }) {
  const { bookingId } = route.params || {};
  const [b, setB] = useState(null);
  const [dev, setDev] = useState({});
  const [shop, setShop] = useState(null);
  const [profile, setProfile] = useState(null);
  const [addr, setAddr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const bk = await getRepairBooking(bookingId);
        setB(bk);
        const [d, sh, pr, addrs] = await Promise.all([
          resolveBookingDevice(bk),
          bk.shopId ? getShop(bk.shopId).catch(() => null) : null,
          getProfile().catch(() => null),
          listAddresses().catch(() => []),
        ]);
        setDev(d);
        setShop(sh);
        setProfile(pr);
        setAddr(
          (addrs || []).find((a) => a.id === bk.pickupAddressId)
          || (addrs || []).find((a) => a.isDefault)
          || (addrs || [])[0]
          || null,
        );
      } catch (_) {} finally { setLoading(false); }
    })();
  }, [bookingId]);

  if (loading) return <Loader label="Loading invoice..." />;
  if (!b) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState title="Invoice unavailable" description="We couldn't load this invoice." />
      </View>
    );
  }

  const services = b.services || [];
  // Treat the agreed service price as GST-inclusive so the grand total matches
  // the amount the customer approved on the receipt.
  const rows = services.map((s) => {
    const gross = Number(s.estimatedPrice || 0);
    const taxable = gross / (1 + GST_RATE);
    const half = taxable * (GST_RATE / 2);
    return { name: s.serviceName, qty: 1, rate: taxable, taxable, cgst: half, sgst: half, total: gross };
  });
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const grand = sum('total');

  const invoiceNo = b.bookingNumber ? String(b.bookingNumber).replace('#', '') : String(b.id || '').slice(0, 8);
  const invoiceDate = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '-';
  const deliveryDate = b.estimatedDeliveryAt ? new Date(b.estimatedDeliveryAt).toLocaleDateString() : '-';
  const custName = profile?.fullName || profile?.name || addr?.fullName || 'Customer';
  const custAddr = addr ? [addr.addressLine, addr.locality, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') : '';
  const custMobile = addr?.mobile || profile?.mobile || profile?.phone || '';

  const W = { sno: 30, desc: 120, qty: 30, rate: 66, tax: 66, cgst: 58, sgst: 58, total: 72 };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
        <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          {/* Shop header */}
          <View className="bg-card border border-border rounded-2xl p-3 mb-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <Text className="font-extrabold text-success" style={{ fontSize: rf(17) }}>{shop?.name || 'Repair Shop'}</Text>
                {(shop?.mobile || shop?.phone) ? <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }}>{shop.mobile || shop.phone}</Text> : null}
                {shop?.address ? <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }} numberOfLines={2}>{shop.address}</Text> : null}
                {shop?.gstNumber ? <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }}>GST No : {shop.gstNumber}</Text> : null}
              </View>
              <View className="bg-success/10 rounded-lg px-2 py-1">
                <Text className="font-bold text-success" style={{ fontSize: rf(9) }}>Original for Recipient</Text>
              </View>
            </View>
            <View className="h-px bg-border my-2" />
            <Text className="font-extrabold text-text text-center" style={{ fontSize: rf(15) }}>Invoice Receipt</Text>
            <View className="flex-row mt-2">
              <View className="flex-1 pr-1">
                <Text className="text-text-muted" style={{ fontSize: rf(10) }}>Invoice No</Text>
                <Text className="font-bold text-text" style={{ fontSize: rf(11) }}>{invoiceNo}</Text>
              </View>
              <View className="flex-1 px-1">
                <Text className="text-text-muted" style={{ fontSize: rf(10) }}>Invoice Date</Text>
                <Text className="font-bold text-text" style={{ fontSize: rf(11) }}>{invoiceDate}</Text>
              </View>
              <View className="flex-1 pl-1">
                <Text className="text-text-muted" style={{ fontSize: rf(10) }}>Delivery Date</Text>
                <Text className="font-bold text-text" style={{ fontSize: rf(11) }}>{deliveryDate}</Text>
              </View>
            </View>
          </View>

          {/* Bill To / From */}
          <View className="flex-row mb-3">
            <View className="flex-1 bg-card border border-border rounded-2xl p-3 mr-1.5">
              <Text className="font-extrabold text-text-muted uppercase tracking-wide mb-1" style={{ fontSize: rf(10) }}>Bill To</Text>
              <Text className="font-bold text-text" style={{ fontSize: rf(12) }} numberOfLines={1}>{custName}</Text>
              {custMobile ? <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }}>{custMobile}</Text> : null}
              {custAddr ? <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }} numberOfLines={3}>{custAddr}</Text> : null}
            </View>
            <View className="flex-1 bg-card border border-border rounded-2xl p-3 ml-1.5">
              <Text className="font-extrabold text-text-muted uppercase tracking-wide mb-1" style={{ fontSize: rf(10) }}>From</Text>
              <Text className="font-bold text-text" style={{ fontSize: rf(12) }} numberOfLines={1}>{shop?.name || '-'}</Text>
              {(shop?.mobile || shop?.phone) ? <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }}>{shop.mobile || shop.phone}</Text> : null}
              {shop?.address ? <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }} numberOfLines={3}>{shop.address}</Text> : null}
            </View>
          </View>

          {/* Device + complaint */}
          <View className="bg-card border border-border rounded-2xl p-3 mb-3">
            <Text className="font-extrabold text-text" style={{ fontSize: rf(12) }} numberOfLines={2}>{dev.name || 'Device'}</Text>
            {dev.specs ? <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(10) }}>{dev.specs}</Text> : null}
            {(() => { const ci = cleanIssueSummary(b.issueSummary); return ci ? <Text className="text-text-muted mt-1" style={{ fontSize: rf(10) }}>Complaint : {ci}</Text> : null; })()}
          </View>

          {/* Line items table (horizontal scroll for the wide GST columns) */}
          <View className="bg-card border border-border rounded-2xl overflow-hidden mb-3">
            <Text className="font-extrabold text-text px-3 pt-2.5 pb-1" style={{ fontSize: rf(11) }}>Tax Invoice — Services</Text>
            {rows.length === 0 ? (
              <Text className="text-text-muted px-3 pb-3" style={{ fontSize: rf(11) }}>No billed services yet.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ padding: 8 }}>
                <View className="border border-border rounded-lg overflow-hidden">
                  <View className="flex-row border-b border-border">
                    <Cell w={W.sno} header>SI</Cell>
                    <Cell w={W.desc} header>Description</Cell>
                    <Cell w={W.qty} header right>Qty</Cell>
                    <Cell w={W.rate} header right>Rate</Cell>
                    <Cell w={W.tax} header right>Taxable</Cell>
                    <Cell w={W.cgst} header right>CGST 9%</Cell>
                    <Cell w={W.sgst} header right>SGST 9%</Cell>
                    <Cell w={W.total} header right>Amount</Cell>
                  </View>
                  {rows.map((r, i) => (
                    <View key={i} className="flex-row border-b border-border">
                      <Cell w={W.sno}>{i + 1}</Cell>
                      <Cell w={W.desc}>{r.name}</Cell>
                      <Cell w={W.qty} right>{r.qty}</Cell>
                      <Cell w={W.rate} right>{money(r.rate)}</Cell>
                      <Cell w={W.tax} right>{money(r.taxable)}</Cell>
                      <Cell w={W.cgst} right>{money(r.cgst)}</Cell>
                      <Cell w={W.sgst} right>{money(r.sgst)}</Cell>
                      <Cell w={W.total} right>{money(r.total)}</Cell>
                    </View>
                  ))}
                  <View className="flex-row bg-background">
                    <Cell w={W.sno}> </Cell>
                    <Cell w={W.desc} bold>Total</Cell>
                    <Cell w={W.qty} right> </Cell>
                    <Cell w={W.rate} right> </Cell>
                    <Cell w={W.tax} right bold>{money(sum('taxable'))}</Cell>
                    <Cell w={W.cgst} right bold>{money(sum('cgst'))}</Cell>
                    <Cell w={W.sgst} right bold>{money(sum('sgst'))}</Cell>
                    <Cell w={W.total} right bold>{money(grand)}</Cell>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>

          {/* Grand total */}
          <View className="bg-primary/5 border border-primary/15 rounded-2xl p-3 flex-row items-center justify-between">
            <Text className="font-extrabold text-text" style={{ fontSize: rf(12) }}>Grand Total (incl. GST)</Text>
            <Text className="font-extrabold text-primary" style={{ fontSize: rf(16) }}>₹{money(grand)}</Text>
          </View>

          <Text className="text-text-muted text-center mt-3" style={{ fontSize: rf(9) }}>
            This is a system-generated invoice. GST shown is computed at 18% (CGST 9% + SGST 9%) and is inclusive of the agreed service amount.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
