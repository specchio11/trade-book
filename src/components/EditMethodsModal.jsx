import { useState } from 'react';
import { Modal, Button, Input, Tag, Space, Popconfirm, Divider, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../api';

const chipColor = (name) => {
  if (name?.includes('音律')) return 'purple';
  if (name === 'ACF') return 'blue';
  if (name === '互寄') return 'green';
  return 'default';
};

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
    await api.updateMethod(id, name.trim());
    await refresh();
  };

  return (
    <Modal
      open
      title="编辑互换方式"
      onCancel={onClose}
      onOk={onClose}
      okText="完成"
      cancelButtonProps={{ style: { display: 'none' } }}
      maskClosable={false}
      width={520}
    >
      <Typography.Paragraph type="secondary">管理互换方式选项，排序决定表格排列顺序</Typography.Paragraph>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {methods.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Space.Compact>
              <Button size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => moveUp(i)} />
              <Button size="small" icon={<ArrowDownOutlined />} disabled={i === methods.length - 1} onClick={() => moveDown(i)} />
            </Space.Compact>
            <span style={{ width: 24, textAlign: 'center', color: '#999' }}>{i + 1}</span>
            <Input
              defaultValue={m.name}
              prefix={<Tag color={chipColor(m.name)} style={{ margin: 0 }}>·</Tag>}
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
