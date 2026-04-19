import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Upload, Image, Popconfirm, Space, Typography, App as AntdApp } from 'antd';
import { UploadOutlined, DeleteOutlined, StarOutlined, InboxOutlined } from '@ant-design/icons';
import { api } from '../api';

const { Dragger } = Upload;

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
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
      const swaps = await api.getSwaps();
      const swap = swaps.find(s => s.id === targetId);
      updated = swap?.images || [];
    }
    setImages(updated);
    onUpdate();
    return updated;
  }, [targetId, isProduct, onUpdate]);

  const current = images[idx];

  const setCover = async () => {
    if (!isProduct || !current) return;
    await api.setCoverImage(targetId, current.id);
    message.success('已设为封面');
    await reload();
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

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {images.map((img, i) => (
              <div
                key={img.id}
                onClick={() => setIdx(i)}
                style={{
                  position: 'relative', width: 64, height: 64, borderRadius: 6,
                  overflow: 'hidden', cursor: 'pointer',
                  border: i === idx ? '2px solid #7c3aed' : '1px solid #eee',
                }}
              >
                <img src={img.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {img.is_cover && (
                  <span style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'rgba(124,58,237,.85)', color: '#fff',
                    fontSize: 10, textAlign: 'center',
                  }}>封面</span>
                )}
              </div>
            ))}
            <Upload accept="image/*" multiple showUploadList={false} beforeUpload={(file, list) => { processFiles(list); return false; }}>
              <div style={{
                width: 64, height: 64, borderRadius: 6, border: '1px dashed #ccc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 24, color: '#999',
              }}>+</div>
            </Upload>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Space>
              {isProduct && current && (
                <Button icon={<StarOutlined />} onClick={setCover} disabled={current.is_cover}>设为封面</Button>
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
