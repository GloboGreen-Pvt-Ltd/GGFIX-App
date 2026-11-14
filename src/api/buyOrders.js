import { marketplaceApi } from './client';

// Fixed-price Buy orders (marketplace-service /customer/buy-orders). The server
// prices the order, reserves stock and is idempotent per idempotencyKey.

export const BUY_STATUS_LABEL = {
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed by shop',
  ASSIGNED: 'Pickup person assigned',
  ACCEPTED: 'Pickup person on the way',
  PICKED_UP: 'Picked up from shop',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  DELIVERY_FAILED: 'Delivery attempt failed',
  RETURNED: 'Cancelled · Returned to shop',
  REJECTED: 'Rejected by shop',
  CANCELLED: 'Cancelled',
};

// The OTP is only needed while the hand-over can still happen.
export const OTP_STATUSES = ['CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'];
export const CANCELLABLE = ['PLACED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED'];

export const placeBuyOrder = (body) => marketplaceApi.post('/customer/buy-orders', { body });
export const listBuyOrders = () => marketplaceApi.get('/customer/buy-orders');
export const getBuyOrder = (id) => marketplaceApi.get(`/customer/buy-orders/${id}`);
export const cancelBuyOrder = (id) => marketplaceApi.post(`/customer/buy-orders/${id}/cancel`, { body: {} });

// Fulfilment the listing allows: SHIPPING → home delivery, PICKUP → visit shop.
// A listing with no options set is treated as visit-shop only.
export function fulfilmentOf(product) {
  const raw = product?.fulfilmentOptions;
  const opts = (Array.isArray(raw) ? raw : String(raw || '').split(',')).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  return { home: opts.includes('SHIPPING'), shop: !opts.length || opts.includes('PICKUP') };
}

// Row shape My Orders already renders (payload.items, status text, totalAmount).
export function toMyOrdersRow(o) {
  return {
    id: o.id,
    _fixed: true,
    orderNumber: o.orderNumber,
    orderType: 'BUY',
    shopId: o.shopId,
    status: BUY_STATUS_LABEL[o.status] || o.status,
    totalAmount: o.totalAmount,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    payload: {
      title: o.productTitle,
      shopId: o.shopId,
      items: [{ productId: o.productId, title: o.productTitle, price: o.unitPrice, quantity: o.quantity }],
    },
  };
}
