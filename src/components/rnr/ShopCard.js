import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Star, MapPin, Phone, Navigation, Clock } from 'lucide-react-native';
import { cn } from './cn';
import { rf } from '../../utils/responsive';
import { BRAND } from '../../theme/brand';

// Brand palette (09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23 · F84141).
const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const MINT = '#EAF8EC';
const MUTED = '#6B6B6B';

const cardShadow = {
  shadowColor: BRAND.ink,
  shadowOpacity: 0.04,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};

// "0.2956…" -> "296 m"; "1.2345" -> "1.2 km". Returns null when not usable.
function formatDistance(d) {
  if (d === null || d === undefined || d === '') return null;
  const n = Number(d);
  if (!isFinite(n) || n < 0) return null;
  if (n < 0.05) return '< 50 m';
  return n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1)} km`;
}

export function ShopCard({
  name,
  address,
  image,
  rating,
  reviews,
  distance,
  eta,
  etaText,
  travelTimes,
  open = true,
  onPress,
  onCall,
  onDirections,
  className,
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn('rounded-2xl', className)}
      style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 11, ...cardShadow }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ height: 44, width: 44, borderRadius: 12, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden' }}>
          {image ? (
            <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: rf(16), fontWeight: '800', color: GREEN_TEXT }}>{(name || '?').slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Text style={{ flex: 1, fontSize: rf(14), fontWeight: '800', color: BRAND.ink }} numberOfLines={1}>{name}</Text>
            <View style={{ borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6, backgroundColor: open ? MINT : BRAND.redSoft }}>
              <Text style={{ fontSize: rf(9), fontWeight: '800', letterSpacing: 0.5, color: open ? GREEN_TEXT : BRAND.red }}>
                {open ? 'OPEN' : 'CLOSED'}
              </Text>
            </View>
          </View>
          {address ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
              <MapPin size={12} color={MUTED} />
              <Text style={{ flex: 1, marginLeft: 4, fontSize: rf(11.5), color: MUTED }} numberOfLines={1}>{address}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            {rating ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.yellowSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginRight: 8 }}>
                <Star size={11} color={BRAND.yellow} fill={BRAND.yellow} />
                <Text style={{ marginLeft: 3, fontSize: rf(10.5), fontWeight: '800', color: BRAND.ink }}>
                  {Number(rating).toFixed(1)}
                </Text>
                {reviews ? <Text style={{ marginLeft: 3, fontSize: rf(10.5), color: MUTED }}>({reviews})</Text> : null}
              </View>
            ) : null}
            {formatDistance(distance) ? (
              <Text style={{ marginRight: 8, fontSize: rf(10.5), fontWeight: '700', color: GREEN_TEXT }}>{formatDistance(distance)}</Text>
            ) : null}
            {!travelTimes?.length && (etaText || eta) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Clock size={11} color={MUTED} />
                <Text style={{ marginLeft: 3, fontSize: rf(10.5), color: MUTED }}>{etaText || `${eta} min`}</Text>
              </View>
            ) : null}
          </View>

          {/* Per-mode travel times from the customer's location to this shop */}
          {travelTimes?.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
              {travelTimes.map((t) => {
                const TIcon = t.Icon;
                return (
                  <View key={t.key} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                    {TIcon ? <TIcon size={12} color={MUTED} /> : null}
                    <Text style={{ marginLeft: 3, fontSize: rf(10.5), fontWeight: '700', color: BRAND.ink }}>{t.text}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
      {(onCall || onDirections) ? (
        <View style={{ flexDirection: 'row', marginTop: 9, paddingTop: 5, marginHorizontal: -4, borderTopWidth: 1, borderTopColor: BRAND.line }}>
          {onCall ? (
            <Pressable onPress={onCall} className="active:opacity-70" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}>
              <Phone size={14} color={BRAND.green} />
              <Text style={{ marginLeft: 6, fontSize: rf(12), fontWeight: '700', color: GREEN_TEXT }}>Call</Text>
            </Pressable>
          ) : null}
          {onDirections ? (
            <Pressable onPress={onDirections} className="active:opacity-70" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderLeftWidth: 1, borderLeftColor: BRAND.line }}>
              <Navigation size={14} color={BRAND.red} />
              <Text style={{ marginLeft: 6, fontSize: rf(12), fontWeight: '700', color: BRAND.ink }}>Directions</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
