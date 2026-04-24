import { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Input, InputNumber, App, Spin, Typography, Divider, Upload } from 'antd';
import { InboxOutlined, DeleteOutlined } from '@ant-design/icons';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../api';
import CreatableSelect from './CreatableSelect';
import MobileOrModal from './MobilePageShell';

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

// Mobile-friendly full edit page for a product. Supports both editing (product has id)
// and creating new (product is null/has no id — staged locally until user saves).
export default function EditProductModal({ product, onClose, onSaved, onCreated }) {
  const isNew = !product?.id;
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [types, setTypes] = useState([]);
  const [characters, setCharacters] = useState([]);
  // For existing: server-backed images. For new: staged { id: 'tmp-N', data: dataUrl }.
  const [images, setImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(!isNew);
  const imagesDirtyRef = useRef(false);
  const tmpIdRef = useRef(0);

  useEffect(() => {
    Promise.all([api.getProductTypes(), api.getCharacters()]).then(([t, c]) => {
      setTypes(t);
      setCharacters(c);
    });
  }, []);

  const reloadImages = useCallback(async () => {
    if (isNew) return images;
    const imgs = await api.getProductImages(product.id);
    setImages(imgs);
    return imgs;
  }, [product?.id, isNew, images]);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    setLoadingImages(true);
    api.getProductImages(product.id).then(imgs => {
      if (alive) {
        setImages(imgs);
        setLoadingImages(false);
      }
    });
    return () => { alive = false; };
  }, [product?.id, isNew]);

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
      await api.uploadProductImage(product.id, data);
    }
    imagesDirtyRef.current = true;
    await reloadImages();
  }, [product?.id, isNew, reloadImages]);

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
    await api.deleteProductImage(product.id, id);
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
    await api.reorderProductImages(product.id, next.map(i => i.id));
  };

  const handleClose = () => {
    if (!isNew && imagesDirtyRef.current) onSaved?.(product.id);
    onClose();
  };

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    setSubmitting(true);
    try {
      if (isNew) {
        const created = await api.createProduct({
          name: (values.name || '').trim(),
          total: values.total || 0,
          notes: values.notes || '',
          type_id: values.type_id || null,
          character_id: values.character_id || null,
        });
        for (const img of images) {
          await api.uploadProductImage(created.id, img.data);
        }
        onCreated?.(created.id);
      } else {
        await api.updateProduct(product.id, {
          name: (values.name || '').trim(),
          total: values.total,
          notes: values.notes || '',
          type_id: values.type_id || null,
          character_id: values.character_id || null,
        });
        onSaved?.(product.id);
      }
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileOrModal
      open
      title={isNew ? '添加制品' : `编辑制品 — ${product.name}`}
      onCancel={handleClose}
      onOk={handleSubmit}
      okText={isNew ? '添加' : '保存'}
      cancelText="取消"
      confirmLoading={submitting}
      maskClosable={false}
      width={560}
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: product?.name || '',
          total: product?.total ?? 0,
          notes: product?.notes || '',
          type_id: product?.type_id || undefined,
          character_id: product?.character_id || undefined,
        }}
      >
        <Form.Item label="制品名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="输入制品名称" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Form.Item label="总数" name="total" rules={[{ required: true, message: '请输入总数' }]} style={{ flex: 1, minWidth: 80 }}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="总数" />
          </Form.Item>
          {!isNew && (
            <>
              <Form.Item label="已兑换" style={{ flex: 1, minWidth: 80 }}>
                <InputNumber value={product.exchanged || 0} disabled style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="剩余" style={{ flex: 1, minWidth: 80 }}>
                <InputNumber value={product.remaining ?? 0} disabled style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Form.Item label="制品类型" name="type_id" style={{ flex: 1, minWidth: 160 }}>
            <CreatableSelect
              placeholder="选择类型"
              options={types.map(t => ({ value: t.id, label: t.name }))}
              onCreate={async (name) => {
                const created = await api.createProductType(name);
                setTypes(await api.getProductTypes());
                return created.id;
              }}
            />
          </Form.Item>
          <Form.Item label="角色" name="character_id" style={{ flex: 1, minWidth: 160 }}>
            <CreatableSelect
              placeholder="选择角色"
              options={characters.map(c => ({ value: c.id, label: c.name }))}
              onCreate={async (name) => {
                const created = await api.createCharacter(name);
                setCharacters(await api.getCharacters());
                return created.id;
              }}
            />
          </Form.Item>
        </div>
        <Typography.Text strong style={{ fontSize: 14 }}>制品图片</Typography.Text>
        <Divider style={{ margin: '8px 0 12px' }} />
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

        <Form.Item label="备注" name="notes" style={{ marginTop: 16 }}>
          <Input placeholder="选填" />
        </Form.Item>
      </Form>
    </MobileOrModal>
  );
}
