import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Store, Locate, Crosshair } from 'lucide-react-native';
import { Loader, EmptyState, ShopCard, SearchBar } from '../../../components/rnr';
import { listNearbyShops } from '../../../api/shops';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { travelTimesFor } from '../../../utils/travelTimes';
import { isShopOpen } from '../../../utils/shopHours';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const MINT = '#EAF8EC';
const YELLOW_SOFT = '#FEF6DA';
const MUTED = '#6B6B6B';

const RADIUS_OPTIONS = [5, 10, 15, 20];

export default function NearbyShopsScreen({ navigation }) {
  const { lat, lng, source, loading: locLoading, error: locError, addressLabel, refresh: refreshLoc } = useCustomerLocation();
  const [radiusKm, setRadiusKm] = useState(20);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listNearbyShops({
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        radiusKm: lat != null && lng != null ? radiusKm : undefined,
      });
      setShops(list || []);
    } catch (_) {
      setShops([]);
    } finally { setLoading(false); }
  }, [lat, lng, radiusKm]);

  useEffect(() => { if (!locLoading) load(); }, [locLoading, load]);

  const filtered = useMemo(() => {
    if (!q.trim()) return shops;
    const n = q.toLowerCase();
    return shops.filter((s) =>
      (s.name || '').toLowerCase().includes(n) ||
      (s.address || '').toLowerCase().includes(n) ||
      (s.city || '').toLowerCase().includes(n),
    );
  }, [shops, q]);

  const showLoader = locLoading || (loading && shops.length === 0);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: LINE }}>
        <SearchBar
          value={q}
          onChangeText={setQ}
          placeholder="Search shop name or area..."
          onClear={() => setQ('')}
        />

        {lat != null && lng != null ? (
          <View style={{ marginTop: 9 }}>
            <Text style={{ fontSize: rf(10), fontWeight: '800', color: MUTED, letterSpacing: 1.4, marginBottom: 6 }}>RADIUS</Text>
            <View style={{ flexDirection: 'row', marginHorizontal: -3 }}>
              {RADIUS_OPTIONS.map((r) => {
                const active = radiusKm === r;
                return (
                  <View key={r} style={{ flex: 1, paddingHorizontal: 3 }}>
                    <Pressable
                      onPress={() => setRadiusKm(r)}
                      className="active:opacity-80"
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{
                        alignItems: 'center', paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                        backgroundColor: active ? BRAND.green : '#FFFFFF', borderColor: active ? BRAND.green : LINE,
                      }}
                    >
                      <Text style={{ fontSize: rf(11), fontWeight: '800', color: active ? '#FFFFFF' : BRAND.ink }}>{r} km</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9, padding: 8, borderRadius: 12, backgroundColor: YELLOW_SOFT, borderWidth: 1, borderColor: BRAND.yellowLine }}>
            <Crosshair size={13} color={BRAND.yellow} />
            <Text style={{ flex: 1, marginLeft: 7, fontSize: rf(11), color: BRAND.ink }} numberOfLines={1}>
              {locError || 'Set default address for distance results'}
            </Text>
            <Pressable onPress={refreshLoc} className="active:opacity-70" style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: 'rgba(243,191,35,0.28)' }}>
              <Text style={{ fontSize: rf(10), fontWeight: '700', color: BRAND.ink }}>Retry</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 11, paddingBottom: 6 }}>
        <Text style={{ fontSize: rf(10), fontWeight: '800', color: MUTED, letterSpacing: 1.2 }}>
          {filtered.length} SHOP{filtered.length === 1 ? '' : 'S'}{lat != null ? ` · WITHIN ${radiusKm} KM` : ''}
        </Text>
        {source ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Locate size={11} color={BRAND.green} />
            <Text style={{ marginLeft: 4, fontSize: rf(10.5), fontWeight: '700', color: GREEN_TEXT }}>{source === 'address' ? addressLabel : 'Live'}</Text>
          </View>
        ) : null}
      </View>

      {showLoader ? (
        <Loader label="Finding shops near you..." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Store size={26} color={BRAND.green} />}
              accent={BRAND.green}
              accentSoft={MINT}
              title={lat != null ? `No shops within ${radiusKm} km` : 'No shops found'}
              description={lat != null && radiusKm < 100 ? 'Try expanding the search radius.' : (q ? 'Try a different search.' : 'Try again later.')}
              actionLabel={lat != null && radiusKm < 20 ? 'Expand to 20 km' : (q ? 'Clear search' : null)}
              onAction={() => { if (q) setQ(''); else setRadiusKm(20); }}
            />
          ) : (
            filtered.map((s) => (
              <View key={s.id} style={{ marginBottom: 9 }}>
                <ShopCard
                  name={s.name}
                  address={s.address || s.city}
                  image={s.frontImageUrl}
                  rating={s.rating || 4.5}
                  reviews={s.reviewCount || 100}
                  distance={s.distanceKm != null ? s.distanceKm.toFixed(1) : null}
                  travelTimes={travelTimesFor(s.distanceKm)}
                  open={isShopOpen(s) ?? true}
                  onPress={() => navigation.navigate('ShopDetails', { shopId: s.id })}
                />
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
