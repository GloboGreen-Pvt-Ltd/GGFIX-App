import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { CheckCircle2, Smartphone } from 'lucide-react-native';
import { Card, Loader, EmptyState } from '../../../components/rnr';
import { getRepairBooking } from '../../../api/orders';
import { resolveBookingDevice } from '../../../utils/bookingDevice';
import { cleanIssueSummary } from '../../../utils/pickupEstimateMeta';
import { rf } from '../../../utils/responsive';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDateTime = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

function InfoLine({ label, value, valueClass }) {
  return (
    <View className="flex-row flex-wrap mt-1.5">
      <Text className="text-text-muted" style={{ fontSize: rf(11) }}>{label} : </Text>
      <Text className={` font-bold flex-1 ${valueClass || 'text-text'}`} style={{ fontSize: rf(11) }}>{value || '-'}</Text>
    </View>
  );
}

export default function ServiceReceiptScreen({ route }) {
  const { bookingId } = route.params || {};
  const [b, setB] = useState(null);
  const [dev, setDev] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const bk = await getRepairBooking(bookingId);
        setB(bk);
        setDev(await resolveBookingDevice(bk));
      } catch (_) {} finally { setLoading(false); }
    })();
  }, [bookingId]);

  if (loading) return <Loader label="Loading receipt..." />;
  if (!b) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState title="Receipt unavailable" description="We couldn't load this receipt." />
      </View>
    );
  }

  const services = b.services || [];
  const estimate = b.estimateAmount != null
    ? Number(b.estimateAmount)
    : services.reduce((s, x) => s + Number(x.estimatedPrice || 0), 0);
  const approvalRaw = (b.customerApproval || '').toUpperCase();
  const approval = approvalRaw === 'DONE' ? 'Done' : (b.customerApproval || 'Pending');
  const estTime = b.estimatedReadyAt
    ? `${fmtDateTime(b.estimatedReadyAt)}${b.estimatedDurationHours ? `, ${b.estimatedDurationHours}Hr` : ''}`
    : '-';

  return (
    <View className="flex-1 bg-background">
      {/* Success header */}
      <View className="bg-card border-b border-border px-4 pt-3 pb-4 flex-row items-center">
        <View className="h-11 w-11 rounded-full bg-success/10 items-center justify-center mr-3">
          <CheckCircle2 size={24} color="#004C40" />
        </View>
        <View className="flex-1">
          <Text className="font-extrabold text-text" style={{ fontSize: rf(15) }}>Booking Successful</Text>
          <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11) }}>{fmtDateTime(b.createdAt)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28 }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <Card className="rounded-2xl">
            <Text className="font-extrabold text-success mb-2" style={{ fontSize: rf(13) }}>Receipt Details</Text>

            {/* Device */}
            <View className="flex-row items-start">
              <View className="flex-1 pr-2">
                <Text className="font-extrabold text-text" style={{ fontSize: rf(14) }} numberOfLines={2}>{dev.name || 'Device'}</Text>
                {b.color ? <InfoLine label="Color" value={b.color} /> : null}
                {dev.storageText ? <InfoLine label="Storage" value={dev.storageText} /> : null}
                {services.length ? (
                  <InfoLine label="Repair Services" value={services.map((s) => s.serviceName).join(', ')} />
                ) : null}
              </View>
              <View className="h-16 w-16 rounded-xl bg-primary/10 items-center justify-center overflow-hidden">
                {dev.image ? (
                  <Image source={{ uri: dev.image }} style={{ width: 64, height: 64 }} resizeMode="cover" />
                ) : (
                  <Smartphone size={26} color="#00008B" />
                )}
              </View>
            </View>

            <View className="h-px bg-border my-3" />

            {/* Price summary */}
            <Text className="font-extrabold text-text mb-1" style={{ fontSize: rf(12) }}>Price Summary</Text>
            {services.map((s, i) => (
              <View key={i} className="flex-row items-center justify-between py-1">
                <View className="flex-row items-center flex-1 pr-2">
                  <View className="h-4 w-4 rounded bg-primary/10 items-center justify-center mr-2">
                    <Text className="font-bold text-primary" style={{ fontSize: rf(9) }}>{i + 1}</Text>
                  </View>
                  <Text className="text-text flex-1" style={{ fontSize: rf(12) }} numberOfLines={1}>{s.serviceName}</Text>
                </View>
                <Text className="font-bold text-text" style={{ fontSize: rf(12) }}>{money(s.estimatedPrice)}</Text>
              </View>
            ))}
            <View className="flex-row items-center justify-between mt-1.5 pt-1.5 border-t border-border">
              <Text className="font-extrabold text-text" style={{ fontSize: rf(12) }}>Estimated Repair Amount</Text>
              <Text className="font-extrabold text-primary" style={{ fontSize: rf(13) }}>{money(estimate)}</Text>
            </View>

            <View className="h-px bg-border my-3" />

            {/* Service details */}
            {(() => { const ci = cleanIssueSummary(b.issueSummary); return ci ? <InfoLine label="Complaint Issue" value={ci} /> : null; })()}
            <InfoLine label="Estimated Approximate Time" value={estTime} />
            <InfoLine label="Estimated Delivery Date" value={fmtDateTime(b.estimatedDeliveryAt)} />
            <InfoLine label="Customer Repair Approval" value={approval} valueClass="text-success" />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
