import { useState, useEffect } from 'react';
import { Button, Tag, Popconfirm, App, Empty, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined, PictureOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import { api } from '../api';
import EditProductModal from './EditProductModal';

export default function MobileProductList({
  products, onUpdate, onReloadProduct, onAppendProduct, onRemoveProduct, onImageModal, showAddProduct, onCloseAddProduct,
}) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(null);

  const handleAdd = () => {
    // Open edit page with empty staged product; persist only on save.
    setEditing({ name: '', total: 0, notes: '' });
  };

  // Trigger from top-bar add button
  useEffect(() => {
    if (showAddProduct) {
      handleAdd();
      onCloseAddProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddProduct]);

  const handleDelete = async (id) => {
    onRemoveProduct(id);
    try {
      await api.deleteProduct(id);
      message.success('已删除');
    } catch {
      message.error('删除失败');
      onUpdate?.();
    }
  };

  const openImages = async (e, product) => {
    e.stopPropagation();
    const images = await api.getProductImages(product.id);
    onImageModal({
      type: 'product', targetId: product.id, targetName: product.name,
      images, currentIndex: 0,
    });
  };

  return (
    <div className="mobile-card-list">
      {products.length === 0 ? (
        <Empty description="暂无制品" style={{ marginTop: 40 }} />
      ) : (
        products.map(p => {
          const lowStock = p.remaining > 0 && p.remaining < 5;
          const noStock = p.remaining <= 0;
          return (
            <div
              key={p.id}
              className={`mobile-card ${noStock ? 'mobile-card-muted' : ''}`}
              onClick={() => setEditing(p)}
            >
              <div className="mobile-card-thumb" onClick={(e) => openImages(e, p)}>
                {p.cover_image
                  ? <img src={p.cover_image.data} alt="" />
                  : <PictureOutlined style={{ fontSize: 24, color: '#bbb' }} />}
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-title">
                  <span>{p.name || '（未命名）'}</span>
                  {noStock && (
                    <Tooltip title="已无余量">
                      <ExclamationCircleFilled style={{ color: '#cf1322', fontSize: 14 }} />
                    </Tooltip>
                  )}
                  {lowStock && (
                    <Tooltip title={`余量不足 ${p.remaining}`}>
                      <ExclamationCircleFilled style={{ color: '#faad14', fontSize: 14 }} />
                    </Tooltip>
                  )}
                </div>
                <div className="mobile-card-meta">
                  {p.type_name && <Tag color="blue">{p.type_name}</Tag>}
                  {p.character_name && <Tag color="purple">{p.character_name}</Tag>}
                </div>
                <div className="mobile-card-stats">
                  <Tag color={p.remaining < 5 ? 'red' : 'default'} style={{ fontWeight: 600 }}>
                    余 {p.remaining ?? 0}
                  </Tag>
                  <span className="mobile-card-stat">总 {p.total ?? 0}</span>
                  <span className="mobile-card-stat">已兑 {p.exchanged ?? 0}</span>
                </div>
                {p.notes && <div className="mobile-card-notes">{p.notes}</div>}
              </div>
              <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                <Popconfirm title="确定删除？" onConfirm={() => handleDelete(p.id)} okText="删除" cancelText="取消">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            </div>
          );
        })
      )}

      <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 12 }} onClick={handleAdd}>
        添加一行
      </Button>

      {editing && (
        <EditProductModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => onReloadProduct(id)}
          onCreated={(id) => onAppendProduct(id)}
        />
      )}
    </div>
  );
}
