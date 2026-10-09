import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Smartphone, Skull, Cpu, HardDrive, Palette, ChevronRight, Check, ScanBarcode } from 'lucide-react-native';
import { BottomActionBar, Input, Label, Badge, useBottomBarInset } from '../../../components/rnr';
import { rf } from '../../../utils/responsive';
import { FLOW, cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from '../service-booking-customer/FlowChrome';

const OPTIONS = [
  { key: 'WORKING', label: 'Working Phone', sub: 'Turns on · Calls · No major issues', icon: Smartphone, color: '#004C40', bg: 'bg-success/10', activeBg: 'bg-success/15', border: 'border-success' },
  { key: 'DEAD',    label: 'Phone Dead / Unknown', sub: "Won't turn on · Not sure",       icon: Skull,      color: '#EF4444', bg: 'bg-danger/10',  activeBg: 'bg-danger/15',  border: 'border-danger' },
];

export default function SellConditionScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  useHideStackHeader(navigation);
  const device = route?.params?.device || {};
  const [condition, setCondition] = useState('WORKING');
  const [imei, setImei] = useState(device.imei || '');

  const onContinue = () => {
    navigation.navigate('SellScreening', { device: { ...device, imei }, workingCondition: condition });
  };

  // ---- presentation-only values ----
  const specs = [
    device.ramLabel ? { Icon: Cpu, text: device.ramLabel } : null,
    device.storageLabel ? { Icon: HardDrive, text: device.storageLabel } : null,
    device.color ? { Icon: Palette, text: device.color } : null,
  ].filter(Boolean);
  const TONE = {
    WORKING: { tint: '#DFF8EF', color: '#006B57', border: '#006B57', bg: '#F0FBF7', badgeBg: '#DFF8EF', badgeFg: '#005747' },
    DEAD: { tint: '#FDECEC', color: '#EF4444', border: '#EF4444', bg: '#FFF7F7', badgeBg: '#FDECEC', badgeFg: '#B91C1C' },
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FCFA' }}>
      <FlowDecor />
      <FlowHeader title="Your Device" navigation={navigation} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: bottomSpace }}>
        {/* Device hero card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,107,87,0.08)', padding: 14, marginBottom: 14, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', ...cardShadow }}>
          <View pointerEvents="none" style={{ position: 'absolute', right: -60, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: '#F0FBF7' }} />
          <View style={{ height: 96, width: 76, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            {device.imageUrl ? (
              <Image source={{ uri: device.imageUrl }} style={{ width: 76, height: 96 }} resizeMode="contain" />
            ) : (
              <View style={{ height: 64, width: 64, borderRadius: 20, backgroundColor: '#DFF8EF', alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={30} color="#006B57" />
              </View>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(11), color: '#687990', letterSpacing: 1.6, fontWeight: '600' }}>YOUR DEVICE</Text>
            <Text style={{ fontSize: rf(21), fontWeight: '800', color: '#08162B', marginTop: 2 }} numberOfLines={2}>{device.modelName || 'Device'}</Text>
            {device.color ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                {specs.map((s, i) => (
                  <View key={s.text} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    {i > 0 ? <View style={{ width: 1, height: 16, backgroundColor: '#DFE9E5', marginHorizontal: 9 }} /> : null}
                    <s.Icon size={15} color="#687990" />
                    <Text style={{ fontSize: rf(13), color: '#687990', marginLeft: 5 }}>{s.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* IMEI */}
        <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,107,87,0.08)', padding: 14, marginBottom: 18, ...cardShadow }}>
          <Text style={{ fontSize: rf(16), fontWeight: '800', color: '#08162B', marginBottom: 10 }}>IMEI Number</Text>
          <Input
            placeholder="15-digit IMEI (dial *#06# on phone)"
            value={imei}
            onChangeText={setImei}
            keyboardType="number-pad"
            leftIcon={(
              <View style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: '#F0FBF7', alignItems: 'center', justifyContent: 'center' }}>
                <ScanBarcode size={17} color="#006B57" />
              </View>
            )}
            className="py-2" style={{ fontSize: rf(13.5) }}
          />
        </View>

        {/* Condition picker */}
        <Text style={{ fontSize: rf(12), fontWeight: '800', color: '#687990', letterSpacing: 1.6, marginBottom: 10, paddingHorizontal: 2 }}>PHONE CONDITION</Text>
        <View style={{ flexDirection: 'row', marginHorizontal: -5 }}>
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = condition === o.key;
            const t = TONE[o.key] || TONE.WORKING;
            return (
              <View key={o.key} style={{ flex: 1, paddingHorizontal: 5 }}>
                <Pressable
                  onPress={() => setCondition(o.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  className="active:opacity-90"
                  style={{
                    minHeight: 188, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center',
                    backgroundColor: active ? t.bg : '#fff', borderWidth: active ? 2 : 1, borderColor: active ? t.border : '#E8EEF1',
                    ...cardShadow,
                  }}
                >
                  <View style={{ height: 58, width: 58, borderRadius: 29, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Icon size={28} color={t.color} />
                  </View>
                  <Text style={{ fontSize: rf(15), fontWeight: '800', color: '#08162B', textAlign: 'center' }} numberOfLines={2}>{o.label}</Text>
                  <Text style={{ fontSize: rf(12), color: '#687990', marginTop: 4, textAlign: 'center', lineHeight: rf(17) }} numberOfLines={3}>{o.sub}</Text>
                  {active ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, borderRadius: 999, paddingLeft: 4, paddingRight: 12, paddingVertical: 4, backgroundColor: t.badgeBg }}>
                      <View style={{ height: 20, width: 20, borderRadius: 10, backgroundColor: t.color, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </View>
                      <Text style={{ fontSize: rf(11.5), fontWeight: '800', color: t.badgeFg, letterSpacing: 0.6 }}>SELECTED</Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <BottomActionBar>
        <FlowCta title="Continue" onPress={onContinue} />
      </BottomActionBar>
    </View>
  );
}
