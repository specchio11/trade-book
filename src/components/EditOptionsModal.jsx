import { useState, useEffect } from 'react';
import { Modal, Button, Input, Space, Popconfirm, Divider, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';

export default function EditOptionsModal({
  title,
  fetchAll,
  create,
  update,
  remove,
  reorder,
  onClose,
  onSaved,
}) {
  const [items, setItems] = useState([]);
  const [newName, setNewName] = useState('');

  const refresh = async () => {
    const updated = await fetchAll();
    setItems(updated);
    onSaved && onSaved();
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const add = async () => {
    if (!newName.trim()) return;
    await create(newName.trim());
    setNewName('');
    await refresh();
  };

  const del = async (id) => {
    await remove(id);
    await refresh();
  };

  const rename = async (id, name) => {
    if (!name.trim()) return;
    await update(id, name.trim());
    await refresh();
  };

  const move = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const arr = [...items];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const order = arr.map((m, k) => ({ id: m.id, sort_order: k + 1 }));
    await reorder(order);
    setItems(arr);
    onSaved && onSaved();
  };

  return (
    <Modal
      open
      centered
      title={title}
      onCancel={onClose}
      onOk={onClose}
      okText="完成"
      cancelButtonProps={{ style: { display: 'none' } }}
      maskClosable={false}
      width={460}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {items.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Space.Compact>
              <Button size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, -1)} />
              <Button size="small" icon={<ArrowDownOutlined />} disabled={i === items.length - 1} onClick={() => move(i, 1)} />
            </Space.Compact>
            <span style={{ width: 24, textAlign: 'center', color: '#999' }}>{i + 1}</span>
            <Input
              defaultValue={m.name}
              onBlur={(e) => { if (e.target.value !== m.name) rename(m.id, e.target.value); }}
              onPressEnter={(e) => e.target.blur()}
            />
            <Popconfirm title="确定删除？" onConfirm={() => del(m.id)} okText="删除" cancelText="取消">
              <Button danger type="text" icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
        ))}
        {items.length === 0 && <Typography.Text type="secondary">暂无选项</Typography.Text>}
      </Space>

      <Divider />

      <Typography.Text strong>添加新选项</Typography.Text>
      <Space.Compact style={{ width: '100%', marginTop: 8 }}>
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="输入名称"
          onPressEnter={add}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={add} disabled={!newName.trim()}>添加</Button>
      </Space.Compact>
    </Modal>
  );
}
