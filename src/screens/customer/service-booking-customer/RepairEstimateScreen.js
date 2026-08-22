import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import {
  Smartphone, FileText, Clock, ShieldCheck, Receipt, Check, X, IndianRupee,
} from 'lucide-react-native';
import {
  AppHeader, Card, StatusChip, BottomActionBar, ScreenContainer, Loader, ErrorState,
  EmptyState, useBottomBarInset, PriceRow, PriceDivider, Button,
} from '../../../components/rnr';
import { tokens } from '../../../theme/colors';
import { getRepairBooking } from '../../../api/orders';
import { ticketApi } from '../../../api/client';
import { rf } from '../../../utils/responsive';

function formatINR(amount) {
  if (amount == null) return '0';
  try { return Number(amount).toLocaleString('en-IN'); } catch (_) { return String(amount); }
}

/**
 * RepairEstimateScreen — customer-facing estimate review. After the pickup
 * person picks up the device, the shop submits a repair estimate (parts +
 * labour + ETA). The customer approves or rejects it here.
 *
 * Route params: { bookingId }
 */
export default function RepairEstimateScreen({ navigation, route }) {
  const { bookingId } = route.params || {};
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null); // 'APPROVE' | 'REJECT' | null
  const insetBottom = useBottomBarInset();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const b = await getRepairBooking(bookingId);
      setBooking(b);
    } catch (e) {
      setError(e?.message || 'Failed to load estimate');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader label="Loading estimate..." />;
  if (error) {
    return (
      <ScreenContainer>
        <AppHeader title="Repair Estimate" onBack={() => navigation.goBack()} />
        <ErrorState description={error} onRetry={() => load()} />
      </ScreenContainer>
    );
  }
  if (!booking) {
    return (
      <ScreenContainer>
        <AppHeader title="Repair Estimate" onBack={() => navigation.goBack()} />
        <EmptyState title="No booking found" description="Open this from your orders list." />
      </ScreenContainer>
    );
  }

  const estimate = booking.estimate || booking;
  const lineItems = estimate.items || estimate.priceItems || [];
  const partsTotal = lineItems.reduce((sum, i) => sum + Number(i.amount || i.price || 0), 0);
  const labour = Number(estimate.labourCharge || 0);
  const discount = Number(estimate.discount || 0);
  const total = Number(estimate.estimatedPrice ?? estimate.totalAmount ?? (partsTotal + labour - discount));
  const eta = estimate.estimatedDeliveryAt || estimate.estimatedAt;
  const status = booking.estimateStatus || booking.status;
  const canDecide = String(status || '').toUpperCase().includes('ESTIMATE')
    || String(status || '').toUpperCase().includes('PENDING_APPROVAL');

  const respond = async (action) => {
    setActing(action);
    try {
      await ticketApi.post(`/repair-bookings/${bookingId}/estimate/${action.toLowerCase()}`);
      await load();
    } catch (e) {
      setError(e?.message || `Failed to ${action.toLowerCase()} estimate`);
    } finally {
      setActing(null);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title="Repair Estimate" subtitle={`#${booking.bookingNumber || bookingId?.slice?.(0, 8)}`} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insetBottom + (canDecide ? 110 : 24) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.primary} />}
      >
        <Card>
          <View className="flex-row items-center">
            <View className="h-12 w-12 rounded-2xl bg-primary-soft items-center justify-center mr-3">
              <Smartphone size={22} color={tokens.primary} />
            </View>
            <View className="flex-1">
              <Text className="font-extrabold text-text" style={{ fontSize: rf(15) }} numberOfLines={1}>{booking.modelName || 'Device'}</Text>
              <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11) }} numberOfLines={1}>
                {[booking.brandName, booking.color, booking.storageLabel].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <StatusChip status={status} size="sm" />
          </View>
        </Card>

        <View className="h-3" />
        <Card>
          <View className="flex-row items-center mb-2">
            <FileText size={16} color={tokens.primary} />
            <Text className="ml-2 font-extrabold text-text" style={{ fontSize: rf(14) }}>Price Breakdown</Text>
          </View>
          {lineItems.length === 0 ? (
            <Text className="text-text-muted" style={{ fontSize: rf(12) }}>No itemized parts. Total estimate shown below.</Text>
          ) : (
            lineItems.map((item, idx) => (
              <PriceRow
                key={item.id || idx}
                label={item.label || item.serviceName || item.name || `Item ${idx + 1}`}
                value={`₹${formatINR(item.amount ?? item.price)}`}
              />
            ))
          )}
          {labour > 0 ? <PriceRow label="Labour" value={`₹${formatINR(labour)}`} /> : null}
          {discount > 0 ? <PriceRow label="Discount" value={`- ₹${formatINR(discount)}`} /> : null}
          <PriceDivider />
          <View className="flex-row items-center justify-between">
            <Text className="font-extrabold text-text" style={{ fontSize: rf(14) }}>Estimated Total</Text>
            <View className="flex-row items-center">
              <IndianRupee size={16} color={tokens.primary} />
              <Text className="font-extrabold text-primary" style={{ fontSize: rf(20) }}>{formatINR(total)}</Text>
            </View>
          </View>
        </Card>

        {(eta || estimate.complaint || booking.issueSummary) ? (
          <>
            <View className="h-3" />
            <Card>
              {eta ? (
                <View className="flex-row items-start mb-3">
                  <View className="h-8 w-8 rounded-full bg-accent-soft items-center justify-center mr-3">
                    <Clock size={14} color={tokens.accent} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-extrabold text-text" style={{ fontSize: rf(12) }}>Expected Delivery</Text>
                    <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(12) }}>
                      {new Date(eta).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </Text>
                  </View>
                </View>
              ) : null}
              {(estimate.complaint || booking.issueSummary) ? (
                <View className="flex-row items-start">
                  <View className="h-8 w-8 rounded-full bg-primary-soft items-center justify-center mr-3">
                    <FileText size={14} color={tokens.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-extrabold text-text" style={{ fontSize: rf(12) }}>Complaint</Text>
                    <Text className="text-text-muted mt-0.5 leading-5" style={{ fontSize: rf(12) }}>
                      {estimate.complaint || booking.issueSummary}
                    </Text>
                  </View>
                </View>
              ) : null}
            </Card>
          </>
        ) : null}

        <View className="h-3" />
        <Card className="bg-primary-soft border-primary">
          <View className="flex-row items-start">
            <ShieldCheck size={16} color={tokens.primary} />
            <View className="ml-2 flex-1">
              <Text className="font-extrabold text-primary-dark" style={{ fontSize: rf(12.5) }}>Warranty included</Text>
              <Text className="text-text-muted mt-0.5 leading-4" style={{ fontSize: rf(11) }}>
                30-day repair warranty on parts replaced by the shop.
              </Text>
            </View>
          </View>
        </Card>

        {!canDecide ? (
          <View className="mt-4 items-center">
            <Receipt size={28} color={tokens.textMuted} />
            <Text className="text-text-muted text-center mt-2 px-6" style={{ fontSize: rf(12) }}>
              You've already responded to this estimate. Status will update as the repair progresses.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {canDecide ? (
        <View
          className="absolute left-0 right-0 bottom-0 bg-card border-t border-border px-4 pt-3"
          style={{ paddingBottom: insetBottom, shadowColor: '#0F172A', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: -6 }, elevation: 14 }}
        >
          <View className="flex-row">
            <View className="flex-1 mr-2">
              <Button
                variant="outline"
                onPress={() => respond('REJECT')}
                loading={acting === 'REJECT'}
                disabled={!!acting}
                leftIcon={<X size={16} color={tokens.danger} />}
                textClassName="text-danger"
                className="border-danger"
              >
                Reject
              </Button>
            </View>
            <View className="flex-1 ml-2">
              <Button
                variant="primary"
                onPress={() => respond('APPROVE')}
                loading={acting === 'APPROVE'}
                disabled={!!acting}
                leftIcon={<Check size={16} color="#fff" />}
              >
                Approve ₹{formatINR(total)}
              </Button>
            </View>
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}
