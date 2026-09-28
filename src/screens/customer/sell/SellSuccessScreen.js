import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Home, FileCheck, Store, Clock, Pointer, ChevronRight, Sparkle } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { FLOW, cardShadow } from '../service-booking-customer/FlowChrome';

// Static "what happens next" steps (unchanged content).
const STEPS = [
  { icon: FileCheck, badge: 'check', tint: '#DFF8EF', color: '#006B57', title: 'Request created', sub: 'Shops have been notified' },
  { icon: Store, badge: 'clock', tint: '#FFF1DC', color: '#F59E0B', title: 'Awaiting quotes', sub: 'Usually within 15 mins' },
  { icon: Pointer, badge: null, tint: '#DFF8EF', color: '#006B57', title: 'Pick your best offer', sub: 'Then schedule free pickup' },
];

const SPARKLES = [[-96, -30, 18], [80, -64, 14], [98, 8, 10], [-74, 44, 12], [66, 62, 10], [-40, -80, 8]];

export default function SellSuccessScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#F8FCFA' }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Success hero */}
        <LinearGradient colors={['#004236', '#005747', '#006B57']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingBottom: 64, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, left: -150, top: -60, backgroundColor: 'rgba(255,255,255,0.05)' }} />
            <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -140, bottom: -110, backgroundColor: 'rgba(0,155,115,0.22)' }} />
            <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, left: -110, bottom: -80, backgroundColor: 'rgba(0,155,115,0.18)' }} />
          </View>
          <SafeAreaView edges={['top']}>
            <View style={{ alignItems: 'center', paddingTop: 26, paddingHorizontal: 20 }}>
              <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                <View style={{ position: 'absolute', width: 118, height: 118, borderRadius: 59, backgroundColor: 'rgba(0,155,115,0.55)' }} />
                {SPARKLES.map(([x, y, s], i) => (
                  <Sparkle key={i} size={s} color="#7CE8C3" fill="#7CE8C3" style={{ position: 'absolute', left: 75 + x - s / 2, top: 75 + y - s / 2 }} />
                ))}
                <View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
                  <Check size={46} color={FLOW.deep} strokeWidth={3.4} />
                </View>
              </View>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: rf(26), marginTop: 12, textAlign: 'center', letterSpacing: -0.3 }}>Sale Request Submitted!</Text>
              <Text style={{ color: 'rgba(236,253,245,0.88)', fontSize: rf(13.5), marginTop: 8, textAlign: 'center', lineHeight: rf(20) }}>
                Verified shops will respond with quotes within minutes. We'll notify you the moment a quote arrives.
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Process card — overlaps the hero */}
        <View style={{ paddingHorizontal: 16, marginTop: -40 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(0,107,87,0.08)', padding: 14, shadowColor: '#0F3D33', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 }}>
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const first = i === 0;
              return (
                <View key={s.title}>
                  {i > 0 ? (
                    <View style={{ height: 14, marginLeft: 37, borderLeftWidth: 1.5, borderStyle: 'dashed', borderLeftColor: '#B7C6D1' }} />
                  ) : null}
                  <View
                    style={{
                      flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 12,
                      backgroundColor: first ? '#F0FBF7' : '#fff', borderWidth: 1, borderColor: first ? '#DDF2EA' : '#E8EEF1',
                    }}
                  >
                    <View style={{ height: 52, width: 52, borderRadius: 26, backgroundColor: s.tint, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Icon size={24} color={s.color} />
                      {s.badge ? (
                        <View style={{ position: 'absolute', right: 2, bottom: 2, height: 20, width: 20, borderRadius: 10, backgroundColor: s.badge === 'check' ? '#009B73' : '#F59E0B', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                          {s.badge === 'check' ? <Check size={11} color="#fff" strokeWidth={3} /> : <Clock size={11} color="#fff" strokeWidth={2.6} />}
                        </View>
                      ) : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: rf(16), fontWeight: '800', color: '#08162B' }}>{s.title}</Text>
                      <Text style={{ fontSize: rf(13), color: '#687990', marginTop: 3 }}>{s.sub}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky actions — same handlers as before. */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: FLOW.border, paddingBottom: Math.max(insets.bottom, 12) + 8, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
        <Pressable
          onPress={() => navigation.popToTop()}
          accessibilityRole="button"
          className="active:opacity-85"
          style={{ flex: 1, marginRight: 6, height: 58, borderRadius: 22, borderWidth: 1.5, borderColor: '#006B57', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        >
          <Home size={20} color="#08162B" />
          <Text style={{ color: '#006B57', fontWeight: '800', fontSize: rf(16), marginLeft: 8 }}>Home</Text>
        </Pressable>
        <Pressable
          onPress={() => { navigation.popToTop(); navigation.navigate('MyOrders'); }}
          accessibilityRole="button"
          className="active:opacity-90"
          style={{ flex: 1, marginLeft: 6, height: 58, borderRadius: 22, backgroundColor: '#005747', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#005747', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(16), marginRight: 6 }}>View Order</Text>
          <ChevronRight size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
