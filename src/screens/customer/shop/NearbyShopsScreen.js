import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Store, Locate, Crosshair } from 'lucide-react-native';
import { Loader, EmptyState, ShopCard, SearchBar } from '../../../components/rnr';
import { listNearbyShops } from '../../../api/shops';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { travelTimesFor } from '../../../utils/travelTimes';
import { isShopOpen } from '../../../utils/shopHours';
import { rf } from '../../../utils/responsive';

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
    <View className="flex-1 bg-background">
      <View className="bg-card px-4 pt-3 pb-2.5 border-b border-border">
        <SearchBar
          value={q}
          onChangeText={setQ}
          placeholder="Search shop name or area..."
          onClear={() => setQ('')}
        />

        {lat != null && lng != null ? (
          <View className="mt-2.5">
            <Text className="font-extrabold text-text-muted tracking-widest mb-1.5" style={{ fontSize: rf(10) }}>RADIUS</Text>
            <View className="flex-row -mx-1">
              {RADIUS_OPTIONS.map((r) => {
                const active = radiusKm === r;
                return (
                  <View key={r} className="px-1 flex-1">
                    <Pressable
                      onPress={() => setRadiusKm(r)}
                      className={`rounded-full border py-1.5 items-center ${active ? 'bg-primary border-primary' : 'bg-card border-border'}`}
                    >
                      <Text className={` font-extrabold ${active ? 'text-white' : 'text-text'}`} style={{ fontSize: rf(11) }}>{r} km</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View className="bg-warning/10 border border-warning/30 rounded-xl mt-2.5 p-2 flex-row items-center">
            <Crosshair size={13} color="#F59E0B" />
            <Text className="text-text ml-2 flex-1" style={{ fontSize: rf(11) }} numberOfLines={1}>
              {locError || 'Set default address for distance results'}
            </Text>
            <Pressable onPress={refreshLoc} className="bg-warning/15 rounded-full px-2 py-0.5 active:opacity-70">
              <Text className="text-warning font-bold" style={{ fontSize: rf(10) }}>Retry</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="font-extrabold text-text-muted tracking-widest" style={{ fontSize: rf(10) }}>
          {filtered.length} SHOP{filtered.length === 1 ? '' : 'S'}{lat != null ? ` · WITHIN ${radiusKm} KM` : ''}
        </Text>
        {source ? (
          <View className="flex-row items-center">
            <Locate size={10} color="#004C40" />
            <Text className="text-success font-bold ml-1" style={{ fontSize: rf(10) }}>{source === 'address' ? addressLabel : 'Live'}</Text>
          </View>
        ) : null}
      </View>

      {showLoader ? (
        <Loader label="Finding shops near you..." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Store size={26} color="#00008B" />}
              title={lat != null ? `No shops within ${radiusKm} km` : 'No shops found'}
              description={lat != null && radiusKm < 100 ? 'Try expanding the search radius.' : (q ? 'Try a different search.' : 'Try again later.')}
              actionLabel={lat != null && radiusKm < 20 ? 'Expand to 20 km' : (q ? 'Clear search' : null)}
              onAction={() => { if (q) setQ(''); else setRadiusKm(20); }}
            />
          ) : (
            filtered.map((s) => (
              <View key={s.id} className="mb-2.5">
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
