import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { ArrowRight, Check } from 'lucide-react-native';
import { selectSession } from '../../../store/authSlice';
import DeviceImage from '../../../components/DeviceImage';
import { BookingHeader } from '../service-booking-customer/FlowChrome';

// Shared look for the device picker screens (category → brand → series →
// model → colour / storage), copied from the Partner app's single "Device
// Details" screen: every earlier choice sits on top as a compact card with a
// "Change" pill, the current choice is a grid underneath, and a teal Next bar
// is pinned to the bottom. Purely visual — screens keep their own handlers.

export const DP = {
  teal: '#035C6C',
  ink: '#111111',
  muted: '#6B7280',
  line: '#E5E7EB',
  page: '#F3F4F6',
  mint: '#E5F3F5',
  disabled: '#93BCC1',
};

// Content column: full width on phones, centred and capped on tablets.
export const DP_COLUMN = { width: '100%', maxWidth: 720, alignSelf: 'center' };

// The signed-in customer's name, for the "Device for <name>" subtitle.
export function useCustomerName() {
  const session = useSelector(selectSession);
  return session?.fullName || session?.name || session?.user?.fullName || session?.user?.name || '';
}

// "Device Details · Device for <name>" header (no step row, like Partner).
export function DevicePickerHeader({ navigation, title = 'Device Details', subtitle, onBack }) {
  const name = useCustomerName();
  return (
    <BookingHeader
      title={title}
      subtitle={subtitle ?? (name ? `Device for ${name}` : 'Choose your device')}
      navigation={navigation}
      onBack={onBack}
      step={null}
    />
  );
}

// Bold section label, optional "(Optional)" / required star (Partner Field label).
export function DPSection({ title, optional, required, style }) {
  return (
    <Text style={[{ fontSize: 14, lineHeight: 19, fontWeight: '700', color: DP.ink, marginTop: 16, marginBottom: 8 }, style]}>
      {title}
      {optional ? <Text style={{ fontWeight: '400', color: DP.muted }}> (Optional)</Text> : null}
      {required ? <Text style={{ color: '#F32C26' }}> *</Text> : null}
    </Text>
  );
}

// Catalogue image in a fixed box: contain-fit and centred (never stretched or
// cropped), a soft grey placeholder while it loads, and `fallback` (icon /
// initial) when there's no URL or it fails to load. Goes through DeviceImage
// so large PNGs decode at the box size and Cloudinary .avif is normalised.
export function PickerImage({ uri, width, height, fallback = null, radius = 10 }) {
  const [status, setStatus] = useState(uri ? 'loading' : 'failed');
  useEffect(() => { setStatus(uri ? 'loading' : 'failed'); }, [uri]);
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      {status === 'failed' ? fallback : (
        <>
          {status === 'loading' ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, backgroundColor: DP.page }} />
          ) : null}
          <DeviceImage
            url={uri}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            onLoad={() => setStatus('ready')}
            onError={() => setStatus('failed')}
          />
        </>
      )}
    </View>
  );
}

// First letter of a name on a soft disc — the no-image fallback.
function InitialDisc({ name, size }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: DP.page, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: Math.round(size * 0.45), fontWeight: '800', color: DP.ink }}>{String(name || '?').trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

// Compact selected-choice card (Partner PickedCard): image box · name (+ sub) · Change.
export function PickedCard({ image, icon: Icon, initial, title, subtitle, onChange, changeLabel = 'Change', imageSize = 36 }) {
  const fallback = Icon ? <Icon size={Math.round(imageSize * 0.6)} color={DP.teal} /> : <InitialDisc name={initial || title} size={imageSize} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: DP.line, borderRadius: 12, padding: 10 }}>
      <View style={{ width: imageSize + 8, height: imageSize + 8, borderRadius: 10, backgroundColor: DP.page, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <PickerImage uri={image} width={imageSize} height={imageSize} fallback={fallback} />
      </View>
      <View style={{ flex: 1, minWidth: 0, marginLeft: 10, marginRight: 8 }}>
        <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: '700', color: DP.ink }} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 12, lineHeight: 16, color: DP.muted, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {onChange ? (
        <Pressable
          onPress={onChange}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${changeLabel} ${title}`}
          className="active:opacity-70"
          style={{ minHeight: 34, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: DP.teal, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: DP.teal }}>{changeLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Grid tile (Partner GridTile): fixed image box over a label, white bordered
// card; `selected` = teal border + mint fill + ✓ badge. Width from the caller;
// `imageWidth` lets wide art (brand wordmarks) use more of the tile.
export function DPGridTile({ width, image, imageWidth, icon: Icon, label, onPress, selected, imageSize = 52, minHeight = 104, lines = 2, labelSize = 12, accessibilityLabel }) {
  const fallback = Icon ? (
    <View style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2, backgroundColor: DP.mint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={Math.round(imageSize * 0.45)} color={DP.teal} />
    </View>
  ) : <InitialDisc name={label} size={imageSize} />;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected: !!selected }}
      className="active:opacity-80"
      style={{
        width, minHeight, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 6,
        backgroundColor: selected ? DP.mint : '#FFFFFF', borderWidth: selected ? 1.5 : 1, borderColor: selected ? DP.teal : DP.line,
      }}
    >
      {selected ? (
        <View style={{ position: 'absolute', top: 6, right: 6, height: 18, width: 18, borderRadius: 9, backgroundColor: DP.teal, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <Check size={11} color="#FFFFFF" strokeWidth={3} />
        </View>
      ) : null}
      <PickerImage uri={image} width={imageWidth ?? imageSize} height={imageSize} fallback={fallback} />
      {label ? (
        <Text
          style={{ marginTop: 8, fontSize: labelSize, lineHeight: labelSize + 3, color: DP.ink, fontWeight: selected ? '700' : '500', textAlign: 'center', alignSelf: 'stretch' }}
          numberOfLines={lines}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

// Tile width for an n-column grid inside a padded column.
export const gridTileW = (contentW, cols, pad = 16, gap = 10) => Math.floor((contentW - pad * 2 - gap * (cols - 1)) / cols);

// Pinned teal "Next →" bar (disabled = muted teal), clear of the bottom inset.
export function DPNextBar({ label = 'Next', onPress, disabled, loading, children }) {
  const insets = useSafeAreaInsets();
  const off = disabled || loading;
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: DP.line, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
      <View style={DP_COLUMN}>
        {children}
        <Pressable
          onPress={onPress}
          disabled={off}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!off }}
          className={off ? '' : 'active:opacity-90'}
          style={{ height: 54, borderRadius: 16, backgroundColor: off ? DP.disabled : DP.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 17, fontWeight: '800', color: off ? 'rgba(255,255,255,0.75)' : '#FFFFFF', marginRight: 8 }}>
            {loading ? 'Please wait…' : label}
          </Text>
          {loading ? null : <ArrowRight size={20} color={off ? 'rgba(255,255,255,0.75)' : '#FFFFFF'} />}
        </Pressable>
      </View>
    </View>
  );
}

// Go back to an earlier picker if it's in the stack (keeps its state),
// otherwise open it with the params it needs.
export function goToPicker(navigation, routeName, params) {
  const routes = navigation.getState?.()?.routes || [];
  if (routes.some((r) => r.name === routeName)) navigation.popTo(routeName, params);
  else navigation.navigate(routeName, params);
}
