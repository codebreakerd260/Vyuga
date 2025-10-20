import axios from 'axios';
import { CheckoutData } from './types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add user ID from Clerk
api.interceptors.request.use((config) => {
  const userId = localStorage.getItem('clerk-user-id');
  if (userId) {
    config.headers['x-user-id'] = userId;
  }

  // Guest cart session
  let sessionId = localStorage.getItem('cart-session-id');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(7);
    localStorage.setItem('cart-session-id', sessionId);
  }
  config.headers['x-session-id'] = sessionId;

  return config;
});

export default api;

// API methods
export const garmentAPI = {
  list: (params?: { category?: string; search?: string; page?: number }) =>
    api.get('/garments', { params }),

  get: (id: string) =>
    api.get(`/garments/${id}`)
};

export const tryonAPI = {
  upload: (formData: FormData) =>
    api.post('/try-on/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  getStatus: (sessionId: string) =>
    api.get(`/try-on/status/${sessionId}`)
};

export const cartAPI = {
  get: () => api.get('/cart'),

  addItem: (data: { garmentId: string; size: string; quantity: number }) =>
    api.post('/cart/items', data),

  removeItem: (id: string) =>
    api.delete(`/cart/items/${id}`)
};

export const orderAPI = {
  checkout: (data: CheckoutData) =>
    api.post('/orders/checkout', data),

  verify: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    api.post('/orders/verify', data),

  list: () =>
    api.get('/orders'),

  get: (id: string) =>
    api.get(`/orders/${id}`)
};
