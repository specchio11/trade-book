import { useEffect, useMemo, useState, useCallback } from 'react';
import { Modal, InputNumber, Tag, Typography, Empty, Form, Input, Radio, Divider, Upload, Button, Spin } from 'antd';
import { PictureOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../api';

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export default function RegisterItemsModal({ swap, products, methods = [], onClose, onSaved }) {
  const [form] = Form.useForm();
  const [selectedMethodId, setSelectedMethodId] = useState(swap.swap_method_id || methods[0]?.id || null);
  const [submitting, setSubmitting] = useState(false);

  const initial = useMemo(() => {
    const m = {};
    for (const it of swap.items || []) m[it.product_id] = it.quantity;
    return m;
  }, [swap]);
  const [quantities, setQuantities] = useState(initial);

  const [existingImages, setExistingImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState(() => new Set());
  const [newImages, setNewImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(true);

  useEffect(() => {
    let alive = true;
    api.getSwapImages(swap.id).then(imgs => {
      if (alive) {
        setExistingImages(imgs);
        setLoadingImages(false);
      }
    });
    return () => { alive = false; };
  }, [swap.id]);

  const sorted = useMemo(() => {
    return [...products].sort((a, b) => {
      const at = a.type_sort ?? Infinity;
      const bt = b.type_sort ?? Infinity;
      if (at !== bt) return at - bt;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [products]);

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
    const ownPrev = initial[product.id] || 0;
    const max = product.remaining + ownPrev;
    if (val != null && val > max) val = max;
    setQuantities(prev => ({ ...prev, [product.id]: val }));
  };

  const selectedMethod = methods.find(m => m.id === selectedMethodId);
  const isMail = selectedMethod?.name === '互寄';

  const processFiles = useCallback(async (files) => {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (list.length === 0) return;
    const dataUrls = await Promise.all(list.map(f => readFileAsDataURL(f)));
    setNewImages(prev => [...prev, ...dataUrls]);
  }, []);

  useEffect(() => {
    const handlePaste = (e) => {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
      const items = Array.from(e.clipboardData?.items || []);
      const files = items.filter(i => i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
      if (files.length > 0) {
        e.preventDefault();
        processFiles(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  const removeExisting = (id) => setRemovedImageIds(prev => { const n = new Set(prev); n.add(id); return n; });
  const undoRemoveExisting = (id) => setRemovedImageIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  const removeNew = (idx) => setNewImages(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    setSubmitting(true);
    try {
      await api.updateSwap(swap.id, {
        swap_method_id: values.method || null,
        received_product: values.received_product || '',
        address: isMail ? (values.address || '') : '',
        notes: values.notes || '',
      });
      for (const id of removedImageIds) await api.deleteSwapImage(swap.id, id);
      for (const data of newImages) await api.uploadSwapImage(swap.id, data);
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

  const visibleExisting = existingImages.filter(img => !removedImageIds.has(img.id));
  const removedList = existingImages.filter(img => removedImageIds.has(img.id));

  return (
    <Modal
      open
      title={`登记互换 — ${swap.nickname || ''}`}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      width={620}
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          method: swap.swap_method_id || methods[0]?.id,
          received_product: swap.received_product || '',
          address: swap.address || '',
          notes: swap.notes || '',
        }}
      >
        <Typography.Text strong style={{ fontSize: 15 }}>对方信息</Typography.Text>
        <Divider style={{ margin: '8px 0 12px' }} />

        <Form.Item label="互换方式" name="method" rules={[{ required: true, message: '请选择互换方式' }]}>
          <Radio.Group onChange={(e) => setSelectedMethodId(e.target.value)}>
            {methods.map(m => <Radio key={m.id} value={m.id}>{m.name}</Radio>)}
          </Radio.Group>
        </Form.Item>

        {isMail && (
          <Form.Item label="地址" name="address" rules={[{ required: true, message: '互寄请填写地址' }]}>
            <Input.TextArea rows={2} placeholder="收件人 / 电话 / 地址" />
          </Form.Item>
        )}

        <Form.Item label="对方互换制品" name="received_product">
          <Input placeholder="对方给我的制品名称" />
        </Form.Item>

        <Form.Item label="对方制品图">
          {loadingImages ? (
            <Spin size="small" />
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {visibleExisting.map(img => (
                  <div key={img.id} style={{ position: 'relative', width: 72, height: 72, borderRadius: 6, overflow: 'hidden', border: '1px solid #eee' }}>
                    <img src={img.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => removeExisting(img.id)}
                      style={{
                        position: 'absolute', top: 2, right: 2, border: 'none',
                        background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: '50%',
                        width: 22, height: 22, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}
                      title="移除"
                    >
                      <DeleteOutlined style={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}
                {newImages.map((img, i) => (
                  <div key={`n-${i}`} style={{ position: 'relative', width: 72, height: 72, borderRadius: 6, overflow: 'hidden', border: '1px dashed #7c3aed' }}>
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => removeNew(i)}
                      style={{
                        position: 'absolute', top: 2, right: 2, border: 'none',
                        background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: '50%',
                        width: 22, height: 22, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}
                      title="移除"
                    >
                      <DeleteOutlined style={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}
                {removedList.map(img => (
                  <div
                    key={`r-${img.id}`}
                    style={{ position: 'relative', width: 72, height: 72, borderRadius: 6, overflow: 'hidden', border: '1px solid #fca5a5', opacity: 0.4, cursor: 'pointer' }}
                    title="将被删除（点击撤销）"
                    onClick={() => undoRemoveExisting(img.id)}
                  >
                    <img src={img.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
              <Upload accept="image/*" multiple showUploadList={false} beforeUpload={(file, list) => { processFiles(list); return false; }}>
                <Button icon={<UploadOutlined />} size="small">上传图片</Button>
              </Upload>
              <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>支持 Ctrl+V 粘贴</Typography.Text>
            </>
          )}
        </Form.Item>

        <Form.Item label="备注" name="notes">
          <Input placeholder="选填" />
        </Form.Item>

        <Typography.Text strong style={{ fontSize: 15 }}>互换制品</Typography.Text>
        <Divider style={{ margin: '8px 0 12px' }} />

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
                  const qty = parseInt(quantities[p.id]) || 0;
                  const highlighted = qty > 0;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: highlighted ? '#fef3c7' : '#fafafa',
                        border: highlighted ? '1px solid #fde68a' : '1px solid transparent',
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
                      <span style={{ flex: 1, fontWeight: highlighted ? 600 : 400, color: highlighted ? '#92400e' : 'inherit' }}>{p.name}</span>
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
      </Form>
    </Modal>
  );
}
