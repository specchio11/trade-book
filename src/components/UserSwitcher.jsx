import { useState, useEffect } from 'react';
import { Modal, Dropdown, Avatar, Button, Input, List, Popconfirm, Divider, Space, Typography } from 'antd';
import { UserOutlined, PlusOutlined, DeleteOutlined, DownOutlined } from '@ant-design/icons';
import { api, getCurrentUserId, setCurrentUserId } from '../api';

export default function UserSwitcher({ onUserChange }) {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [currentId, setCurrentId] = useState(getCurrentUserId());

  const switchTo = (id) => {
    setCurrentUserId(id);
    setCurrentId(id);
    onUserChange();
  };

  const loadUsers = async () => {
    const u = await api.getUsers();
    setUsers(u);
    if (u.length > 0 && !u.find(x => x.id === currentId)) {
      switchTo(u[0].id);
    }
  };

  useEffect(() => { loadUsers(); /* eslint-disable-next-line */ }, []);

  const addUser = async () => {
    if (!newName.trim()) return;
    const user = await api.createUser(newName.trim());
    setNewName('');
    await loadUsers();
    switchTo(user.id);
  };

  const deleteUser = async (id) => {
    await api.deleteUser(id);
    await loadUsers();
  };

  const currentUser = users.find(u => u.id === currentId);

  const items = [
    ...users.map(u => ({
      key: String(u.id),
      label: (
        <Space>
          <Avatar size="small" style={{ background: u.id === currentId ? '#7c3aed' : '#bbb' }}>{u.name[0]}</Avatar>
          {u.name}
        </Space>
      ),
      onClick: () => switchTo(u.id),
    })),
    { type: 'divider' },
    {
      key: 'manage',
      label: '管理用户...',
      onClick: () => { setShowModal(true); loadUsers(); },
    },
  ];

  return (
    <>
      <Dropdown menu={{ items }} trigger={['click']}>
        <Button>
          <Space>
            <Avatar size="small" style={{ background: '#7c3aed' }}>{currentUser?.name?.[0] || '?'}</Avatar>
            {currentUser?.name || '加载中'}
            <DownOutlined />
          </Space>
        </Button>
      </Dropdown>

      <Modal
        open={showModal}
        title="管理用户"
        onCancel={() => setShowModal(false)}
        footer={null}
        maskClosable={false}
        width={460}
      >
        <Typography.Paragraph type="secondary">每个用户的数据互相独立</Typography.Paragraph>
        <List
          dataSource={users}
          renderItem={(u) => (
            <List.Item
              actions={[
                u.id !== currentId && <Button key="switch" size="small" onClick={() => { switchTo(u.id); setShowModal(false); }}>切换</Button>,
                users.length > 1 && (
                  <Popconfirm key="del" title="删除用户将同时删除其所有数据，确定？" onConfirm={() => deleteUser(u.id)} okText="删除" cancelText="取消">
                    <Button danger type="text" icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={<Avatar style={{ background: u.id === currentId ? '#7c3aed' : '#bbb' }}>{u.name[0]}</Avatar>}
                title={<>{u.name}{u.id === currentId && <Typography.Text type="secondary"> （当前）</Typography.Text>}</>}
              />
            </List.Item>
          )}
        />
        <Divider />
        <Typography.Text strong>添加用户</Typography.Text>
        <Space.Compact style={{ width: '100%', marginTop: 8 }}>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="输入用户名"
            onPressEnter={addUser}
            prefix={<UserOutlined />}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={addUser} disabled={!newName.trim()}>添加</Button>
        </Space.Compact>
      </Modal>
    </>
  );
}
