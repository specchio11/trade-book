import { useState, useEffect, useCallback } from 'react';
import { Tabs, Button, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from './api';
import ProductStats from './pages/ProductStats';
import SwapStats from './pages/SwapStats';
import AddProductModal from './components/AddProductModal';
import AddSwapModal from './components/AddSwapModal';
import ImagePreviewModal from './components/ImagePreviewModal';
import EditMethodsModal from './components/EditMethodsModal';
import UserSwitcher from './components/UserSwitcher';

export default function App() {
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [methods, setMethods] = useState([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSwap, setShowAddSwap] = useState(false);
  const [showEditMethods, setShowEditMethods] = useState(false);
  const [imageModal, setImageModal] = useState(null);

  const loadData = useCallback(async () => {
    const [p, s, m] = await Promise.all([api.getProducts(), api.getSwaps(), api.getMethods()]);
    setProducts(p);
    setSwaps(s);
    setMethods(m);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="app">
      <header className="top-bar">
        <Typography.Title level={3} style={{ margin: 0 }}>Trade Book</Typography.Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAddProduct(true)}>添加制品</Button>
          <Button type="primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} icon={<PlusOutlined />} onClick={() => setShowAddSwap(true)}>添加互换</Button>
          <UserSwitcher onUserChange={loadData} />
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
        style={{ padding: '0 24px' }}
      />

      <div style={{ padding: '0 24px 24px' }}>
        {tab === 'products' ? (
          <ProductStats products={products} onUpdate={loadData} onImageModal={setImageModal} />
        ) : (
          <SwapStats swaps={swaps} products={products} methods={methods} onUpdate={loadData} onEditMethods={() => setShowEditMethods(true)} onImageModal={setImageModal} />
        )}
      </div>

      {showAddProduct && (
        <AddProductModal onClose={() => setShowAddProduct(false)} onCreated={loadData} />
      )}
      {showAddSwap && (
        <AddSwapModal products={products} methods={methods} onClose={() => setShowAddSwap(false)} onCreated={loadData} />
      )}
      {showEditMethods && (
        <EditMethodsModal methods={methods} onClose={() => setShowEditMethods(false)} onSaved={loadData} />
      )}
      {imageModal && (
        <ImagePreviewModal {...imageModal} onClose={() => setImageModal(null)} onUpdate={loadData} />
      )}
    </div>
  );
}
