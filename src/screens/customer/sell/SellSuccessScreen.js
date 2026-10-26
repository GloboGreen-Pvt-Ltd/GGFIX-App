import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Home, FileCheck, Store, Pointer, ChevronRight, BadgeCheck, Smartphone, MapPin, ClipboardList } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import { SuccessHero, SuccessCard, InfoRow, NextSteps, SuccessActions, MUTED } from '../../../components/SuccessChrome';

// Static "what happens next" steps (unchanged content).
const STEPS = [
  { icon: FileCheck, state: 'done', title: 'Request created', sub: 'Shops have been notified' },
  { icon: Store, state: 'wait', title: 'Awaiting quotes', sub: 'Usually within 15 mins' },
  { icon: Pointer, state: 'todo', title: 'Pick your best offer', sub: 'Then schedule free pickup' },
];

export default function SellSuccessScreen({ navigation, route }) {
  // The real POST /sell-orders response, passed by SellCompleteScreen (plus the
  // device + pickup address the customer just submitted, for the summary).
  const sellOrder = route?.params?.sellOrder || {};
  const device = route?.params?.device || null;
  const address = route?.params?.address || null;
  const statusLabel = sellOrder.status ? String(sellOrder.status).replace(/_/g, ' ') : null;
  // The backend's sellNumber may already start with "#".
  const sellNo = sellOrder.sellNumber ? String(sellOrder.sellNumber).replace(/^#+/, '') : null;

  const deviceSpecs = device
    ? [device.customModel ? device.brandName : null, device.color, [device.ramLabel, device.storageLabel].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')
    : '';
  const addrRest = address ? [address.area || address.locality, address.district || address.city, address.state, address.pincode].filter(Boolean).join(', ') : '';

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <SuccessHero
          title="Sale Request Submitted!"
          subtitle="Verified shops will respond with quotes within minutes. We'll notify you the moment a quote arrives."
          chips={[
            sellNo ? { icon: BadgeCheck, text: `Sell Number: #${sellNo}`, selectable: true } : null,
            statusLabel ? { text: `Status: ${statusLabel}` } : null,
          ].filter(Boolean)}
        />

        {/* Cards overlap the hero's lower edge */}
        <View style={{ paddingHorizontal: 14, marginTop: -30 }}>
          {device || address ? (
            <SuccessCard raised icon={ClipboardList} title="Request Summary">
              {device ? <InfoRow icon={Smartphone} label="Device" value={device.modelName || 'Device'} sub={deviceSpecs || null} last={!address} /> : null}
              {address ? <InfoRow icon={MapPin} label="Pickup Address" value={address.addressLine || addrRest} sub={address.addressLine ? addrRest : null} last /> : null}
            </SuccessCard>
          ) : null}

          <NextSteps steps={STEPS} />

          <Text style={{ fontSize: rf(11), color: MUTED, textAlign: 'center', paddingHorizontal: 12, lineHeight: rf(16) }}>
            Compare quotes in My Orders and accept the one you like — pickup is free.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky actions — same handlers as before. */}
      <SuccessActions
        secondary={{ label: 'Home', icon: Home, onPress: () => navigation.popToTop() }}
        primary={{ label: 'View Order', trailing: ChevronRight, onPress: () => { navigation.popToTop(); navigation.navigate('MyOrders', { initialTab: 'Sell' }); } }}
      />
    </View>
  );
}
