import { marketplaceApi } from './client';

function unwrap(list) {
  return Array.isArray(list) ? list : (list?.content ?? list?.data ?? []);
}

// Products (public browse)
export async function listProducts({ type, status = 'ACTIVE', modelId, q } = {}) {
  return unwrap(await marketplaceApi.get('/marketplace/products', { query: { type, status, modelId, q } }));
}
export async function getProduct(id) {
  return await marketplaceApi.get(`/marketplace/products/${id}`);
}

// Buy/Sell board (peer marketplace listings)
export async function createListing(payload) {
  return await marketplaceApi.post('/marketplace/listings', { body: payload });
}

// Cart
export async function getCart() {
  return unwrap(await marketplaceApi.get('/customer/cart'));
}
export async function addToCart(productId, quantity = 1) {
  return await marketplaceApi.post('/customer/cart', { body: { productId, quantity } });
}
export async function updateCartItem(itemId, quantity) {
  return await marketplaceApi.put(`/customer/cart/${itemId}`, { body: { quantity } });
}
export async function removeCartItem(itemId) {
  return await marketplaceApi.del(`/customer/cart/${itemId}`);
}
export async function clearCart() {
  return await marketplaceApi.del('/customer/cart');
}

// Chats — WhatsApp-style customer<->shop messaging. Mirrors the shop app's
// /shop/chats surface in ../../../ggfix-shop-app/src/api/chat.js.
export async function listChats() {
  return unwrap(await marketplaceApi.get('/customer/chats'));
}
export async function openChat(shopId) {
  return await marketplaceApi.post('/customer/chats', { query: { shopId } });
}
export async function getChatMessages(threadId) {
  return unwrap(await marketplaceApi.get(`/customer/chats/${threadId}/messages`));
}
// Backwards-compatible: existing call sites passing (threadId, body, attachmentUrl)
// keep working; new sites can pass (threadId, { body, attachmentUrl, attachmentType }).
export async function sendChatMessage(threadId, bodyOrPayload, attachmentUrl) {
  const payload = typeof bodyOrPayload === 'string'
    ? { body: bodyOrPayload, attachmentUrl }
    : (bodyOrPayload || {});
  return await marketplaceApi.post(`/customer/chats/${threadId}/messages`, { body: payload });
}
export async function markChatRead(threadId) {
  return await marketplaceApi.post(`/customer/chats/${threadId}/read`, { body: {} });
}
export async function pingChatTyping(threadId, typing) {
  return await marketplaceApi.post(`/customer/chats/${threadId}/typing`, { body: { typing: !!typing } });
}
export async function pingChatPresence() {
  return await marketplaceApi.post('/customer/chats/presence', { body: {} });
}
