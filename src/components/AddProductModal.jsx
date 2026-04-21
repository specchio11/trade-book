import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select } from 'antd';
import { api } from '../api';
import ImageUploadZone from './ImageUploadZone';

export default function AddProductModal({ onClose, onCreated }) {
  const [form] = Form.useForm();
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [types, setTypes] = useState([]);
  const [characters, setCharacters] = useState([]);

  useEffect(() => {
    Promise.all([api.getProductTypes(), api.getCharacters()]).then(([t, c]) => {
      setTypes(t);
      setCharacters(c);
    });
  }, []);

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    setSubmitting(true);
    try {
      const product = await api.createProduct({
        name: values.name.trim(),
        total: values.total,
        notes: values.notes || '',
        type_id: values.type_id || null,
        character_id: values.character_id || null,
      });
      for (const img of images) {
        await api.uploadProductImage(product.id, img);
      }
      onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title="添加制品"
      onCancel={onClose}
      onOk={handleSubmit}
      okText="确认添加"
      cancelText="取消"
      confirmLoading={submitting}
      maskClosable={false}
      width={560}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item label="制品名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="输入制品名称" />
        </Form.Item>
        <Form.Item label="总数" name="total" rules={[{ required: true, message: '请输入总数' }]}>
          <InputNumber min={0} style={{ width: 200 }} placeholder="输入数量" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item label="制品类型" name="type_id" style={{ flex: 1 }}>
            <Select allowClear placeholder="选择类型" options={types.map(t => ({ value: t.id, label: t.name }))} />
          </Form.Item>
          <Form.Item label="制品角色" name="character_id" style={{ flex: 1 }}>
            <Select allowClear placeholder="选择角色" options={characters.map(c => ({ value: c.id, label: c.name }))} />
          </Form.Item>
        </div>
        <Form.Item label="制品图片">
          <ImageUploadZone images={images} onChange={setImages} />
        </Form.Item>
        <Form.Item label="备注" name="notes">
          <Input placeholder="选填" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
