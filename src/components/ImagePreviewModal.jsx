import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Upload, Image, Popconfirm, Space, Typography, App as AntdApp } from 'antd';
import { UploadOutlined, DeleteOutlined, StarOutlined, InboxOutlined } from '@ant-design/icons';
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

function Thumb({ img, active, onClick, isCoverEffective }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative', width: 64, height: 64, borderRadius: 6,
    overflow: 'hidden', cursor: 'grab',
    border: active ? '2px solid #7c3aed' : '1px solid #eee',
    opacity: isDragging ? 0.5 : 1,
    flexShrink: 0,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <img src={img.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      {isCoverEffective && (
        <span style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(124,58,237,.85)', color: '#fff',
          fontSize: 10, textAlign: 'center', pointerEvents: 'none',
        }}>封面</span>
      )}
    </div>
  );
}

export default function ImagePreviewModal({ type, targetId, targetName, images: initialImages, currentIndex: initIdx, onClose, onUpdate }) {
  const { message } = AntdApp.useApp();
  const [images, setImages] = useState(initialImages || []);
  const [idx, setIdx] = useState(initIdx || 0);

  const isProduct = type === 'product';

  const reload = useCallback(async () => {
    let updated;
    if (isProduct) {
      updated = await api.getProductImages(targetId);
    } else {
      updated = await api.getSwapImages(targetId);
    }
    setImages(updated);
    onUpdate();
    return updated;
  }, [targetId, isProduct, onUpdate]);

  const current = images[idx];

  const setCover = async () => {
    if (!current) return;
    if (isProduct) await api.setCoverImage(targetId, current.id);
    else await api.setSwapCoverImage(targetId, current.id);
    message.success('已设为封面');
    const updated = await reload();
    // Cover is moved to position 0 → keep selection on same image
    const newIdx = updated.findIndex(im => im.id === current.id);
    if (newIdx >= 0) setIdx(newIdx);
  };

  const processFiles = useCallback(async (files) => {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (list.length === 0) return;
    for (const file of list) {
      const data = await readFileAsDataURL(file);
      if (isProduct) await api.uploadProductImage(targetId, data);
      else await api.uploadSwapImage(targetId, data);
    }
    const updated = await reload();
    if (updated.length > 0) setIdx(updated.length - 1);
  }, [targetId, isProduct, reload]);

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

  const handleDelete = async () => {
    if (!current) return;
    if (isProduct) await api.deleteProductImage(targetId, current.id);
    else await api.deleteSwapImage(targetId, current.id);
    const updated = await reload();
    if (updated.length === 0) { onClose(); return; }
    setIdx(i => Math.min(i, updated.length - 1));
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldI = images.findIndex(i => i.id === active.id);
    const newI = images.findIndex(i => i.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(images, oldI, newI);
    setImages(next);
    // Keep highlight on the same image
    const curId = current?.id;
    if (curId != null) {
      const ni = next.findIndex(i => i.id === curId);
      if (ni >= 0) setIdx(ni);
    }
    if (isProduct) await api.reorderProductImages(targetId, next.map(i => i.id));
    else await api.reorderSwapImages(targetId, next.map(i => i.id));
    onUpdate();
  };

  const hasImages = images.length > 0;

  return (
    <Modal
      open
      title={
        <div>
          {hasImages ? '图片预览' : '上传图片'}
          <Typography.Text type="secondary" style={{ marginLeft: 8, fontWeight: 400 }}>{targetName}</Typography.Text>
        </div>
      }
      onCancel={onClose}
      footer={null}
      maskClosable={false}
      width={720}
    >
      {hasImages ? (
        <>
          <div style={{ textAlign: 'center', background: '#fafafa', padding: 16, borderRadius: 8 }}>
            <Image src={current.data} alt="" style={{ maxHeight: '50vh', maxWidth: '100%' }} />
            <div style={{ marginTop: 8, color: '#999' }}>{idx + 1} / {images.length}</div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={images.map(i => i.id)} strategy={horizontalListSortingStrategy}>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {images.map((img, i) => (
                  <Thumb
                    key={img.id}
                    img={img}
                    active={i === idx}
                    onClick={() => setIdx(i)}
                    isCoverEffective={isProduct ? !!img.is_cover : i === 0}
                  />
                ))}
                <Upload accept="image/*" multiple showUploadList={false} beforeUpload={(file, list) => { processFiles(list); return false; }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 6, border: '1px dashed #ccc',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 24, color: '#999',
                  }}>+</div>
                </Upload>
              </div>
            </SortableContext>
          </DndContext>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
            💡 拖拽缩略图可以调整顺序
          </Typography.Text>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Space>
              {current && (
                <Button
                  icon={<StarOutlined />}
                  onClick={setCover}
                  disabled={isProduct ? current.is_cover : idx === 0}
                >设为封面</Button>
              )}
              <Upload accept="image/*" multiple showUploadList={false} beforeUpload={(file, list) => { processFiles(list); return false; }}>
                <Button icon={<UploadOutlined />}>上传图片</Button>
              </Upload>
              {current && (
                <Popconfirm title="确定删除这张图片？" onConfirm={handleDelete} okText="删除" cancelText="取消">
                  <Button danger icon={<DeleteOutlined />}>删除此图</Button>
                </Popconfirm>
              )}
            </Space>
          </div>
        </>
      ) : (
        <Dragger accept="image/*" multiple showUploadList={false} beforeUpload={(file, list) => { processFiles(list); return false; }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击、拖拽或粘贴图片上传</p>
          <p className="ant-upload-hint">支持 JPG、PNG，可上传多张</p>
        </Dragger>
      )}

      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
        💡 可以直接 Ctrl+V 粘贴剪贴板中的图片
      </Typography.Paragraph>
    </Modal>
  );
}
