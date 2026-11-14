import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Smartphone, Skull, Cpu, HardDrive, Palette, ChevronRight, Check, ScanBarcode } from 'lucide-react-native';
import { BottomActionBar, Input, Label, Badge, useBottomBarInset } from '../../../components/rnr';
import { rf } from '../../../utils/responsive';
import { useImeiApplies, cleanImei, isValidImei, imeiError, IMEI_LENGTH } from '../../../utils/imeiPolicy';
import { FLOW, cardShadow, FlowCta, FlowDecor, FlowHeader, useHideStackHeader } from '../service-booking-customer/FlowChrome';

const OPTIONS = [
  { key: 'WORKING', label: 'Working Phone', sub: 'Turns on · Calls · No major issues', icon: Smartphone, color: '#035C6C', bg: 'bg-success/10', activeBg: 'bg-success/15', border: 'border-success' },
  { key: 'DEAD',    label: 'Phone Dead / Unknown', sub: "Won't turn on · Not sure",       icon: Skull,      color: '#F32C26', bg: 'bg-danger/10',  activeBg: 'bg-danger/15',  border: 'border-danger' },
];

export default function SellConditionScreen({ navigation, route }) {
  const bottomSpace = useBottomBarInset(96);
  useHideStackHeader(navigation);
  const device = route?.params?.device || {};
  const [condition, setCondition] = useState('WORKING');
  const [imei, setImei] = useState(device.imei || '');
  const showImei = useImeiApplies(device);

  const onContinue = () => {
    navigation.navigate('SellScreening', { device: { ...device, imei: showImei ? imei : undefined }, workingCondition: condition });
  };

  // ---- presentation-only values ----
  const specs = [
    device.ramLabel ? { Icon: Cpu, text: device.ramLabel } : null,
    device.storageLabel ? { Icon: HardDrive, text: device.storageLabel } : null,
    device.color ? { Icon: Palette, text: device.color } : null,
  ].filter(Boolean);
  const TONE = {
    WORKING: { tint: '#E5F3F5', color: '#035C6C', border: '#035C6C', bg: '#F0F8F9', badgeBg: '#E5F3F5', badgeFg: '#035c6c' },
    DEAD: { tint: '#FEEBEA', color: '#F32C26', border: '#F32C26', bg: '#FEEBEA', badgeBg: '#FEEBEA', badgeFg: '#F32C26' },
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F8F9' }}>
      <FlowDecor />
      <FlowHeader title="Your Device" navigation={navigation} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: bottomSpace }}>
        {/* Device hero card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(3,92,108,0.08)', padding: 14, marginBottom: 14, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', ...cardShadow }}>
          <View pointerEvents="none" style={{ position: 'absolute', right: -60, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: '#F0F8F9' }} />
          <View style={{ height: 96, width: 76, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            {device.imageUrl ? (
              <Image source={{ uri: device.imageUrl }} style={{ width: 76, height: 96 }} resizeMode="contain" />
            ) : (
              <View style={{ height: 64, width: 64, borderRadius: 20, backgroundColor: '#E5F3F5', alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={30} color="#035C6C" />
              </View>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: rf(11), color: '#606e87', letterSpacing: 1.6, fontWeight: '600' }}>YOUR DEVICE</Text>
            <Text style={{ fontSize: rf(21), fontWeight: '800', color: '#1C3053', marginTop: 2 }} numberOfLines={2}>{device.modelName || 'Device'}</Text>
            {device.color ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                {specs.map((s, i) => (
                  <View key={s.text} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    {i > 0 ? <View style={{ width: 1, height: 16, backgroundColor: '#E8EAEE', marginHorizontal: 9 }} /> : null}
                    <s.Icon size={15} color="#606e87" />
                    <Text style={{ fontSize: rf(13), color: '#606e87', marginLeft: 5 }}>{s.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* IMEI — mobile phones only */}
        {showImei ? (
        <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(3,92,108,0.08)', padding: 14, marginBottom: 18, ...cardShadow }}>
          <Text style={{ fontSize: rf(16), fontWeight: '800', color: '#1C3053', marginBottom: 10 }}>IMEI Number</Text>
          <Input
            placeholder="15-digit IMEI (dial *#06# on phone)"
            value={imei}
            onChangeText={(t) => setImei(cleanImei(t))}
            keyboardType="number-pad"
            maxLength={IMEI_LENGTH}
            leftIcon={(
              <View style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: '#F0F8F9', alignItems: 'center', justifyContent: 'center' }}>
                <ScanBarcode size={17} color="#035C6C" />
              </View>
            )}
            className="py-2" style={{ fontSize: rf(13.5) }}
          />
          {imeiError(imei) ? (
            <Text style={{ fontSize: rf(11.5), color: '#F32C26', marginTop: 6 }}>{imeiError(imei)}</Text>
          ) : null}
        </View>
        ) : null}

        {/* Condition picker */}
        <Text style={{ fontSize: rf(12), fontWeight: '800', color: '#606e87', letterSpacing: 1.6, marginBottom: 10, paddingHorizontal: 2 }}>PHONE CONDITION</Text>
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
                    backgroundColor: active ? t.bg : '#fff', borderWidth: active ? 2 : 1, borderColor: active ? t.border : '#E8EAEE',
                    ...cardShadow,
                  }}
                >
                  <View style={{ height: 58, width: 58, borderRadius: 29, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Icon size={28} color={t.color} />
                  </View>
                  <Text style={{ fontSize: rf(15), fontWeight: '800', color: '#1C3053', textAlign: 'center' }} numberOfLines={2}>{o.label}</Text>
                  <Text style={{ fontSize: rf(12), color: '#606e87', marginTop: 4, textAlign: 'center', lineHeight: rf(17) }} numberOfLines={3}>{o.sub}</Text>
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
        <FlowCta title="Continue" onPress={onContinue} disabled={showImei && !!imei && !isValidImei(imei)} />
      </BottomActionBar>
    </View>
  );
}
