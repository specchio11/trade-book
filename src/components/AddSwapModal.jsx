import { useState } from 'react';
import { Modal, Form, Input, Radio, InputNumber, Divider, Tag, Typography } from 'antd';
import { api } from '../api';
import ImageUploadZone from './ImageUploadZone';

export default function AddSwapModal({ products, methods, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [quantities, setQuantities] = useState({});
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const setQty = (productId, val) => {
    const product = products.find(p => p.id === productId);
    if (product && val != null && val > product.remaining) val = product.remaining;
    setQuantities(prev => ({ ...prev, [productId]: val }));
  };

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    setSubmitting(true);
    try {
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty && qty > 0)
        .map(([product_id, quantity]) => ({ product_id: parseInt(product_id), quantity }));
      await api.createSwap({
        nickname: values.nickname.trim(),
        qq: values.qq.trim(),
        swap_method_id: values.method || null,
        received_product: values.received || '',
        notes: values.notes || '',
        items,
        images,
      });
      onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title="添加互换"
      onCancel={onClose}
      onOk={handleSubmit}
      okText="确认添加"
      cancelText="取消"
      okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
      confirmLoading={submitting}
      maskClosable={false}
      width={640}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <Form form={form} layout="vertical" initialValues={{ method: methods[0]?.id }} requiredMark>
        <Form.Item label="昵称" name="nickname" rules={[{ required: true, message: '请输入昵称' }]}>
          <Input placeholder="输入互换人昵称" />
        </Form.Item>
        <Form.Item label="QQ 号" name="qq" rules={[{ required: true, message: '请输入 QQ' }, { pattern: /^\d+$/, message: '只能是数字' }]}>
          <Input placeholder="纯数字" inputMode="numeric" />
        </Form.Item>
        <Form.Item label="互换方式" name="method" rules={[{ required: true }]}>
          <Radio.Group>
            {methods.map(m => <Radio key={m.id} value={m.id}>{m.name}</Radio>)}
          </Radio.Group>
        </Form.Item>

        <Divider />

        <Typography.Text strong>互换制品</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>不需要的留空即可</Typography.Paragraph>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {products.map(p => {
            const disabled = p.remaining <= 0;
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: disabled ? 0.5 : 1 }}>
                <span style={{ flex: 1 }}>{p.name}</span>
                <Tag color={p.remaining < 5 ? 'red' : 'default'}>余 {p.remaining}</Tag>
                <InputNumber
                  min={0}
                  max={p.remaining}
                  value={quantities[p.id]}
                  onChange={(v) => setQty(p.id, v)}
                  placeholder="0"
                  disabled={disabled}
                  style={{ width: 100 }}
                />
              </div>
            );
          })}
        </div>

        <Divider />

        <Form.Item label="收到制品" name="received">
          <Input placeholder="对方给我的制品名称" />
        </Form.Item>
        <Form.Item label="收到图片">
          <ImageUploadZone images={images} onChange={setImages} small />
        </Form.Item>
        <Form.Item label="备注" name="notes">
          <Input placeholder="选填" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
