import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, App } from 'antd';
import { api } from '../api';
import CreatableSelect from './CreatableSelect';

// Mobile-friendly full edit modal for an existing product. Cover image management
// stays on the existing ImagePreviewModal (tap the cover thumb to open it).
export default function EditProductModal({ product, onClose, onSaved }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
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
      await api.updateProduct(product.id, {
        name: (values.name || '').trim(),
        total: values.total,
        notes: values.notes || '',
        type_id: values.type_id || null,
        character_id: values.character_id || null,
      });
      onSaved?.(product.id);
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={`编辑制品 — ${product.name}`}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="保存"
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
          name: product.name || '',
          total: product.total || 0,
          notes: product.notes || '',
          type_id: product.type_id || undefined,
          character_id: product.character_id || undefined,
        }}
      >
        <Form.Item label="制品名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="输入制品名称" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Form.Item label="总数" name="total" rules={[{ required: true, message: '请输入总数' }]} style={{ flex: 1, minWidth: 120 }}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="总数" />
          </Form.Item>
          <Form.Item label="已兑换" style={{ flex: 1, minWidth: 120 }}>
            <InputNumber value={product.exchanged || 0} disabled style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="剩余" style={{ flex: 1, minWidth: 120 }}>
            <InputNumber value={product.remaining ?? 0} disabled style={{ width: '100%' }} />
          </Form.Item>
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
        <Form.Item label="备注" name="notes">
          <Input placeholder="选填" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
