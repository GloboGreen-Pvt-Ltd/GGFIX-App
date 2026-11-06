import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fulfilmentOf } from '../../../api/buyOrders';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Loader } from '../../../components/ui';
import { notify } from '../../../components/confirm';
import { getProduct, addToCart } from '../../../api/marketplace';
import { getShop } from '../../../api/shops';
import { useCustomerLocation } from '../../../hooks/useCustomerLocation';
import { rf } from '../../../utils/responsive';
import { StaticTabBar } from '../../../navigation/CustomTabBar';
import { BRAND } from '../../../theme/brand';

// Brand palette (035C6C · 111111 · F3F4F6 · F3F4F6 · FAA700 · F32C26).
const GREEN_TEXT = '#035C6C'; // #035C6C shaded for text on white
const LINE = '#E8EAEE';
const MINT = '#E5F3F5';
const YELLOW_SOFT = '#FFF4D6';
const RED_SOFT = '#FEEBEA';
const MUTED = '#606E87';
const cardShadow = { shadowColor: BRAND.ink, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  hero: { backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderBottomColor: LINE, borderBottomWidth: 1 },
  heroImage: { width: '100%', height: '100%' },
  thumbsBar: { flexGrow: 0, backgroundColor: '#FFFFFF', borderBottomColor: LINE, borderBottomWidth: 1 },
  thumbsRow: { paddingHorizontal: 12, paddingVertical: 8 },
  thumb: { borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: '#F4F2FA', overflow: 'hidden' },
  thumbActive: { borderColor: BRAND.green, borderWidth: 2 },
  thumbImage: { width: '100%', height: '100%' },
  body: { padding: 14 },
  title: { fontSize: rf(17), fontWeight: '800', color: BRAND.ink },
  priceLabel: { fontSize: rf(11), color: MUTED, fontWeight: '600' },
  price: { fontSize: rf(22), fontWeight: '800', color: '#01AC77' },
  heroBox: { flex: 1, borderRadius: 16, backgroundColor: '#F4F2FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  condChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#E3F6EE' },
  condText: { fontSize: rf(12), fontWeight: '800', color: '#01805A' },
  box: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF', padding: 12, ...cardShadow },
  boxHead: { fontSize: rf(14), fontWeight: '800', color: BRAND.ink, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  detailLabel: { flex: 1, marginLeft: 8, fontSize: rf(12.5), color: MUTED },
  detailVal: { fontSize: rf(12.5), fontWeight: '800', color: BRAND.ink, textAlign: 'right', maxWidth: '55%' },
  avatar: { height: 44, width: 44, borderRadius: 22, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center' },
  benefit: { flex: 1, minHeight: 74, borderRadius: 12, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: '#FFFFFF' },
  benefitText: { marginTop: 5, fontSize: rf(11), fontWeight: '700', color: BRAND.ink, textAlign: 'center' },
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
  const { width, height: winH } = useWindowDimensions();
  const { productId } = route.params || {};
  const [p, setP] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const [activeImage, setActiveImage] = useState(null);
  const [viewer, setViewer] = useState(null); // full-screen photo index
  const [heroW, setHeroW] = useState(0);
  const heroRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prod = await getProduct(productId);
        if (cancelled) return;
        setP(prod);
        setActiveImage(prod?.imageUrl || (prod?.extraImageUrls && prod.extraImageUrls[0]) || null);
      } catch (_) {
        // leave p null -> show "Not found"
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  // Seller shop — with distance once the customer's location is known.
  const { lat, lng } = useCustomerLocation();
  useEffect(() => {
    if (!p?.shopId) return undefined;
    let off = false;
    getShop(p.shopId, lat != null && lng != null ? { lat, lng } : {}).then((sh) => { if (!off && sh) setShop(sh); }).catch(() => {});
    return () => { off = true; };
  }, [p?.shopId, lat, lng]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Notifications" style={{ padding: 6 }}>
          <Ionicons name="notifications-outline" size={22} color={BRAND.ink} />
        </Pressable>
      ),
    });
  }, [navigation]);

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

  // Buy Now: straight to Place Order with just this product (the cart is untouched).
  const buyNow = () => {
    navigation.navigate('BuyPlaceOrder', { items: [{ product: { ...p, id: p.id || productId, shopName: shop?.name || p.shopName }, quantity: 1 }] });
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
  const activeIdx = Math.max(0, gallery.indexOf(activeImage));
  // Device Details rows and Key Benefits — only what the listing carries.
  const DETAILS = [
    { icon: 'save-outline', label: 'Storage', value: p.storageLabel },
    { icon: 'hardware-chip-outline', label: 'RAM', value: p.ramLabel },
    { icon: 'color-palette-outline', label: 'Color', value: p.color },
    { icon: 'cellular-outline', label: 'Network', value: p.network },
    { icon: 'shield-checkmark-outline', label: 'Condition', value: p.conditionLabel },
    { icon: 'layers-outline', label: 'Stock', value: p.quantity == null ? null : (Number(p.quantity) - Number(p.soldQuantity || 0) > 0 ? `${Number(p.quantity) - Number(p.soldQuantity || 0)} available` : 'Out of stock') },
    { icon: 'bicycle-outline', label: 'Delivery', value: (() => { const f = fulfilmentOf(p); return [f.home && 'Home delivery', f.shop && 'Visit shop'].filter(Boolean).join(' · ') || null; })() },
  ].filter((d) => d.value);
  const BENEFITS = [
    assessment.screeningAnswers?.length ? { icon: 'clipboard-outline', label: 'Condition\nReport' } : null,
    assessment.warrantyLabel && !/no warranty/i.test(assessment.warrantyLabel) ? { icon: 'ribbon-outline', label: 'Warranty\nAvailable' } : null,
    assessment.accessories?.length ? { icon: 'cube-outline', label: `${assessment.accessories.length} Accessor${assessment.accessories.length === 1 ? 'y' : 'ies'}` } : null,
  ].filter(Boolean);
  const rating = Number(shop?.rating) > 0 ? Number(shop.rating) : null;
  const distance = shop?.distanceKm != null ? `${Number(shop.distanceKm).toFixed(1)} km away` : null;
  const priced = Number(p.price) > 0;
  const thumbW = Math.round(heroH / 3.4);

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={[styles.body, { width: '100%', maxWidth: 640, alignSelf: 'center' }]}>
          {/* Gallery — large photo (tap for full screen) + thumbnail column */}
          <View style={{ flexDirection: 'row', gap: 8, height: heroH }}>
            {/* Swipe between photos; tap one for full screen. */}
            <View style={styles.heroBox} onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}>
              {gallery.length && heroW ? (
                <ScrollView
                  ref={heroRef}
                  horizontal
                  pagingEnabled
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / heroW); if (gallery[i]) setActiveImage(gallery[i]); }}
                >
                  {gallery.map((uri, i) => (
                    <Pressable key={uri} onPress={() => setViewer(i)} style={{ width: heroW, height: heroH }} accessibilityRole="imagebutton" accessibilityLabel="View photo full screen">
                      <Image source={{ uri }} style={styles.heroImage} resizeMode="contain" />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Ionicons name="phone-portrait" size={46} color={GREEN_TEXT} />
              )}
              {gallery.length > 1 ? (
                <View style={{ position: 'absolute', right: 10, bottom: 10, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(17,17,17,0.6)' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: rf(11), fontWeight: '700' }}>{activeIdx + 1}/{gallery.length}</Text>
                </View>
              ) : null}
            </View>
            {gallery.length > 1 ? (
              <ScrollView style={{ width: thumbW, flexGrow: 0 }} nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {gallery.map((uri, i) => (
                  <Pressable key={uri} onPress={() => { setActiveImage(uri); heroRef.current?.scrollTo({ x: i * heroW, animated: true }); }} style={[styles.thumb, { width: thumbW, height: thumbW }, uri === activeImage && styles.thumbActive]} accessibilityRole="imagebutton">
                    <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <Text style={[styles.title, { marginTop: 12 }]}>{p.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Text style={[styles.price, { flex: 1 }]}>{priced ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Price on request'}</Text>
            {p.conditionLabel ? (
              <View style={styles.condChip}><Text style={styles.condText}>{p.conditionLabel}</Text></View>
            ) : null}
          </View>

          {DETAILS.length ? (
            <View style={styles.box}>
              <Text style={styles.boxHead}>Device Details</Text>
              {DETAILS.map((d) => (
                <View key={d.label} style={styles.detailRow}>
                  <Ionicons name={d.icon} size={16} color={MUTED} />
                  <Text style={styles.detailLabel}>{d.label}</Text>
                  <Text style={styles.detailVal} numberOfLines={2}>{d.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.box}>
            <Text style={styles.boxHead}>Seller Details</Text>
            {shopName ? (
              <Pressable onPress={() => p.shopId && navigation.navigate('ShopDetails', { shopId: p.shopId })} style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={`Open ${shopName}`}>
                <View style={styles.avatar}><Ionicons name="storefront" size={20} color={GREEN_TEXT} /></View>
                <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                  <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
                  {rating ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Ionicons name="star" size={12} color={BRAND.yellow} />
                      <Text style={{ marginLeft: 3, fontSize: rf(12), fontWeight: '700', color: BRAND.ink }}>{rating.toFixed(1)}</Text>
                    </View>
                  ) : null}
                  {distance || shopCity ? <Text style={styles.shopMuted} numberOfLines={1}>{[distance, shopCity].filter(Boolean).join('  ·  ')}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={MUTED} />
              </Pressable>
            ) : (
              <Text style={styles.shopMuted}>Shop details not available.</Text>
            )}
            {shopAddress ? (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Ionicons name="location-outline" size={14} color={BRAND.red} style={{ marginTop: 1, marginRight: 5 }} />
                <Text style={[styles.shopLine, { flex: 1 }]}>{shopAddress}</Text>
              </View>
            ) : null}
            {shopPhone ? (
              <View style={{ flexDirection: 'row', marginTop: 5, alignItems: 'center' }}>
                <Ionicons name="call-outline" size={14} color={GREEN_TEXT} style={{ marginRight: 5 }} />
                <Text style={styles.shopLine}>{shopPhone}</Text>
              </View>
            ) : null}
          </View>

          {BENEFITS.length ? (
            <>
              <Text style={[styles.boxHead, { marginTop: 14 }]}>Key Benefits</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {BENEFITS.map((b) => (
                  <View key={b.label} style={styles.benefit}>
                    <Ionicons name={b.icon} size={20} color={GREEN_TEXT} />
                    <Text style={styles.benefitText}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

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
      <View style={[styles.bottom, { paddingBottom: 10 }]}>
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
      <StaticTabBar navigation={navigation} active="Buy" />

      {/* Full-screen photos — swipe between the listing's images. */}
      <Modal visible={viewer != null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.96)' }}>
          <ScrollView
            ref={viewerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewer || 0) * width, y: 0 }}
            onLayout={() => viewerRef.current?.scrollTo({ x: (viewer || 0) * width, animated: false })}
          >
            {gallery.map((uri) => (
              <View key={uri} style={{ width, height: winH, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={{ uri }} style={{ width: width - 24, height: winH * 0.72 }} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          <Pressable onPress={() => setViewer(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close photo" style={{ position: 'absolute', top: insets.top + 12, right: 16, height: 42, width: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
