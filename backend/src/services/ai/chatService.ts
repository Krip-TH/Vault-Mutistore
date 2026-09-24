import { ApiError } from '../../errors/apiError.js';
import { orderRepository } from '../../repositories/orderRepository.js';
import type { NormalizedProduct } from '../../types/product.js';
import type { OrderSummary } from '../../types/order.js';
import type { ChatMessage, ChatResult } from '../../types/ai.js';
import { generateChatReply } from './geminiClient.js';
import type { ChatTurn } from './geminiClient.js';
import { getCachedProducts } from './productsCache.js';

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_PRODUCTS_IN_CONTEXT = 50;
const MAX_ORDERS_IN_CONTEXT = 15;

export interface ChatServiceDependencies {
  generateReply: (params: { turns: ChatTurn[]; systemInstruction: string }) => Promise<string>;
  getProducts: () => Promise<NormalizedProduct[]>;
  getOrdersForUser: (userId: number) => Promise<OrderSummary[]>;
}

const defaultDependencies: ChatServiceDependencies = {
  generateReply: ({ turns, systemInstruction }) => generateChatReply({ turns, systemInstruction }),
  getProducts: getCachedProducts,
  getOrdersForUser: userId => orderRepository.listNewestForUser(userId),
};

function normalizeMessages(payload: unknown): ChatMessage[] {
  const body = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new ApiError(400, 'INVALID_MESSAGES', 'Provide at least one chat message.');
  }

  const messages: ChatMessage[] = [];
  for (const item of body.messages) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const role = record.role === 'user' || record.role === 'assistant' ? record.role : null;
    const content = typeof record.content === 'string' ? record.content.trim() : '';
    if (!role || !content) continue;
    messages.push({ role, content: content.slice(0, MAX_MESSAGE_LENGTH) });
  }

  if (messages.length === 0) {
    throw new ApiError(400, 'INVALID_MESSAGES', 'Provide at least one valid chat message.');
  }
  return messages.slice(-MAX_MESSAGES);
}

/** Trims each product down to only the fields the assistant needs, to keep the prompt small. */
function toProductContext(products: NormalizedProduct[]) {
  return products.slice(0, MAX_PRODUCTS_IN_CONTEXT).map(product => ({
    id: product.id,
    business: product.business,
    business_name: product.business_name,
    name: product.name,
    category: product.category,
    price: product.price,
    stock: product.stock,
    status: product.status,
  }));
}

function toOrderContext(orders: OrderSummary[]) {
  return orders.slice(0, MAX_ORDERS_IN_CONTEXT).map(order => ({
    order_no: order.order_no,
    status: order.status,
    total: order.total,
    item_count: order.item_count,
    created_at: order.created_at,
  }));
}

function buildSystemInstruction(products: NormalizedProduct[], orders: OrderSummary[] | null): string {
  const productContext = JSON.stringify(toProductContext(products));
  const orderContext = orders ? JSON.stringify(toOrderContext(orders)) : null;

  return [
    'You are the shopping assistant for VAULT, a Thai multi-business online marketplace.',
    'Always reply in Thai (ภาษาไทย), in a friendly, concise, and helpful tone.',
    'You are given the real current product catalog as JSON below, and, only if the shopper is signed in, their own real recent orders as JSON. Use ONLY this data to answer — never invent products, prices, stock levels, businesses, or orders that are not listed below.',
    'If the shopper asks about their own orders and no order data is provided below, politely tell them (in Thai) that they need to sign in to see their orders.',
    'If a question is unrelated to shopping, orders, or the marketplace, answer briefly and steer the conversation back to how you can help at VAULT.',
    `Product catalog (JSON): ${productContext}`,
    orderContext
      ? `Signed-in shopper's recent orders (JSON): ${orderContext}`
      : 'The shopper is not signed in, so no order data is available.',
  ].join('\n');
}

export async function chatWithAssistant(
  payload: unknown,
  userId: number | null,
  overrides: Partial<ChatServiceDependencies> = {},
): Promise<ChatResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const messages = normalizeMessages(payload);

  const [products, orders] = await Promise.all([
    dependencies.getProducts(),
    userId ? dependencies.getOrdersForUser(userId) : Promise.resolve(null),
  ]);

  const systemInstruction = buildSystemInstruction(products, orders);
  const turns: ChatTurn[] = messages.map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    text: message.content,
  }));

  const reply = await dependencies.generateReply({ turns, systemInstruction });
  return { reply: reply.trim() };
}
