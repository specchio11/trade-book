import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Modal, InputNumber, Tag, Typography, Empty, Form, Input, Radio, Divider, Upload, Spin } from 'antd';
import { PictureOutlined, InboxOutlined, DeleteOutlined } from '@ant-design/icons';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../api';

const { Dragger } = Upload;

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function SortableThumb({ img, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    width: 72, height: 72, borderRadius: 6,
    overflow: 'hidden', cursor: 'grab',
    border: '1px solid #eee',
    opacity: isDragging ? 0.5 : 1,
    flexShrink: 0,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <img src={img.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(img.id); }}
        style={{
          position: 'absolute', top: 2, right: 2, border: 'none',
          background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: '50%',
          width: 22, height: 22, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 0,
        }}
        title="删除"
      >
        <DeleteOutlined style={{ fontSize: 12 }} />
      </button>
    </div>
  );
}

export default function RegisterItemsModal({ swap, products, methods = [], onClose, onSaved }) {
  const [form] = Form.useForm();
  const isNew = !swap.id;
  const [selectedMethodId, setSelectedMethodId] = useState(swap.swap_method_id || methods[0]?.id || null);
  const [submitting, setSubmitting] = useState(false);

  const initial = useMemo(() => {
    const m = {};
    for (const it of swap.items || []) m[it.product_id] = it.quantity;
    return m;
  }, [swap]);
  const [quantities, setQuantities] = useState(initial);

  // For existing swaps: images are persisted server-side (each entry has numeric id + data).
  // For new swaps: images are staged locally as { id: 'tmp-N', data: dataUrl }.
  const [images, setImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(!isNew);
  const imagesDirtyRef = useRef(false);
  const tmpIdRef = useRef(0);

  const reloadImages = useCallback(async () => {
    if (isNew) return images;
    const imgs = await api.getSwapImages(swap.id);
    setImages(imgs);
    return imgs;
  }, [swap.id, isNew, images]);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    api.getSwapImages(swap.id).then(imgs => {
      if (alive) {
        setImages(imgs);
        setLoadingImages(false);
      }
    });
    return () => { alive = false; };
  }, [swap.id, isNew]);

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
    if (isNew) {
      const dataUrls = await Promise.all(list.map(f => readFileAsDataURL(f)));
      setImages(prev => [
        ...prev,
        ...dataUrls.map(d => ({ id: `tmp-${++tmpIdRef.current}`, data: d })),
      ]);
      return;
    }
    for (const file of list) {
      const data = await readFileAsDataURL(file);
      await api.uploadSwapImage(swap.id, data);
    }
    imagesDirtyRef.current = true;
    await reloadImages();
  }, [swap.id, isNew, reloadImages]);

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

  const handleDeleteImage = async (id) => {
    if (isNew) {
      setImages(prev => prev.filter(i => i.id !== id));
      return;
    }
    await api.deleteSwapImage(swap.id, id);
    imagesDirtyRef.current = true;
    await reloadImages();
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldI = images.findIndex(i => i.id === active.id);
    const newI = images.findIndex(i => i.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(images, oldI, newI);
    setImages(next);
    if (isNew) return;
    imagesDirtyRef.current = true;
    await api.reorderSwapImages(swap.id, next.map(i => i.id));
  };

  const handleClose = () => {
    if (imagesDirtyRef.current) onSaved();
    onClose();
  };

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    setSubmitting(true);
    try {
      const items = sorted.map(p => ({
        product_id: p.id,
        quantity: parseInt(quantities[p.id]) || 0,
      })).filter(it => it.quantity > 0);
      if (isNew) {
        await api.createSwap({
          nickname: values.nickname || '',
          qq: values.qq || '',
          swap_method_id: values.method || null,
          received_product: values.received_product || '',
          address: isMail ? (values.address || '') : '',
          notes: values.notes || '',
          items,
          images: images.map(i => i.data),
        });
      } else {
        await api.updateSwap(swap.id, {
          nickname: values.nickname || '',
          qq: values.qq || '',
          swap_method_id: values.method || null,
          received_product: values.received_product || '',
          address: isMail ? (values.address || '') : '',
          notes: values.notes || '',
        });
        await api.updateSwapItems(swap.id, items);
      }
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={swap.nickname ? `编辑互换 — ${swap.nickname}` : '添加互换'}
      onCancel={handleClose}
      onOk={handleSubmit}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      width={620}
      maskClosable={false}
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          nickname: swap.nickname || '',
          qq: swap.qq || '',
          method: swap.swap_method_id || methods[0]?.id,
          received_product: swap.received_product || '',
          address: swap.address || '',
          notes: swap.notes || '',
        }}
      >
        <Typography.Text strong style={{ fontSize: 15 }}>对方信息</Typography.Text>
        <Divider style={{ margin: '8px 0 12px' }} />

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item label="昵称" name="nickname" rules={[{ required: true, message: '请填写昵称' }]} style={{ flex: 1 }}>
            <Input placeholder="对方昵称" />
          </Form.Item>
          <Form.Item label="QQ" name="qq" style={{ flex: 1 }}>
            <Input placeholder="选填" />
          </Form.Item>
        </div>

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
              <Dragger
                multiple
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file, list) => { processFiles(list); return false; }}
                style={{ padding: 8 }}
              >
                <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}><InboxOutlined /></p>
                <p className="ant-upload-text" style={{ fontSize: 13 }}>点击、拖拽或 Ctrl+V 粘贴图片</p>
              </Dragger>

              {images.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={images.map(i => i.id)} strategy={horizontalListSortingStrategy}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      {images.map(img => (
                        <SortableThumb key={img.id} img={img} onDelete={handleDeleteImage} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              {images.length > 0 && (
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                  💡 拖拽缩略图可调整顺序，第一张为封面
                </Typography.Text>
              )}
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
