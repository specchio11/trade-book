const BASE = '/api';

let authToken = localStorage.getItem('authToken') || null;
let currentUserId = null; // set after login or from token
let onAuthError = null; // callback when 401 received

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('authToken', token);
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentUserId = payload.userId;
    } catch { /* ignore */ }
  } else {
    localStorage.removeItem('authToken');
    currentUserId = null;
  }
}

export function getAuthToken() { return authToken; }

export function setCurrentUserId(id) {
  currentUserId = id;
}

export function getCurrentUserId() {
  return currentUserId;
}

export function setOnAuthError(cb) {
  onAuthError = cb;
}

// Initialize from stored token
if (authToken) {
  try {
    const payload = JSON.parse(atob(authToken.split('.')[1]));
    currentUserId = payload.userId;
  } catch { /* ignore */ }
}

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  // Admin viewing another user's data
  if (currentUserId) {
    headers['X-View-As'] = String(currentUserId);
  }
  const res = await fetch(BASE + url, { ...options, headers });
  if (res.status === 401) {
    setAuthToken(null);
    onAuthError?.();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  // Auth
  login: (name, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ name, password }) }),
  getMe: () => request('/auth/me'),

  // Users (admin only)
  getUsers: () => request('/users'),
  createUser: (name, password) => request('/users', { method: 'POST', body: JSON.stringify({ name, password }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id, password) => request(`/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),

  // Products
  getProducts: () => request('/products'),
  getProduct: (id) => request(`/products/${id}`),
  getProductCovers: () => request('/products/covers'),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  reorderProducts: (order) => request('/products/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),
  getProductImages: (id) => request(`/products/${id}/images`),
  uploadProductImage: (id, data) => request(`/products/${id}/images`, { method: 'POST', body: JSON.stringify({ data }) }),
  setCoverImage: (productId, imageId) => request(`/products/${productId}/images/${imageId}/cover`, { method: 'PATCH' }),
  reorderProductImages: (productId, order) => request(`/products/${productId}/images/reorder`, { method: 'PUT', body: JSON.stringify({ order }) }),
  deleteProductImage: (productId, imageId) => request(`/products/${productId}/images/${imageId}`, { method: 'DELETE' }),

  // Swaps
  getSwaps: () => request('/swaps'),
  getSwap: (id) => request(`/swaps/${id}`),
  getSwapCovers: () => request('/swaps/covers'),
  createSwap: (data) => request('/swaps', { method: 'POST', body: JSON.stringify(data) }),
  updateSwap: (id, data) => request(`/swaps/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateSwapItems: (id, items) => request(`/swaps/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) }),
  deleteSwap: (id) => request(`/swaps/${id}`, { method: 'DELETE' }),
  reorderSwaps: (order) => request('/swaps/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),
  uploadSwapImage: (id, data) => request(`/swaps/${id}/images`, { method: 'POST', body: JSON.stringify({ data }) }),
  deleteSwapImage: (swapId, imageId) => request(`/swaps/${swapId}/images/${imageId}`, { method: 'DELETE' }),
  setSwapCoverImage: (swapId, imageId) => request(`/swaps/${swapId}/images/${imageId}/cover`, { method: 'PATCH' }),
  reorderSwapImages: (swapId, order) => request(`/swaps/${swapId}/images/reorder`, { method: 'PUT', body: JSON.stringify({ order }) }),
  getSwapImages: (id) => request(`/swaps/${id}/images`),

  // Methods
  getMethods: () => request('/methods'),
  createMethod: (name) => request('/methods', { method: 'POST', body: JSON.stringify({ name }) }),
  updateMethod: (id, name) => request(`/methods/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteMethod: (id) => request(`/methods/${id}`, { method: 'DELETE' }),
  reorderMethods: (order) => request('/methods/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),

  // Product types
  getProductTypes: () => request('/product-types'),
  createProductType: (name) => request('/product-types', { method: 'POST', body: JSON.stringify({ name }) }),
  updateProductType: (id, name) => request(`/product-types/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteProductType: (id) => request(`/product-types/${id}`, { method: 'DELETE' }),
  reorderProductTypes: (order) => request('/product-types/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),

  // Characters
  getCharacters: () => request('/characters'),
  createCharacter: (name) => request('/characters', { method: 'POST', body: JSON.stringify({ name }) }),
  updateCharacter: (id, name) => request(`/characters/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteCharacter: (id) => request(`/characters/${id}`, { method: 'DELETE' }),
  reorderCharacters: (order) => request('/characters/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),
};
