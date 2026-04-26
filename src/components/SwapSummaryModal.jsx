import { Modal, Typography, Tag, Empty, Divider, Button, App } from 'antd';
import { CopyOutlined, PictureOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export default function SwapSummaryModal({ swap, products, methods, onClose }) {
  const { message } = App.useApp();
  if (!swap) return null;

  const method = methods.find(m => m.id === swap.swap_method_id);
  const items = (swap.items || [])
    .filter(it => (it.quantity || 0) > 0)
    .map(it => {
      const p = products.find(pp => pp.id === it.product_id);
      return p ? { ...it, product: p } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const at = a.product.type_sort ?? Infinity;
      const bt = b.product.type_sort ?? Infinity;
      if (at !== bt) return at - bt;
      return (a.product.sort_order ?? 0) - (b.product.sort_order ?? 0);
    });

  const totalKinds = items.length;
  const totalQty = items.reduce((s, it) => s + (it.quantity || 0), 0);

  const copyAddress = async () => {
    const text = (swap.address || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制');
    } catch {
      message.error('复制失败');
    }
  };

  const Field = ({ label, children }) => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
      <Text type="secondary" style={{ minWidth: 64, flexShrink: 0 }}>{label}</Text>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );

  return (
    <Modal
      open
      centered
      title="互换发货清单"
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>关闭</Button>,
      ]}
      width={560}
    >
      <Field label="昵称">
        <Text strong>{swap.nickname || '—'}</Text>
      </Field>
      <Field label="QQ">
        <Text>{swap.qq || '—'}</Text>
      </Field>
      <Field label="互换方式">
        {method
          ? <Tag color={method.color || 'default'} style={{ margin: 0 }}>{method.name}</Tag>
          : <Text type="secondary">未选择</Text>}
      </Field>
      <Field label="地址">
        {swap.address ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1 }}>{swap.address}</div>
            <Button size="small" icon={<CopyOutlined />} onClick={copyAddress}>复制</Button>
          </div>
        ) : <Text type="secondary">—</Text>}
      </Field>

      <Divider style={{ margin: '12px 0' }} />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <Title level={5} style={{ margin: 0 }}>需发出制品</Title>
        {totalKinds > 0 && (
          <Text type="secondary">{totalKinds} 种 · 共 {totalQty} 件</Text>
        )}
      </div>

      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未登记任何制品" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(it => (
            <div
              key={it.product_id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 10px', border: '1px solid #f0f0f0', borderRadius: 8,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 6, background: '#f5f5f5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, overflow: 'hidden',
              }}>
                {it.product.cover_image
                  ? <img src={it.product.cover_image.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <PictureOutlined style={{ color: '#bbb', fontSize: 20 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong>{it.product.name}</Text>
              </div>
              <Tag color="blue" style={{ margin: 0, fontSize: 14 }}>×{it.quantity}</Tag>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
