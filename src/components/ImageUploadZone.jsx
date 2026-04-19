import { useState, useCallback, useEffect } from 'react';
import { Upload } from 'antd';
import { InboxOutlined, DeleteOutlined } from '@ant-design/icons';

const { Dragger } = Upload;

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export default function ImageUploadZone({ images, onChange, multiple = true, small = false }) {
  const processFiles = useCallback(async (files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const dataUrls = await Promise.all(imageFiles.map(f => readFileAsDataURL(f)));
    onChange(multiple ? [...images, ...dataUrls] : [dataUrls[0]]);
  }, [images, onChange, multiple]);

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

  const removeImage = (idx) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div>
      <Dragger
        multiple={multiple}
        accept="image/*"
        showUploadList={false}
        beforeUpload={(file, fileList) => {
          processFiles(fileList);
          return false;
        }}
        style={small ? { padding: 8 } : {}}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">点击、拖拽或粘贴图片上传</p>
        {!small && <p className="ant-upload-hint">支持 JPG、PNG{multiple ? '，可上传多张，第一张为封面' : ''}</p>}
      </Dragger>

      {images.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 6, overflow: 'hidden', border: '1px solid #eee' }}>
              <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => removeImage(i)}
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
              {i === 0 && multiple && (
                <span style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(124,58,237,.85)', color: '#fff',
                  fontSize: 11, textAlign: 'center', padding: '2px 0',
                }}>封面</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
