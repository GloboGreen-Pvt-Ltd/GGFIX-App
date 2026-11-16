import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { ChevronRight, MapPin, Store } from 'lucide-react-native';
import { listNearbyShops } from '../../../api/shops';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { rf } from '../../../utils/responsive';

// My Orders › Enquiry footer: a thin divider, then real nearby shops (the
// Nearby Shops feed around the customer's location) nearest first, one
// compact row each — tap opens Shop Details.
const TEAL = '#035C6C';
const INK = '#111111';
const MUTED = 'rgba(17,17,17,0.55)';
const LINE = '#E5E7EB';
const MAX_SHOPS = 10;

const km = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);

export default function EnquiryNearbyShops({ navigation }) {
  const { lat, lng, loading: locLoading } = useCustomerLocation();
  const [state, setState] = useState({ loading: true, error: null, shops: [] });

  const load = useCallback(async () => {
    if (lat == null || lng == null) {
      if (!locLoading) setState({ loading: false, error: null, shops: [] });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const list = await listNearbyShops({ lat, lng, radiusKm: 20 });
      const seen = new Set();
      const shops = (Array.isArray(list) ? list : [])
        .filter((s) => s?.id && !seen.has(s.id) && seen.add(s.id))
        .sort((a, b) => (km(a.distanceKm) ?? Infinity) - (km(b.distanceKm) ?? Infinity));
      setState({ loading: false, error: null, shops });
    } catch (e) {
      setState({ loading: false, error: e?.message || 'Could not load nearby shops.', shops: [] });
    }
  }, [lat, lng, locLoading]);
  useEffect(() => { load(); }, [load]);

  const { loading, error, shops } = state;
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ height: 1, backgroundColor: LINE }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 2 }}>
        <MapPin size={16} color={TEAL} />
        <Text style={{ marginLeft: 6, fontSize: rf(14.5), fontWeight: '800', color: INK }}>Nearby Shops</Text>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 16 }}><ActivityIndicator color={TEAL} /></View>
      ) : error ? (
        <View style={{ paddingVertical: 10 }}>
          <Text style={{ fontSize: rf(12.5), color: MUTED }}>{error}</Text>
          <Pressable onPress={load} hitSlop={8} accessibilityRole="button" style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: TEAL }}>Try again</Text>
          </Pressable>
        </View>
      ) : !shops.length ? (
        <Text style={{ paddingVertical: 10, fontSize: rf(12.5), color: MUTED }}>
          {lat == null || lng == null ? 'Turn on location to see shops near you.' : 'No shops found near you.'}
        </Text>
      ) : (
        shops.slice(0, MAX_SHOPS).map((s) => {
          const thumb = s.frontImageUrl || s.imageUrl || s.photoUrl || null;
          const dist = km(s.distanceKm);
          return (
            <Pressable
              key={s.id}
              onPress={() => navigation.navigate('ShopDetails', { shopId: s.id })}
              accessibilityRole="button"
              accessibilityLabel={`${s.name || 'Shop'}${dist != null ? `, ${dist.toFixed(1)} km` : ''}`}
              className="active:opacity-85"
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF' }}
            >
              {thumb ? (
                <Image source={{ uri: thumb }} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6' }} resizeMode="cover" />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(3,92,108,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={20} color={TEAL} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                <Text numberOfLines={1} style={{ fontSize: rf(13.5), fontWeight: '800', color: INK }}>{s.name || 'Shop'}</Text>
                {s.address || s.city ? (
                  <Text numberOfLines={1} style={{ marginTop: 2, fontSize: rf(11.5), color: MUTED }}>{s.address || s.city}</Text>
                ) : null}
              </View>
              {dist != null ? <Text style={{ marginLeft: 8, fontSize: rf(12), fontWeight: '800', color: TEAL }}>{dist.toFixed(1)} km</Text> : null}
              <ChevronRight size={18} color={MUTED} style={{ marginLeft: 4 }} />
            </Pressable>
          );
        })
      )}
    </View>
  );
}
