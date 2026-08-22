import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../theme/colors';
import { Card, Loader, PrimaryButton } from '../../../components/ui';
import { notify } from '../../../components/confirm';
import { getProduct, addToCart } from '../../../api/marketplace';
import { getShop } from '../../../api/shops';
import { rf } from '../../../utils/responsive';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { height: 240, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1 },
  heroImage: { width: '100%', height: '100%' },
  thumbsRow: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomColor: colors.border, borderBottomWidth: 1 },
  thumb: { width: 56, height: 56, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  thumbActive: { borderColor: '#00008B', borderWidth: 2 },
  thumbImage: { width: '100%', height: '100%' },
  body: { padding: 12 },
  title: { fontSize: rf(18), fontWeight: '700', color: colors.text },
  price: { fontSize: rf(16), fontWeight: '700', color: '#004C40' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  iconWrap: { width: 30 },
  rowLabel: { width: 100, color: colors.textSecondary },
  rowVal: { flex: 1, color: colors.text, fontWeight: '600' },
  shopHeading: { color: '#2563EB', fontWeight: '700', fontSize: rf(13) },
  shopName: { fontSize: rf(14), fontWeight: '700', color: colors.text, marginTop: 6 },
  shopLine: { fontSize: rf(13), color: colors.text, marginTop: 4 },
  shopMuted: { fontSize: rf(12), color: colors.textSecondary, marginTop: 4 },
  bottom: { padding: 12, backgroundColor: '#fff', borderTopColor: colors.border, borderTopWidth: 1 },

  // Device Summary block — mirrors the owner-side MarketplaceListingDetailsScreen.
  summaryHeading: { color: '#2563EB', fontWeight: '800', fontSize: rf(14) },
  summarySection: { color: colors.text, fontWeight: '700', fontSize: rf(12), marginTop: 10, marginBottom: 2 },
  summaryItem: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  summaryItemText: { color: colors.text, fontSize: rf(12), marginLeft: 6, flex: 1 },
  descTypeLabel: { color: colors.textSecondary, fontSize: rf(10), fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  descTypeValue: { color: colors.text, fontSize: rf(13), fontWeight: '700', marginTop: 3 },
});

function DESCRIPTION_TYPE_LABEL(code) {
  if (code === 'DETAILED') return 'Detailed Description';
  if (code === 'SHORT') return 'Short Description';
  if (code === 'DEAD_SHORT') return 'Dead Phone Short Description';
  if (code === 'SPARE_PARTS') return 'Spare Parts Listing';
  return code;
}

function Check() {
  return <Ionicons name="checkmark-circle" size={14} color="#004C40" style={{ marginTop: 1 }} />;
}

export default function BuyProductDetailsScreen({ route }) {
  const insets = useSafeAreaInsets();
  const { productId } = route.params || {};
  const [p, setP] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prod = await getProduct(productId);
        if (cancelled) return;
        setP(prod);
        setActiveImage(prod?.imageUrl || (prod?.extraImageUrls && prod.extraImageUrls[0]) || null);
        if (prod?.shopId) {
          const sh = await getShop(prod.shopId).catch(() => null);
          if (!cancelled) setShop(sh);
        }
      } catch (_) {
        // leave p null -> show "Not found"
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  const gallery = useMemo(() => {
    if (!p) return [];
    const out = [];
    if (p.imageUrl) out.push(p.imageUrl);
    (p.extraImageUrls || []).forEach((u) => { if (u && !out.includes(u)) out.push(u); });
    return out;
  }, [p]);

  const add = async () => {
    setAdding(true);
    try {
      await addToCart(productId, 1);
      notify('Added', 'Added to cart');
    } catch (e) { notify('Error', e.message); }
    finally { setAdding(false); }
  };

  if (loading) return <Loader />;
  if (!p) return <View style={styles.container}><Text style={{ padding: 16 }}>Not found</Text></View>;

  const shopName = shop?.name || p.shopName;
  const shopAddress = shop?.address || p.shopAddress;
  const shopPhone = shop?.phone || shop?.mobile || p.shopPhone;
  const shopCity = shop?.city || shop?.locality;

  // Same shape as the owner side reads — the listing carries the seller's
  // full screening/condition/accessory/warranty answers in a JSON blob.
  let assessment = {};
  try { assessment = p.assessmentJson ? JSON.parse(p.assessmentJson) : {}; } catch (_) {}
  const hasSummary = !!(
    assessment.screeningAnswers?.length ||
    assessment.conditions?.length ||
    assessment.accessories?.length ||
    assessment.warrantyLabel
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.hero}>
          {activeImage ? (
            <Image source={{ uri: activeImage }} style={styles.heroImage} resizeMode="contain" />
          ) : (
            <Ionicons name="phone-portrait" size={120} color="#9CA3AF" />
          )}
        </View>

        {gallery.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbsRow}>
            {gallery.map((uri) => {
              const isActive = uri === activeImage;
              return (
                <Pressable key={uri} onPress={() => setActiveImage(uri)} style={[styles.thumb, isActive && styles.thumbActive]}>
                  <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.body}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.title, { flex: 1 }]}>{p.title}</Text>
            <Text style={styles.price}>Price : ₹{Number(p.price).toLocaleString()}</Text>
          </View>

          <Card>
            <View style={styles.row}><View style={styles.iconWrap}><Ionicons name="phone-portrait-outline" size={18} color={colors.text} /></View><Text style={styles.rowLabel}>Condition:</Text><Text style={styles.rowVal}>{p.conditionLabel || 'Good'}</Text></View>
            <View style={styles.row}><View style={styles.iconWrap}><Ionicons name="save-outline" size={18} color={colors.text} /></View><Text style={styles.rowLabel}>Storage:</Text><Text style={styles.rowVal}>{p.storageLabel || '-'}</Text></View>
            <View style={styles.row}><View style={styles.iconWrap}><Ionicons name="color-palette-outline" size={18} color={colors.text} /></View><Text style={styles.rowLabel}>Color:</Text><Text style={styles.rowVal}>{p.color || '-'}</Text></View>
            <View style={styles.row}><View style={styles.iconWrap}><Ionicons name="cellular-outline" size={18} color={colors.text} /></View><Text style={styles.rowLabel}>Network:</Text><Text style={styles.rowVal}>{p.network || '-'}</Text></View>
          </Card>

          <Card>
            <Text style={styles.shopHeading}>Shop Information</Text>
            {shopName ? (
              <Text style={styles.shopName}>🏬 {shopName}</Text>
            ) : (
              <Text style={styles.shopMuted}>Shop details not available.</Text>
            )}
            {shopAddress ? (
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                <Ionicons name="location-outline" size={16} color={colors.text} style={{ marginTop: 2, marginRight: 4 }} />
                <Text style={[styles.shopLine, { flex: 1 }]}>{shopAddress}</Text>
              </View>
            ) : null}
            {shopCity ? (
              <Text style={styles.shopMuted}>{shopCity}</Text>
            ) : null}
            {shopPhone ? (
              <View style={{ flexDirection: 'row', marginTop: 4, alignItems: 'center' }}>
                <Ionicons name="call-outline" size={16} color={colors.text} style={{ marginRight: 4 }} />
                <Text style={styles.shopLine}>{shopPhone}</Text>
              </View>
            ) : null}
          </Card>

          {hasSummary ? (
            <Card>
              <Text style={styles.summaryHeading}>Device Summary</Text>

              {assessment.screeningAnswers?.length ? (
                <>
                  <Text style={styles.summarySection}>Screening Question</Text>
                  {assessment.screeningAnswers.map((a, i) => (
                    <View key={i} style={styles.summaryItem}>
                      <Check />
                      <Text style={styles.summaryItemText}>
                        {[a.answer, a.question].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              {assessment.conditions?.length ? (
                <>
                  <Text style={styles.summarySection}>Screen</Text>
                  {assessment.conditions.map((c, i) => (
                    <View key={i} style={styles.summaryItem}>
                      <Check />
                      <Text style={styles.summaryItemText}>
                        {[c.optionLabel, c.groupName].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              {assessment.accessories?.length ? (
                <>
                  <Text style={styles.summarySection}>Accessories</Text>
                  {assessment.accessories.map((a, i) => (
                    <View key={i} style={styles.summaryItem}>
                      <Check />
                      <Text style={styles.summaryItemText}>{a.label || a.accessoryCode}</Text>
                    </View>
                  ))}
                </>
              ) : null}

              {assessment.warrantyLabel ? (
                <>
                  <Text style={styles.summarySection}>Warranty</Text>
                  <View style={styles.summaryItem}>
                    <Check />
                    <Text style={styles.summaryItemText}>{assessment.warrantyLabel}</Text>
                  </View>
                </>
              ) : null}
            </Card>
          ) : null}

          {p.description ? (
            <Card>
              <Text style={styles.shopHeading}>Description</Text>
              <Text style={[styles.shopLine, { marginTop: 6 }]}>{p.description}</Text>
            </Card>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <PrimaryButton title="Add to Cart →" onPress={add} loading={adding} />
      </View>
    </View>
  );
}
