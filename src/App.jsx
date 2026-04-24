import { useState, useEffect, useCallback } from 'react';
import { Tabs, Button, Space, Typography } from 'antd';
import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { api, getAuthToken, setAuthToken, setOnAuthError } from './api';
import ProductStats from './pages/ProductStats';
import SwapStats from './pages/SwapStats';
import LoginPage from './pages/LoginPage';
import AddProductModal from './components/AddProductModal';

import ImagePreviewModal from './components/ImagePreviewModal';
import EditMethodsModal from './components/EditMethodsModal';
import UserSwitcher from './components/UserSwitcher';
import useIsMobile from './hooks/useIsMobile';
import MobileProductList from './components/MobileProductList';
import MobileSwapList from './components/MobileSwapList';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState('swaps');
  const isMobile = useIsMobile();  const [products, setProducts] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [methods, setMethods] = useState([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSwap, setShowAddSwap] = useState(false);
  const [showEditMethods, setShowEditMethods] = useState(false);
  const [imageModal, setImageModal] = useState(null);

  const loadProducts = useCallback(async () => {
    const list = await api.getProducts();
    setProducts(list);
    // Lazy-load thumbnails after the table renders
    api.getProductCovers().then((covers) => {
      const map = new Map(covers.map(c => [c.product_id, c.cover_image]));
      setProducts(prev => prev.map(p => ({ ...p, cover_image: map.get(p.id) || null })));
    }).catch(() => {});
  }, []);
  const loadSwaps = useCallback(async () => {
    const list = await api.getSwaps();
    setSwaps(list);
    api.getSwapCovers().then((covers) => {
      const map = new Map(covers.map(c => [c.swap_id, c.cover_image]));
      setSwaps(prev => prev.map(s => ({ ...s, cover_image: map.get(s.id) || null })));
    }).catch(() => {});
  }, []);
  const loadMethods = useCallback(async () => { setMethods(await api.getMethods()); }, []);
  const loadData = useCallback(async () => {
    // Render the page as soon as the lightweight data is in
    const [p, s, m] = await Promise.all([api.getProducts(), api.getSwaps(), api.getMethods()]);
    setProducts(p);
    setSwaps(s);
    setMethods(m);
    // Lazy-load thumbnails in the background
    api.getProductCovers().then((covers) => {
      const map = new Map(covers.map(c => [c.product_id, c.cover_image]));
      setProducts(prev => prev.map(x => ({ ...x, cover_image: map.get(x.id) || null })));
    }).catch(() => {});
    api.getSwapCovers().then((covers) => {
      const map = new Map(covers.map(c => [c.swap_id, c.cover_image]));
      setSwaps(prev => prev.map(x => ({ ...x, cover_image: map.get(x.id) || null })));
    }).catch(() => {});
  }, []);

  // After a swap mutation, products' remaining/exchanged also change → refresh both
  const reloadAfterSwapChange = useCallback(async () => {
    const [s, p] = await Promise.all([api.getSwaps(), api.getProducts()]);
    setSwaps(s);
    setProducts(p);
    api.getProductCovers().then((covers) => {
      const map = new Map(covers.map(c => [c.product_id, c.cover_image]));
      setProducts(prev => prev.map(x => ({ ...x, cover_image: map.get(x.id) || null })));
    }).catch(() => {});
    api.getSwapCovers().then((covers) => {
      const map = new Map(covers.map(c => [c.swap_id, c.cover_image]));
      setSwaps(prev => prev.map(x => ({ ...x, cover_image: map.get(x.id) || null })));
    }).catch(() => {});
  }, []);

  // Granular per-row patches — avoid blanket refresh that re-renders all images
  const patchSwap = useCallback((s) => {
    setSwaps(prev => prev.map(x => x.id === s.id ? { ...x, ...s } : x));
  }, []);
  const patchProduct = useCallback((p) => {
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, ...p } : x));
  }, []);
  const reloadSwap = useCallback(async (id) => {
    try { patchSwap(await api.getSwap(id)); } catch { /* ignore (e.g. just-deleted) */ }
  }, [patchSwap]);
  const reloadProduct = useCallback(async (id) => {
    try { patchProduct(await api.getProduct(id)); } catch { /* ignore */ }
  }, [patchProduct]);
  const appendSwap = useCallback(async (id) => {
    try {
      const s = await api.getSwap(id);
      setSwaps(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...s } : x) : [...prev, s]);
    } catch { /* ignore */ }
  }, []);
  const appendProduct = useCallback(async (id) => {
    try {
      const p = await api.getProduct(id);
      setProducts(prev => prev.some(x => x.id === id) ? prev.map(x => x.id === id ? { ...x, ...p } : x) : [...prev, p]);
    } catch { /* ignore */ }
  }, []);
  const removeSwapLocal = useCallback((id) => {
    setSwaps(prev => prev.filter(x => x.id !== id));
  }, []);
  const removeProductLocal = useCallback((id) => {
    setProducts(prev => prev.filter(x => x.id !== id));
  }, []);
  const reorderSwapsLocal = useCallback((next) => setSwaps(next), []);
  const reorderProductsLocal = useCallback((next) => setProducts(next), []);

  // Check auth on mount
  useEffect(() => {
    if (!getAuthToken()) { setAuthChecked(true); return; }
    api.getMe()
      .then(user => { setCurrentUser(user); setAuthChecked(true); })
      .catch(() => { setAuthToken(null); setAuthChecked(true); });
  }, []);

  // On 401, go back to login
  useEffect(() => {
    setOnAuthError(() => { setCurrentUser(null); });
  }, []);

  useEffect(() => { if (currentUser) loadData(); }, [currentUser, loadData]);

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setProducts([]);
    setSwaps([]);
    setMethods([]);
  };

  if (!authChecked) return null;
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="top-bar">
        {!isMobile && <Typography.Title level={3} style={{ margin: 0 }}>Trade Book</Typography.Title>}
        <Space wrap={false} size={isMobile ? 6 : 8} style={isMobile ? { width: '100%', justifyContent: 'space-between' } : undefined}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setTab('products'); setShowAddProduct(true); }}>{isMobile ? '制品' : '添加制品'}</Button>
          <Button type="primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} icon={<PlusOutlined />} onClick={() => { setTab('swaps'); setShowAddSwap(true); }}>{isMobile ? '互换' : '添加互换'}</Button>
          <UserSwitcher currentUser={currentUser} onUserChange={loadData} onLogout={handleLogout} />
        </Space>
      </header>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        size="large"
        items={[
          { key: 'products', label: '制品统计' },
          { key: 'swaps', label: '互换统计' },
        ]}
        tabBarExtraContent={isMobile && tab === 'swaps' ? (
          <Button size="small" icon={<SettingOutlined />} onClick={() => setShowEditMethods(true)}>互换方式</Button>
        ) : null}
        className="app-tabs"
        style={{ padding: isMobile ? '0 12px' : '0 24px' }}
      />

      <div style={{ padding: isMobile ? '0 12px 24px' : '0 24px 24px' }}>
        {tab === 'products' ? (
          isMobile ? (
            <MobileProductList
              products={products}
              onUpdate={loadProducts}
              onReloadProduct={reloadProduct}
              onAppendProduct={appendProduct}
              onRemoveProduct={removeProductLocal}
              onImageModal={setImageModal}
              showAddProduct={showAddProduct}
              onCloseAddProduct={() => setShowAddProduct(false)}
            />
          ) : (
            <ProductStats
              products={products}
              onUpdate={loadProducts}
              onReloadProduct={reloadProduct}
              onAppendProduct={appendProduct}
              onRemoveProduct={removeProductLocal}
              onPatchProduct={patchProduct}
              onReorderProductsLocal={reorderProductsLocal}
              onImageModal={setImageModal}
            />
          )
        ) : (
          isMobile ? (
            <MobileSwapList
              swaps={swaps}
              products={products}
              methods={methods}
              onUpdate={reloadAfterSwapChange}
              onReloadSwap={reloadSwap}
              onReloadProduct={reloadProduct}
              onAppendSwap={appendSwap}
              onRemoveSwap={removeSwapLocal}
              onPatchSwap={patchSwap}
              onImageModal={setImageModal}
              onEditMethods={() => setShowEditMethods(true)}
              showAddSwap={showAddSwap}
              onCloseAddSwap={() => setShowAddSwap(false)}
            />
          ) : (
            <SwapStats
              swaps={swaps}
              products={products}
              methods={methods}
              onUpdate={reloadAfterSwapChange}
              onReloadSwap={reloadSwap}
              onReloadProduct={reloadProduct}
              onAppendSwap={appendSwap}
              onRemoveSwap={removeSwapLocal}
              onPatchSwap={patchSwap}
              onPatchProduct={patchProduct}
              onReorderSwapsLocal={reorderSwapsLocal}
              onEditMethods={() => setShowEditMethods(true)}
              onImageModal={setImageModal}
              showAddSwap={showAddSwap}
              onCloseAddSwap={() => setShowAddSwap(false)}
            />
          )
        )}
      </div>

      {showAddProduct && !isMobile && (
        <AddProductModal onClose={() => setShowAddProduct(false)} onCreated={loadProducts} />
      )}

      {showEditMethods && (
        <EditMethodsModal methods={methods} onClose={() => setShowEditMethods(false)} onSaved={loadMethods} />
      )}
      {imageModal && (
        <ImagePreviewModal {...imageModal} onClose={() => setImageModal(null)} onUpdate={imageModal.type === 'product' ? loadProducts : reloadAfterSwapChange} />
      )}
    </div>
  );
}
