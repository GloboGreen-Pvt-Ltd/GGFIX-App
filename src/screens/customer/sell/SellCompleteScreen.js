import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notify } from '../../../components/confirm';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../theme/colors';
import { Card, PrimaryButton } from '../../../components/ui';
import { createSellOrder, updateSellOrder } from '../../../api/orders';
import { createListing } from '../../../api/marketplace';
import { getSession } from '../../../auth/session';
import { rf, rlh } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import { withTypedDevice } from '../../../utils/typedDevice';

const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const MUTED = '#6B6B6B';
const cardBox = { borderColor: LINE, borderWidth: 1, borderRadius: 16, padding: 12, marginVertical: 0, marginBottom: 10, backgroundColor: '#FFFFFF', shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  deviceCard: cardBox,
  summaryCard: cardBox,
  customerCard: cardBox,
  body: { flexDirection: 'row', alignItems: 'center' },
  modelName: { fontSize: rf(14.5), fontWeight: '800', color: BRAND.ink },
  small: { fontSize: rf(11.5), color: MUTED, marginTop: 2 },
  thumb: { width: 60, height: 68, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BRAND.line, marginLeft: 10 },
  photoHeading: { fontSize: rf(11.5), fontWeight: '800', color: BRAND.ink, marginTop: 10, marginBottom: 6 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  photoItem: { width: 72, marginHorizontal: 3, marginBottom: 6 },
  photoBox: { width: '100%', height: 64, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(9,173,42,0.45)', overflow: 'hidden', backgroundColor: '#F4FBF5' },
  photoLabel: { fontSize: rf(9.5), color: MUTED, textAlign: 'center', marginTop: 3, fontWeight: '600' },
  heading: { fontSize: rf(13.5), fontWeight: '800', color: GREEN_TEXT, marginBottom: 4 },
  subHeading: { fontSize: rf(12), fontWeight: '800', color: BRAND.ink, marginTop: 8, marginBottom: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  itemText: { marginLeft: 6, fontSize: rf(11.5), color: BRAND.body, flex: 1, lineHeight: rlh(15) },
  custRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 5 },
  custText: { marginLeft: 7, fontSize: rf(12), color: BRAND.ink, flex: 1, lineHeight: rlh(16) },
  bottom: { padding: 10, backgroundColor: '#fff', borderTopColor: LINE, borderTopWidth: 1 },
});

const PHOTO_SLOTS = [
  { key: 'front', label: 'Front Side' },
  { key: 'back', label: 'Backside' },
  { key: 'side', label: 'side and Center' },
  { key: 'camera', label: 'Camera' },
  { key: 'other', label: 'side and Center' },
];

function Check() {
  return <Ionicons name="checkmark-circle" size={14} color={BRAND.green} style={{ marginTop: 1 }} />;
}

export default function SellCompleteScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const p = route.params || {};
  const device = p.device || {};
  const address = p.address || {};
  const images = p.images || {};
  const [saving, setSaving] = useState(false);

  const storageLine = [device.ramLabel, device.storageLabel].filter(Boolean).join(' / ');
  const photos = PHOTO_SLOTS.filter((s) => images[s.key]);
  const phone = address.mobile ? (String(address.mobile).startsWith('+') ? address.mobile : `+91 ${address.mobile}`) : '';

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        brandId: device.brandId,
        modelId: device.modelId,
        ramOptionId: device.ramOptionId,
        storageOptionId: device.storageOptionId,
        color: device.color,
        imei: device.imei,
        // An "Other" device (typed brand / model) has no catalogue ids: its
        // labels ride along, and the typed device is appended to the condition
        // summary, which is what the shop reads. Catalogue devices are unchanged.
        ...(device.customModel ? {
          brandName: device.brandName,
          modelName: device.modelName,
          ramLabel: device.ramLabel,
          storageLabel: device.storageLabel,
        } : {}),
        workingCondition: p.workingCondition,
        warrantyCode: p.warranty,
        addressId: p.addressId,
        screeningAnswers: p.screeningAnswers || [],
        conditions: p.conditions || [],
        issues: p.issues || [],
        accessories: p.accessories || [],
        // Previously collected but silently dropped on submit: the per-category
        // "Device Configuration" answers and the free-text condition summary.
        // Send them so the shop actually receives what the customer entered.
        deviceConfig: p.deviceConfig || [],
        deviceConditionSummary: device.customModel ? withTypedDevice(p.deviceCondition, device) : (p.deviceCondition || undefined),
        images,
      };

      // When the customer entered this flow via "Edit sell order", PUT the
      // existing order instead of creating a new one — and don't re-mirror to
      // the marketplace listing (the original listing already points at it).
      if (p.editSellOrderId) {
        const updated = await updateSellOrder(p.editSellOrderId, payload);
        // navigate() pops back to the existing SellOrderDetails route if it's
        // still on the stack; otherwise it pushes a fresh one. Either way the
        // customer lands on the details page, which refetches on focus.
        navigation.navigate('SellOrderDetails', { sellOrderId: p.editSellOrderId, sellOrder: updated });
        return;
      }

      const created = await createSellOrder(payload);

      // Mirror this sell-order onto the public Buy/Sell marketplace so nearby
      // shops can spot it from their Buy screen. Best-effort — never block the
      // success flow if the marketplace POST fails (e.g. service is down).
      try {
        const session = (await getSession()) || {};
        const lat = address.latitude != null ? Number(address.latitude) : null;
        const lng = address.longitude != null ? Number(address.longitude) : null;
        const conditionLabel = p.deviceCondition
          || (p.workingCondition === 'DEAD' ? 'Not working' : 'Used');
        const summary = [device.color, storageLine].filter(Boolean).join(' · ');
        if (session.userId && device.modelName) {
          // NOTE: CreateListingRequest has no field referencing the sell order
          // (checked against the marketplace OpenAPI spec). When the backend
          // adds one, send `created.id` here so shops can quote on this order.
          await createListing({
            sellerType: 'CUSTOMER',
            sellerId: session.userId,
            // CreateListingRequest accepts categoryId (and ListingView returns
            // it), so shops can filter these by device category. Only a real
            // UUID — a category *code* string would fail the backend FK.
            categoryId: /^[0-9a-f-]{36}$/i.test(String(device.categoryId || '')) ? device.categoryId : undefined,
            brandId: device.brandId,
            modelId: device.modelId,
            productName: device.customModel ? [device.brandName, device.modelName].filter(Boolean).join(' ') : device.modelName,
            productImage: images.front || device.imageUrl,
            condition: conditionLabel,
            description: summary || undefined,
            expectedPrice: 0, // 0 = awaiting shop quotation
            latitude: lat,
            longitude: lng,
            address: address.addressLine,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
          });
        }
      } catch (_) { /* best-effort mirror */ }

      navigation.replace('SellSuccess', { sellOrder: created, device, address });
    } catch (e) {
      notify('Error', e.message);
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {/* Device */}
        <Card style={styles.deviceCard}>
          <View style={styles.body}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modelName}>{device.modelName || 'Device'}</Text>
              {device.customModel && device.brandName ? <Text style={styles.small}>Brand: {device.brandName}</Text> : null}
              {device.color ? <Text style={styles.small}>Color: {device.color}</Text> : null}
              {storageLine ? <Text style={styles.small}>Storage: {storageLine}</Text> : null}
              <Text style={styles.small}>Device Condition: {p.deviceCondition || (p.workingCondition === 'DEAD' ? 'Unknown Condition' : 'Good')}</Text>
              <Text style={styles.small}>IMEI Number : {device.imei || '-'}</Text>
            </View>
            {device.imageUrl ? (
              <Image source={{ uri: device.imageUrl }} style={styles.thumb} resizeMode="contain" />
            ) : (
              <View style={styles.thumb} />
            )}
          </View>

          {photos.length ? (
            <>
              <Text style={styles.photoHeading}>Device Photo's</Text>
              <View style={styles.photoRow}>
                {photos.map((s) => (
                  <View key={s.key} style={styles.photoItem}>
                    <View style={styles.photoBox}>
                      <Image source={{ uri: images[s.key] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>
                    <Text style={styles.photoLabel} numberOfLines={1}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </Card>

        {/* Device Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.heading}>Device Summary</Text>

          {(p.screeningAnswers || []).length ? (
            <>
              <Text style={styles.subHeading}>Screening Question</Text>
              {(p.screeningAnswers || []).map((a, i) => (
                <View key={i} style={styles.itemRow}>
                  <Check />
                  <Text style={styles.itemText}>{[a.answer, a.question].filter(Boolean).join(', ')}</Text>
                </View>
              ))}
            </>
          ) : null}

          {(p.conditions || []).length ? (
            <>
              <Text style={styles.subHeading}>Screen</Text>
              {(p.conditions || []).map((c, i) => (
                <View key={i} style={styles.itemRow}>
                  <Check />
                  <Text style={styles.itemText}>{[c.optionLabel, c.groupName].filter(Boolean).join(', ')}</Text>
                </View>
              ))}
            </>
          ) : null}

          {(p.accessories || []).length ? (
            <>
              <Text style={styles.subHeading}>Accessories</Text>
              {(p.accessories || []).map((a, i) => (
                <View key={i} style={styles.itemRow}>
                  <Check />
                  <Text style={styles.itemText}>{[a.label || a.accessoryCode, 'Accessories'].filter(Boolean).join(', ')}</Text>
                </View>
              ))}
            </>
          ) : null}

          {p.warrantyLabel ? (
            <>
              <Text style={styles.subHeading}>Warranty</Text>
              <View style={styles.itemRow}>
                <Check />
                <Text style={styles.itemText}>{p.warrantyLabel}</Text>
              </View>
            </>
          ) : null}
        </Card>

        {/* Customer Details */}
        {(address.fullName || address.addressLine) ? (
          <Card style={styles.customerCard}>
            <Text style={styles.heading}>Customer Details</Text>
            <View style={styles.custRow}>
              <Ionicons name="person-outline" size={15} color={GREEN_TEXT} style={{ marginTop: 1 }} />
              <Text style={styles.custText}>{[address.fullName, phone].filter(Boolean).join('  |  ')}</Text>
            </View>
            <View style={styles.custRow}>
              <Ionicons name="location-outline" size={15} color={BRAND.red} style={{ marginTop: 1 }} />
              <Text style={styles.custText}>{[address.addressLine, address.locality, address.city, address.state, address.pincode].filter(Boolean).join(', ')}</Text>
            </View>
          </Card>
        ) : null}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <PrimaryButton
          title={p.editSellOrderId ? 'Update Order →' : 'Sell Now →'}
          onPress={submit}
          loading={saving}
          style={{ backgroundColor: p.editSellOrderId ? BRAND.ink : BRAND.green, borderRadius: 16, paddingVertical: 13 }}
        />
      </View>
    </View>
  );
}
