import { useState, useEffect } from 'react';
import { Modal, Dropdown, Avatar, Button, Input, List, Popconfirm, Divider, Space, Typography } from 'antd';
import { UserOutlined, PlusOutlined, DeleteOutlined, DownOutlined, LogoutOutlined, KeyOutlined } from '@ant-design/icons';
import { api, getCurrentUserId, setCurrentUserId } from '../api';

export default function UserSwitcher({ currentUser, onUserChange, onLogout }) {
  const isAdmin = currentUser?.role === 'admin';
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentId, setCurrentId] = useState(getCurrentUserId());

  const switchTo = (id) => {
    setCurrentUserId(id);
    setCurrentId(id);
    onUserChange();
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    const u = await api.getUsers();
    setUsers(u);
  };

  useEffect(() => { if (isAdmin) loadUsers(); /* eslint-disable-next-line */ }, [isAdmin]);

  const addUser = async () => {
    if (!newName.trim() || !newPassword) return;
    const user = await api.createUser(newName.trim(), newPassword);
    setNewName('');
    setNewPassword('');
    await loadUsers();
    switchTo(user.id);
  };

  const deleteUser = async (id) => {
    await api.deleteUser(id);
    await loadUsers();
  };

  const resetPassword = async (id) => {
    const pw = prompt('输入新密码（至少4位）');
    if (!pw || pw.length < 4) return;
    await api.resetPassword(id, pw);
  };

  const viewingUser = users.find(u => u.id === currentId);
  const displayName = isAdmin && viewingUser ? viewingUser.name : currentUser.name;

  // Non-admin: just show name + logout
  if (!isAdmin) {
    return (
      <Dropdown menu={{ items: [
        { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: onLogout },
      ] }} trigger={['click']}>
        <Button>
          <Space>
            <Avatar size="small" style={{ background: '#7c3aed' }}>{currentUser.name[0]}</Avatar>
            {currentUser.name}
            <DownOutlined />
          </Space>
        </Button>
      </Dropdown>
    );
  }

  // Admin: switch users + manage
  const items = [
    ...users.map(u => ({
      key: String(u.id),
      label: (
        <Space>
          <Avatar size="small" style={{ background: u.id === currentId ? '#7c3aed' : '#bbb' }}>{u.name[0]}</Avatar>
          {u.name}
          {u.role === 'admin' && <Typography.Text type="secondary" style={{ fontSize: 11 }}>Admin</Typography.Text>}
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
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: onLogout,
    },
  ];

  return (
    <>
      <Dropdown menu={{ items }} trigger={['click']}>
        <Button>
          <Space>
            <Avatar size="small" style={{ background: '#7c3aed' }}>{displayName?.[0] || '?'}</Avatar>
            {displayName || '加载中'}
            <DownOutlined />
          </Space>
        </Button>
      </Dropdown>

      <Modal
        open={showModal}
        centered
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
                <Button key="pw" size="small" type="text" icon={<KeyOutlined />} onClick={() => resetPassword(u.id)} title="重置密码" />,
                users.length > 1 && (
                  <Popconfirm key="del" title="删除用户将同时删除其所有数据，确定？" onConfirm={() => deleteUser(u.id)} okText="删除" cancelText="取消">
                    <Button danger type="text" icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={<Avatar style={{ background: u.id === currentId ? '#7c3aed' : '#bbb' }}>{u.name[0]}</Avatar>}
                title={<>{u.name}{u.role === 'admin' && <Typography.Text type="secondary"> (Admin)</Typography.Text>}{u.id === currentId && <Typography.Text type="secondary"> — 当前查看</Typography.Text>}</>}
              />
            </List.Item>
          )}
        />
        <Divider />
        <Typography.Text strong>添加用户</Typography.Text>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="用户名"
            prefix={<UserOutlined />}
            style={{ flex: 1 }}
          />
          <Input.Password
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="密码"
            style={{ flex: 1 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={addUser} disabled={!newName.trim() || !newPassword}>添加</Button>
        </div>
      </Modal>
    </>
  );
}
