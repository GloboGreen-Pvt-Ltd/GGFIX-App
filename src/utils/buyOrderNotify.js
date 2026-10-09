import { openChat, sendChatMessage, getProduct } from '../api/marketplace';
import { listAddresses } from '../api/customer';
import { addressLine } from '../components/AddressPick';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const capped = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

/**
 * After a Buy checkout, message each seller in shop chat (the Partner app's
 * chat inbox) with the order, the buyer's name / phone and the delivery
 * address, so the shop can confirm and arrange delivery. Uses only the
 * existing chat endpoints. Best-effort: never throws, gives up after `ms`,
 * and resolves to the names of the shops that received the message.
 *
 * cartItems: GET /cart rows ({ productId, quantity, product: { id, title, price, shopId, shopName } }).
 */
export async function notifyShopsOfBuyOrder({ order, cartItems, buyer, ms = 8000 }) {
  const run = async () => {
    // Group cart lines by seller shop (fall back to the product for its shopId).
    const groups = new Map();
    for (const it of cartItems || []) {
      const pid = it.product?.id || it.productId;
      let shopId = it.product?.shopId;
      let shopName = it.product?.shopName;
      if (!shopId && pid) {
        const prod = await getProduct(pid).catch(() => null);
        shopId = prod?.shopId;
        shopName = shopName || prod?.shopName;
      }
      if (!shopId) continue;
      if (!groups.has(shopId)) groups.set(shopId, { shopName, lines: [] });
      groups.get(shopId).lines.push(it);
    }
    if (!groups.size) return [];

    const addresses = await listAddresses().catch(() => []);
    const addr = (addresses || []).find((a) => a.isDefault) || (addresses || [])[0] || null;
    const name = buyer?.fullName || addr?.fullName || '';
    const phone = buyer?.mobile || addr?.mobile || '';
    const orderNo = order?.orderNumber ? `#${String(order.orderNumber).replace(/^#+/, '')}` : '';

    const sent = await Promise.allSettled([...groups.entries()].map(async ([shopId, g]) => {
      const total = g.lines.reduce((s, it) => s + (Number(it.product?.price) || 0) * (it.quantity || 1), 0);
      const body = [
        `🛒 New order ${orderNo}`.trim(),
        ...g.lines.map((it) => `• ${it.product?.title || 'Product'} × ${it.quantity || 1} — ${inr((Number(it.product?.price) || 0) * (it.quantity || 1))}`),
        `Total: ${inr(total)}`,
        '',
        name ? `Buyer: ${name}` : null,
        phone ? `Phone: ${phone}` : null,
        addr ? `Address: ${addressLine(addr)}` : null,
        '',
        'Please confirm availability and delivery.',
      ].filter((l) => l !== null).join('\n');
      const thread = await openChat(shopId);
      if (!thread?.id) throw new Error('no thread');
      await sendChatMessage(thread.id, body);
      return g.shopName || 'the seller';
    }));
    return sent.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  };
  return (await capped(run().catch(() => []), ms)) || [];
}
