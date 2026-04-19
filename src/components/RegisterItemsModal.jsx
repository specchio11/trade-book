import { useMemo, useState } from 'react';
import { Modal, InputNumber, Tag, Typography, Empty } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import { api } from '../api';

export default function RegisterItemsModal({ swap, products, onClose, onSaved }) {
  const initial = useMemo(() => {
    const m = {};
    for (const it of swap.items || []) m[it.product_id] = it.quantity;
    return m;
  }, [swap]);

  const [quantities, setQuantities] = useState(initial);
  const [submitting, setSubmitting] = useState(false);

  const sorted = useMemo(() => {
    return [...products].sort((a, b) => {
      const at = a.type_sort ?? Infinity;
      const bt = b.type_sort ?? Infinity;
      if (at !== bt) return at - bt;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [products]);

  // Group by type_name for visual separation
  const groups = useMemo(() => {
    const map = new Map();
    for (const p of sorted) {
      const key = p.type_name || '（未分类）';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return Array.from(map.entries());
  }, [sorted]);

  const setQty = (product, val) => {
    // Remaining already excludes other swaps' items but INCLUDES this swap's existing qty
    const ownPrev = initial[product.id] || 0;
    const max = product.remaining + ownPrev;
    if (val != null && val > max) val = max;
    setQuantities(prev => ({ ...prev, [product.id]: val }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const items = sorted.map(p => ({
        product_id: p.id,
        quantity: parseInt(quantities[p.id]) || 0,
      })).filter(it => it.quantity > 0);
      await api.updateSwapItems(swap.id, items);
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={`登记互换制品 — ${swap.nickname || ''}`}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      width={560}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      {sorted.length === 0 ? (
        <Empty description="暂无制品" />
      ) : (
        groups.map(([typeName, list]) => (
          <div key={typeName} style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>{typeName}</Typography.Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {list.map(p => {
                const ownPrev = initial[p.id] || 0;
                const max = p.remaining + ownPrev;
                const disabled = max <= 0;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: '#fafafa',
                      opacity: disabled ? 0.55 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: 4, overflow: 'hidden',
                        background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {p.cover_image
                        ? <img src={p.cover_image.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <PictureOutlined style={{ fontSize: 18, color: '#bbb' }} />}
                    </div>
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <Tag color={p.remaining < 5 ? 'red' : 'default'}>余 {p.remaining}</Tag>
                    <InputNumber
                      min={0}
                      max={max}
                      value={quantities[p.id]}
                      onChange={(v) => setQty(p, v)}
                      placeholder="0"
                      disabled={disabled && ownPrev === 0}
                      style={{ width: 90 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </Modal>
  );
}
