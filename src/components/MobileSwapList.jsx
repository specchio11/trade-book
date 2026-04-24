import { useState, useEffect } from 'react';
import { Button, Tag, Popconfirm, App, Empty, Checkbox } from 'antd';
import { DeleteOutlined, PlusOutlined, PictureOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import { api } from '../api';
import RegisterItemsModal from './RegisterItemsModal';

const methodColor = (name) => {
  if (!name) return 'default';
  if (name.includes('音律')) return 'purple';
  if (name === 'ACF') return 'blue';
  if (name === '互寄') return 'green';
  return 'default';
};

export default function MobileSwapList({
  swaps, products, methods, onUpdate, onReloadSwap, onReloadProduct,
  onAppendSwap, onRemoveSwap, onPatchSwap, onImageModal, onEditMethods,
  showAddSwap, onCloseAddSwap,
}) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(null); // swap object or { __new: true }

  useEffect(() => {
    if (showAddSwap) {
      setEditing({
        nickname: '', qq: '', swap_method_id: null, received_product: '',
        notes: '', address: '', items: [],
      });
      onCloseAddSwap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddSwap]);

  const handleDelete = async (id) => {
    const swap = swaps.find(s => s.id === id);
    const affected = (swap?.items || []).map(it => it.product_id);
    onRemoveSwap(id);
    try {
      await api.deleteSwap(id);
      message.success('已删除');
      affected.forEach(pid => onReloadProduct(pid));
    } catch {
      message.error('删除失败');
      onUpdate?.();
    }
  };

  const togglePacked = (e, swap) => {
    e.stopPropagation();
    const next = e.target.checked;
    onPatchSwap({ id: swap.id, is_packed: next });
    api.updateSwap(swap.id, { is_packed: next }).catch(() => {
      message.error('保存失败');
      onReloadSwap(swap.id);
    });
  };
  const toggleSwapped = (e, swap) => {
    e.stopPropagation();
    const next = e.target.checked;
    onPatchSwap({ id: swap.id, is_swapped: next });
    api.updateSwap(swap.id, { is_swapped: next }).catch(() => {
      message.error('保存失败');
      onReloadSwap(swap.id);
    });
  };

  const openImages = async (e, swap) => {
    e.stopPropagation();
    const images = await api.getSwapImages(swap.id);
    onImageModal({
      type: 'swap', targetId: swap.id, targetName: swap.nickname,
      images, currentIndex: 0,
    });
  };

  const sorted = [...swaps].sort((a, b) => {
    const ai = methods.findIndex(m => m.id === a.swap_method_id);
    const bi = methods.findIndex(m => m.id === b.swap_method_id);
    return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
  });

  return (
    <div className="mobile-card-list">
      {sorted.length === 0 ? (
        <Empty description="暂无互换" style={{ marginTop: 40 }} />
      ) : (
        sorted.map(s => {
          const method = methods.find(m => m.id === s.swap_method_id);
          const totalQty = (s.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
          const kinds = (s.items || []).filter(it => it.quantity > 0).length;
          return (
            <div key={s.id} className={`mobile-card ${s.is_swapped ? 'mobile-card-swapped' : ''}`} onClick={() => setEditing(s)}>
              <div className="mobile-card-thumb" onClick={(e) => openImages(e, s)}>
                {s.cover_image
                  ? <img src={s.cover_image.data} alt="" />
                  : <PictureOutlined style={{ fontSize: 24, color: '#bbb' }} />}
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-title">
                  <span>{s.nickname || '（未命名）'}</span>
                  {method && <Tag color={methodColor(method.name)}>{method.name}</Tag>}
                </div>
                <div className="mobile-card-meta">
                  {s.qq && <span className="mobile-card-stat">QQ：{s.qq}</span>}
                </div>
                {s.received_product && (
                  <div className="mobile-card-meta">
                    <span className="mobile-card-stat">对方制品：{s.received_product}</span>
                  </div>
                )}
                <div className="mobile-card-stats">
                  <Tag color={totalQty > 0 ? 'gold' : 'default'}>
                    {totalQty > 0 ? `${kinds} 种 / 共 ${totalQty}` : '未登记制品'}
                  </Tag>
                </div>
                {s.address && (
                  <div className="mobile-card-notes">📮 {s.address}</div>
                )}
                {s.notes && <div className="mobile-card-notes">{s.notes}</div>}
                <div className="mobile-card-checks" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={!!s.is_packed} onChange={(e) => togglePacked(e, s)}>已包装</Checkbox>
                  <Checkbox checked={!!s.is_swapped} onChange={(e) => toggleSwapped(e, s)}>已互换</Checkbox>
                </div>
              </div>
              <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                <Button type="text" icon={<AppstoreAddOutlined />} onClick={() => setEditing(s)} />
                <Popconfirm title="确定删除？" onConfirm={() => handleDelete(s.id)} okText="删除" cancelText="取消">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            </div>
          );
        })
      )}

      <Button
        type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 12 }}
        onClick={() => setEditing({
          nickname: '', qq: '', swap_method_id: null, received_product: '',
          notes: '', address: '', items: [],
        })}
      >
        添加一行
      </Button>

      {editing && (
        <RegisterItemsModal
          swap={editing}
          products={products}
          methods={methods}
          onClose={() => setEditing(null)}
          onCreated={(newId, affected) => {
            onAppendSwap(newId);
            affected.forEach(pid => onReloadProduct(pid));
          }}
          onUpdated={(swapId, affected) => {
            onReloadSwap(swapId);
            affected.forEach(pid => onReloadProduct(pid));
          }}
        />
      )}
    </div>
  );
}
