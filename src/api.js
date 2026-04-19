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
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  getProductImages: (id) => request(`/products/${id}/images`),
  uploadProductImage: (id, data) => request(`/products/${id}/images`, { method: 'POST', body: JSON.stringify({ data }) }),
  setCoverImage: (productId, imageId) => request(`/products/${productId}/images/${imageId}/cover`, { method: 'PATCH' }),
  deleteProductImage: (productId, imageId) => request(`/products/${productId}/images/${imageId}`, { method: 'DELETE' }),

  // Swaps
  getSwaps: () => request('/swaps'),
  createSwap: (data) => request('/swaps', { method: 'POST', body: JSON.stringify(data) }),
  updateSwap: (id, data) => request(`/swaps/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateSwapItems: (id, items) => request(`/swaps/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) }),
  deleteSwap: (id) => request(`/swaps/${id}`, { method: 'DELETE' }),
  uploadSwapImage: (id, data) => request(`/swaps/${id}/images`, { method: 'POST', body: JSON.stringify({ data }) }),
  deleteSwapImage: (swapId, imageId) => request(`/swaps/${swapId}/images/${imageId}`, { method: 'DELETE' }),

  // Methods
  getMethods: () => request('/methods'),
  createMethod: (name) => request('/methods', { method: 'POST', body: JSON.stringify({ name }) }),
  updateMethod: (id, name) => request(`/methods/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteMethod: (id) => request(`/methods/${id}`, { method: 'DELETE' }),
  reorderMethods: (order) => request('/methods/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),
};
