import { useState } from 'react';
import { Modal, Button, Input, Tag, Space, Popconfirm, Divider, Typography, Popover } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../api';

// Antd preset Tag colors that look good on white background.
const COLOR_PRESETS = [
  { value: '', label: '默认' },
  { value: 'red' }, { value: 'volcano' }, { value: 'orange' }, { value: 'gold' },
  { value: 'lime' }, { value: 'green' }, { value: 'cyan' }, { value: 'blue' },
  { value: 'geekblue' }, { value: 'purple' }, { value: 'magenta' },
];

const fallbackColor = (name) => {
  if (!name) return 'default';
  if (name.includes('音律')) return 'purple';
  if (name === 'ACF') return 'blue';
  if (name === '互寄') return 'green';
  return 'default';
};
const effectiveColor = (m) => m?.color || fallbackColor(m?.name);

function ColorSwatch({ color, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={color || '默认'}
      style={{
        width: 24, height: 24, padding: 0, cursor: 'pointer',
        borderRadius: '50%',
        border: selected ? '2px solid #1677ff' : '1px solid #d9d9d9',
        background: 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 0,
      }}
    >
      <Tag color={color || 'default'} style={{ width: 14, height: 14, padding: 0, margin: 0, borderRadius: '50%', display: 'block', flex: 'none' }} />
    </button>
  );
}

function ColorPickerPopover({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const content = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, width: 200 }}>
      {COLOR_PRESETS.map(p => (
        <ColorSwatch
          key={p.value || 'default'}
          color={p.value}
          selected={(value || '') === p.value}
          onClick={() => { onChange(p.value); setOpen(false); }}
        />
      ))}
    </div>
  );
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      content={content}
      title="选择颜色"
    >
      <Tag color={value || 'default'} style={{ cursor: 'pointer', margin: 0 }}>{label}</Tag>
    </Popover>
  );
}

export default function EditMethodsModal({ methods: initialMethods, onClose, onSaved }) {
  const [methods, setMethods] = useState([...initialMethods]);
  const [newName, setNewName] = useState('');

  const refresh = async () => {
    const updated = await api.getMethods();
    setMethods(updated);
    onSaved();
  };

  const addMethod = async () => {
    if (!newName.trim()) return;
    await api.createMethod(newName.trim());
    setNewName('');
    await refresh();
  };

  const deleteMethod = async (id) => {
    await api.deleteMethod(id);
    await refresh();
  };

  const reorder = async (newOrder) => {
    const order = newOrder.map((m, i) => ({ id: m.id, sort_order: i + 1 }));
    await api.reorderMethods(order);
    setMethods(newOrder);
    onSaved();
  };

  const moveUp = (i) => {
    if (i === 0) return;
    const arr = [...methods];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    reorder(arr);
  };

  const moveDown = (i) => {
    if (i === methods.length - 1) return;
    const arr = [...methods];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    reorder(arr);
  };

  const renameMethod = async (id, name) => {
    if (!name.trim()) return;
    await api.updateMethod(id, { name: name.trim() });
    await refresh();
  };

  const setColor = async (id, color) => {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, color } : m));
    await api.updateMethod(id, { color });
    onSaved();
  };

  return (
    <Modal
      open
      centered
      title="编辑互换方式"
      onCancel={onClose}
      onOk={onClose}
      okText="完成"
      cancelButtonProps={{ style: { display: 'none' } }}
      maskClosable={false}
      width={560}
    >
      <Typography.Paragraph type="secondary">管理互换方式选项，颜色与排序会同步到所有视图</Typography.Paragraph>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {methods.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Space.Compact>
              <Button size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => moveUp(i)} />
              <Button size="small" icon={<ArrowDownOutlined />} disabled={i === methods.length - 1} onClick={() => moveDown(i)} />
            </Space.Compact>
            <span style={{ width: 24, textAlign: 'center', color: '#999' }}>{i + 1}</span>
            <ColorPickerPopover
              value={effectiveColor(m) === 'default' ? '' : effectiveColor(m)}
              onChange={(c) => setColor(m.id, c)}
              label={m.name || '·'}
            />
            <Input
              defaultValue={m.name}
              onBlur={(e) => { if (e.target.value !== m.name) renameMethod(m.id, e.target.value); }}
              onPressEnter={(e) => e.target.blur()}
            />
            <Popconfirm title="删除后，使用该方式的互换记录会失去关联。确定？" onConfirm={() => deleteMethod(m.id)} okText="删除" cancelText="取消">
              <Button danger type="text" icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
        ))}
      </Space>

      <Divider />

      <Typography.Text strong>添加新选项</Typography.Text>
      <Space.Compact style={{ width: '100%', marginTop: 8 }}>
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="输入互换方式名称"
          onPressEnter={addMethod}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={addMethod} disabled={!newName.trim()}>添加</Button>
      </Space.Compact>
    </Modal>
  );
}
