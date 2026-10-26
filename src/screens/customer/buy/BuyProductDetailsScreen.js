import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Loader } from '../../../components/ui';
import { notify } from '../../../components/confirm';
import { getProduct, addToCart, getCart } from '../../../api/marketplace';
import { getShop } from '../../../api/shops';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

// Brand palette (09AD2A · 1E1E1E · F8F8F8 · F3F3F3 · F3BF23 · F84141).
const GREEN_TEXT = '#078F23'; // #09AD2A shaded for text on white
const LINE = '#E6E6E6';
const MINT = '#EAF8EC';
const YELLOW_SOFT = '#FEF6DA';
const RED_SOFT = '#FEECEC';
const MUTED = '#6B6B6B';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  hero: { backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderBottomColor: LINE, borderBottomWidth: 1 },
  heroImage: { width: '100%', height: '100%' },
  thumbsBar: { flexGrow: 0, backgroundColor: '#FFFFFF', borderBottomColor: LINE, borderBottomWidth: 1 },
  thumbsRow: { paddingHorizontal: 12, paddingVertical: 8 },
  thumb: { width: 52, height: 52, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  thumbActive: { borderColor: BRAND.green, borderWidth: 2 },
  thumbImage: { width: '100%', height: '100%' },
  body: { padding: 14 },
  title: { fontSize: rf(17), fontWeight: '800', color: BRAND.ink },
  priceLabel: { fontSize: rf(11), color: MUTED, fontWeight: '600' },
  price: { fontSize: rf(20), fontWeight: '800', color: GREEN_TEXT },
  card: { borderRadius: 16, borderColor: LINE, padding: 12, marginVertical: 0, marginTop: 10, ...cardShadow },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardHeadIcon: { height: 30, width: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  cardHead: { fontSize: rf(14), fontWeight: '800', color: BRAND.ink },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  spec: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: BRAND.line, backgroundColor: BRAND.bg, paddingVertical: 8, paddingHorizontal: 9, marginBottom: 8 },
  specIcon: { height: 28, width: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  specLabel: { fontSize: rf(10), color: MUTED, fontWeight: '600' },
  specVal: { fontSize: rf(12.5), color: BRAND.ink, fontWeight: '800', marginTop: 1 },
  shopName: { fontSize: rf(14), fontWeight: '800', color: BRAND.ink },
  shopLine: { fontSize: rf(12), color: BRAND.body, lineHeight: rf(17) },
  shopMuted: { fontSize: rf(11.5), color: MUTED, marginTop: 3 },
  bottom: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopColor: LINE, borderTopWidth: 1 },

  // Device Summary block — mirrors the owner-side MarketplaceListingDetailsScreen.
  summarySection: { color: BRAND.ink, fontWeight: '800', fontSize: rf(12), marginTop: 8, marginBottom: 2 },
  summaryItem: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  summaryItemText: { color: BRAND.body, fontSize: rf(12), marginLeft: 6, flex: 1, lineHeight: rf(16) },
  descTypeLabel: { color: MUTED, fontSize: rf(10), fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  descTypeValue: { color: BRAND.ink, fontSize: rf(13), fontWeight: '700', marginTop: 3 },
});

function DESCRIPTION_TYPE_LABEL(code) {
  if (code === 'DETAILED') return 'Detailed Description';
  if (code === 'SHORT') return 'Short Description';
  if (code === 'DEAD_SHORT') return 'Dead Phone Short Description';
  if (code === 'SPARE_PARTS') return 'Spare Parts Listing';
  return code;
}

function Check() {
  return <Ionicons name="checkmark-circle" size={14} color={BRAND.green} style={{ marginTop: 1 }} />;
}

