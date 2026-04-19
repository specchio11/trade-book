const BASE = '/api';

let currentUserId = parseInt(localStorage.getItem('userId')) || 1;

export function setCurrentUserId(id) {
  currentUserId = id;
  localStorage.setItem('userId', id);
}

export function getCurrentUserId() {
  return currentUserId;
}

async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': String(currentUserId),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  // Users
  getUsers: () => request('/users'),
  createUser: (name) => request('/users', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: () => request('/products'),
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
