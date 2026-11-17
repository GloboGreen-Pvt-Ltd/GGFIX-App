import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Store, MapPin } from 'lucide-react-native';
import { listNearbyShops } from '../api/shops';
import { useCustomerLocation } from '../hooks/useCustomerLocation';
import { verifiedCoords, haversineKm } from '../utils/pickupDistance';
import { isShopOpen } from '../utils/shopHours';
import { rf } from '../utils/responsive';

const TEAL = '#035C6C';
const INK = '#111111';
const MUTED = '#606E87';
const LINE = '#E8EAEE';

// Real nearby shops for Buy Home. Distance only from verified coords on both
// sides; hidden when unknown or < 0.05 km (never "0.0 km").
export default function BuyNearbyShops({ navigation, pad = 16 }) {
  const { lat, lng, loading: locLoading } = useCustomerLocation();
  const [shops, setShops] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    if (locLoading) return undefined;
    const origin = verifiedCoords({ lat, lng });
    if (!origin) { setState('noloc'); return undefined; }
    let alive = true;
    setState('loading');
    listNearbyShops({ lat: origin.lat, lng: origin.lng })
      .then((list) => {
        if (!alive) return;
        const rows = (Array.isArray(list) ? list : []).map((s) => {
          const c = verifiedCoords(s);
          const d = c ? haversineKm(origin, c) : null;
          return { ...s, _km: Number.isFinite(d) ? d : null };
        }).sort((a, b) => (a._km ?? 1e9) - (b._km ?? 1e9)).slice(0, 8);
        setShops(rows);
        setState('ok');
      })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [lat, lng, locLoading]);

  const msg = state === 'loading' ? 'Finding shops near you…'
    : state === 'error' ? "Couldn't load nearby shops."
    : state === 'noloc' ? 'Set a delivery address to see nearby shops.'
    : !shops.length ? 'No shops found near you yet.' : null;

  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, marginBottom: 8 }}>
        <Store size={18} color={TEAL} />
        <Text style={{ flex: 1, marginLeft: 6, fontSize: rf(16), fontWeight: '800', color: INK }}>Nearby Shops</Text>
        <Pressable onPress={() => navigation.navigate('NearbyShops')} style={{ paddingVertical: 4 }}>
          <Text style={{ fontSize: rf(12.5), fontWeight: '800', color: TEAL }}>View All</Text>
        </Pressable>
      </View>
      {msg ? (
        <Text style={{ paddingHorizontal: pad, fontSize: rf(12.5), color: state === 'error' ? '#B91C1C' : MUTED }}>{msg}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 10, paddingBottom: 4 }}>
          {shops.map((s) => {
            const img = s.logoUrl || s.frontImageUrl || s.imageUrl || s.photoUrl || s.coverImageUrl || null;
            const open = isShopOpen(s);
            const loc = s.area || s.city || s.address || '';
            const showKm = s._km != null && s._km >= 0.05;
            return (
              <Pressable key={s.id} onPress={() => navigation.navigate('ShopDetails', { shopId: s.id })} accessibilityRole="button" accessibilityLabel={s.name || 'Shop'}
                style={{ width: 210, flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 14, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF' }}>
                <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: '#E5F3F5', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {img ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Store size={22} color={TEAL} />}
                </View>
                <View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
                  <Text numberOfLines={1} style={{ fontSize: rf(13), fontWeight: '800', color: INK }}>{s.name || s.shopName || 'Shop'}</Text>
                  {loc ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <MapPin size={11} color={MUTED} />
                      <Text numberOfLines={1} style={{ flex: 1, marginLeft: 3, fontSize: rf(11), color: MUTED }}>{loc}</Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
                    {open != null ? (
                      <Text style={{ fontSize: rf(10.5), fontWeight: '800', color: open ? '#01805A' : '#B91C1C' }}>{open ? 'Open now' : 'Closed'}</Text>
                    ) : null}
                    {showKm ? (
                      <Text style={{ fontSize: rf(10.5), fontWeight: '800', color: TEAL, backgroundColor: '#E5F3F5', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>{s._km.toFixed(1)} km</Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