function CardHead({ icon, title, tint = MINT, color = GREEN_TEXT }) {
  return (
    <View style={styles.cardHeadRow}>
      <View style={[styles.cardHeadIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={styles.cardHead}>{title}</Text>
    </View>
  );
}

export default function BuyProductDetailsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { productId } = route.params || {};
  const [p, setP] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
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

  // Buy Now: put this product in the cart (if it isn't already), then open
  // My Cart to check out.
  const buyNow = async () => {
    if (buying) return;
    setBuying(true);
    try {
      await addToCart(productId, 1);
    } catch (e) {
      const cart = await getCart().catch(() => null);
      const rows = Array.isArray(cart) ? cart : (cart?.items || []);
      if (!rows.some((it) => (it.product?.id || it.productId) === productId)) {
        notify('Error', e.message || 'Could not add to cart');
        setBuying(false);
        return;
      }
    }
    setBuying(false);
    navigation.navigate('MyCart');
  };

  if (loading) return <Loader />;
  if (!p) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <View style={{ height: 56, width: 56, borderRadius: 28, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Ionicons name="phone-portrait-outline" size={24} color={GREEN_TEXT} />
        </View>
        <Text style={{ fontSize: rf(13.5), color: MUTED }}>Not found</Text>
      </View>
    );
  }

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

  // ---- presentation-only values ----
  const heroH = Math.round(Math.max(200, Math.min(300, width * 0.62)));
  const specW = Math.floor((Math.min(width, 640) - 28 - 24 - 8) / 2); // screen − body pad − card pad − gap
  const SPECS = [
    { icon: 'phone-portrait-outline', label: 'Condition', value: p.conditionLabel || 'Good', tint: MINT, color: GREEN_TEXT },
    { icon: 'save-outline', label: 'Storage', value: p.storageLabel || '-', tint: YELLOW_SOFT, color: BRAND.yellow },
    { icon: 'color-palette-outline', label: 'Color', value: p.color || '-', tint: RED_SOFT, color: BRAND.red },
    { icon: 'cellular-outline', label: 'Network', value: p.network || '-', tint: BRAND.line, color: BRAND.ink },
  ];

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={[styles.hero, { height: heroH }]}>
          {activeImage ? (
            <Image source={{ uri: activeImage }} style={styles.heroImage} resizeMode="contain" />
          ) : (
            <View style={{ height: 96, width: 96, borderRadius: 48, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="phone-portrait" size={46} color={GREEN_TEXT} />
            </View>
          )}
        </View>

        {gallery.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbsBar} contentContainerStyle={styles.thumbsRow}>
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

        <View style={[styles.body, { width: '100%', maxWidth: 640, alignSelf: 'center' }]}>
          <Text style={styles.title}>{p.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.priceLabel}>Price</Text>
              <Text style={styles.price}>₹{Number(p.price).toLocaleString()}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: MINT }}>
              <Ionicons name="shield-checkmark" size={12} color={GREEN_TEXT} />
              <Text style={{ marginLeft: 4, fontSize: rf(10.5), fontWeight: '800', color: GREEN_TEXT }}>{p.conditionLabel || 'Good'}</Text>
            </View>
          </View>

          <Card style={styles.card}>
            <View style={styles.specGrid}>
              {SPECS.map((s) => (
                <View key={s.label} style={[styles.spec, { width: specW }]}>
                  <View style={[styles.specIcon, { backgroundColor: s.tint }]}>
                    <Ionicons name={s.icon} size={14} color={s.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.specLabel}>{s.label}</Text>
                    <Text style={styles.specVal} numberOfLines={1}>{s.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          <Card style={styles.card}>
            <CardHead icon="storefront-outline" title="Shop Information" />
            {shopName ? (
              <Text style={styles.shopName}>{shopName}</Text>
            ) : (
              <Text style={styles.shopMuted}>Shop details not available.</Text>
            )}
            {shopAddress ? (
              <View style={{ flexDirection: 'row', marginTop: 5 }}>
                <Ionicons name="location-outline" size={14} color={BRAND.red} style={{ marginTop: 1, marginRight: 5 }} />
                <Text style={[styles.shopLine, { flex: 1 }]}>{shopAddress}</Text>
              </View>
            ) : null}
            {shopCity ? (
              <Text style={styles.shopMuted}>{shopCity}</Text>
            ) : null}
            {shopPhone ? (
              <View style={{ flexDirection: 'row', marginTop: 5, alignItems: 'center' }}>
                <Ionicons name="call-outline" size={14} color={GREEN_TEXT} style={{ marginRight: 5 }} />
                <Text style={styles.shopLine}>{shopPhone}</Text>
              </View>
            ) : null}
          </Card>

          {hasSummary ? (
            <Card style={styles.card}>
              <CardHead icon="clipboard-outline" title="Device Summary" tint={YELLOW_SOFT} color={BRAND.yellow} />

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
            <Card style={styles.card}>
              <CardHead icon="document-text-outline" title="Description" tint={BRAND.line} color={BRAND.ink} />
              <Text style={styles.shopLine}>{p.description}</Text>
            </Card>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}>
        <View style={{ flexDirection: 'row' }}>
          <Pressable
            onPress={add}
            disabled={adding || buying}
            accessibilityRole="button"
            accessibilityLabel="Add to cart"
            className="active:opacity-80"
            style={{ flex: 1, height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: BRAND.green, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
          >
            {adding ? <ActivityIndicator color={BRAND.green} /> : (
              <>
                <Ionicons name="cart-outline" size={18} color={BRAND.green} />
                <Text style={{ marginLeft: 6, fontSize: rf(14), fontWeight: '800', color: BRAND.green }}>Add to Cart</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={buyNow}
            disabled={adding || buying}
            accessibilityRole="button"
            accessibilityLabel="Buy now"
            className="active:opacity-85"
            style={{ flex: 1, height: 50, borderRadius: 16, backgroundColor: BRAND.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: BRAND.green, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}
          >
            {buying ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <Ionicons name="flash" size={17} color="#FFFFFF" />
                <Text style={{ marginLeft: 6, fontSize: rf(14), fontWeight: '800', color: '#FFFFFF' }}>Buy Now</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
