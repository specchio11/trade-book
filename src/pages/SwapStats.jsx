import { useState } from 'react';
import { Button, Input, InputNumber, Select, Checkbox, Tag, Popconfirm, App, Tooltip, Space } from 'antd';
import { DeleteOutlined, PlusOutlined, SettingOutlined, PictureOutlined, AppstoreAddOutlined, DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons';
import { api } from '../api';
import SortableTable, { DragHandle } from '../components/SortableTable';
import RegisterItemsModal from '../components/RegisterItemsModal';

const methodColor = (name) => {
  if (!name) return 'default';
  if (name.includes('音律')) return 'purple';
  if (name === 'ACF') return 'blue';
  if (name === '互寄') return 'green';
  return 'default';
};

export default function SwapStats({ swaps, products, methods, onUpdate, onEditMethods, onImageModal }) {
  const { message } = App.useApp();
  const [groupBy, setGroupBy] = useState(null);
  const [registerSwap, setRegisterSwap] = useState(null);
  const [itemsCollapsed, setItemsCollapsed] = useState(() => {
    try {
      const v = localStorage.getItem('swapItemsCollapsed');
      return v === null ? true : v === '1';
    } catch { return true; }
  });
  const toggleCollapsed = () => {
    setItemsCollapsed(v => {
      try { localStorage.setItem('swapItemsCollapsed', v ? '0' : '1'); } catch { /* noop */ }
      return !v;
    });
  };

  const handleUpdate = async (id, field, value) => {
    await api.updateSwap(id, { [field]: value });
    onUpdate();
  };

  const handleItemQtyChange = async (swap, productId, newQty) => {
    const product = products.find(p => p.id === productId);
    const existing = swap.items?.find(i => i.product_id === productId);
    const oldQty = existing?.quantity || 0;
    const delta = (newQty || 0) - oldQty;
    if (product && product.remaining - delta < 0) {
      message.error(`余量不足（剩余 ${product.remaining}，已约 ${oldQty}）`);
      return;
    }
    const items = products.map(p => {
      const ex = swap.items?.find(i => i.product_id === p.id);
      return {
        product_id: p.id,
        quantity: p.id === productId ? (newQty || 0) : (ex?.quantity || 0),
      };
    });
    await api.updateSwapItems(swap.id, items);
    onUpdate();
  };

  const handleDelete = async (id) => {
    await api.deleteSwap(id);
    message.success('已删除');
    onUpdate();
  };

  const handleAddRow = async (defaults = {}) => {
    const created = await api.createSwap({
      nickname: '', qq: '',
      swap_method_id: null,
      received_product: '', notes: '', items: [], images: [],
      ...defaults,
    });
    onUpdate();
    setRegisterSwap({ ...created, items: [] });
  };

  const renderGroupFooter = (gb, key) => {
    let defaults = {};
    if (gb === 'is_packed' || gb === 'is_swapped') {
      defaults[gb] = key === 'true';
    } else if (gb === 'swap_method_id') {
      defaults.swap_method_id = key === '__none__' ? null : parseInt(key);
    } else {
      defaults[gb] = key === '__none__' ? null : key;
    }
    return (
      <Button type="dashed" block icon={<PlusOutlined />} onClick={() => handleAddRow(defaults)}>添加一行</Button>
    );
  };

  const openSwapImages = async (swap) => {
    const images = await api.getSwapImages(swap.id);
    onImageModal({
      type: 'swap', targetId: swap.id, targetName: swap.nickname,
      images, currentIndex: 0,
    });
  };

  const handleReorder = async (next) => {
    const order = next.map((s, i) => ({ id: s.id, sort_order: i + 1 }));
    await api.reorderSwaps(order);
    onUpdate();
  };

  const columns = [
    { key: 'sort', width: 40, fixed: 'left', align: 'center', render: () => <DragHandle /> },
    {
      title: '昵称', dataIndex: 'nickname', width: 140, fixed: 'left',
      render: (v, r) => (
        <Input variant="borderless" defaultValue={v}
          onBlur={(e) => { if (e.target.value !== v) handleUpdate(r.id, 'nickname', e.target.value); }}
          onPressEnter={(e) => e.target.blur()} />
      ),
    },
    {
      title: 'QQ', dataIndex: 'qq', width: 140, fixed: 'left',
      render: (v, r) => (
        <Input variant="borderless" defaultValue={v}
          onBlur={(e) => { if (e.target.value !== v) handleUpdate(r.id, 'qq', e.target.value); }}
          onPressEnter={(e) => e.target.blur()} />
      ),
    },
    {
      title: (
        <span>
          互换方式{' '}
          <Tooltip title="编辑互换方式">
            <Button size="small" type="text" icon={<SettingOutlined />} onClick={(e) => { e.stopPropagation(); onEditMethods(); }} />
          </Tooltip>
        </span>
      ),
      dataIndex: 'swap_method_id', width: 160,
      sorter: (a, b) => {
        const ai = methods.findIndex(m => m.id === a.swap_method_id);
        const bi = methods.findIndex(m => m.id === b.swap_method_id);
        return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
      },
      render: (v, r) => (
        <Select variant="borderless" value={v || undefined} placeholder="选择" style={{ width: '100%' }}
          options={methods.map(m => ({ value: m.id, label: <Tag color={methodColor(m.name)}>{m.name}</Tag> }))}
          onChange={(val) => handleUpdate(r.id, 'swap_method_id', val)} />
      ),
    },
    {
      title: '已包装', dataIndex: 'is_packed', width: 80, align: 'center',
      sorter: (a, b) => Number(a.is_packed) - Number(b.is_packed),
      render: (v, r) => <Checkbox checked={v} onChange={(e) => handleUpdate(r.id, 'is_packed', e.target.checked)} />,
    },
    {
      title: '已互换', dataIndex: 'is_swapped', width: 80, align: 'center',
      sorter: (a, b) => Number(a.is_swapped) - Number(b.is_swapped),
      render: (v, r) => <Checkbox checked={v} onChange={(e) => handleUpdate(r.id, 'is_swapped', e.target.checked)} />,
    },
    {
      title: '对方互换制品', dataIndex: 'received_product', width: 160,
      render: (v, r) => (
        <Input variant="borderless" placeholder="—" defaultValue={v || ''}
          onBlur={(e) => { if (e.target.value !== (v || '')) handleUpdate(r.id, 'received_product', e.target.value); }}
          onPressEnter={(e) => e.target.blur()} />
      ),
    },
    {
      title: '对方制品图', dataIndex: 'cover_image', width: 80, align: 'center',
      render: (cover, r) => (
        <div className="preview-thumb" onClick={() => openSwapImages(r)}>
          {cover ? <img src={cover.data} alt="" /> : <PictureOutlined style={{ fontSize: 22, color: '#bbb' }} />}
        </div>
      ),
    },
    {
      title: '地址', dataIndex: 'address', width: 220,
      render: (v, r) => (
        <Input variant="borderless" placeholder="互寄地址" defaultValue={v || ''}
          onBlur={(e) => { if (e.target.value !== (v || '')) handleUpdate(r.id, 'address', e.target.value); }}
          onPressEnter={(e) => e.target.blur()} />
      ),
    },
    {
      title: '备注', dataIndex: 'notes', width: 160,
      render: (v, r) => (
        <Input variant="borderless" placeholder="—" defaultValue={v || ''}
          onBlur={(e) => { if (e.target.value !== (v || '')) handleUpdate(r.id, 'notes', e.target.value); }}
          onPressEnter={(e) => e.target.blur()} />
      ),
    },
    ...(products.length > 0 ? [
      itemsCollapsed
        ? {
            title: '互换制品',
            key: 'items_collapsed',
            width: 140,
            align: 'center',
            render: (_, r) => {
              const total = (r.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
              const kinds = (r.items || []).filter(it => it.quantity > 0).length;
              return (
                <Tooltip title="点击详情可登记制品">
                  <Button type="link" size="small" onClick={() => setRegisterSwap(r)}>
                    {total > 0 ? `${kinds} 种 / 共 ${total}` : '未登记'}
                  </Button>
                </Tooltip>
              );
            },
          }
        : {
            title: '互换制品',
            children: [...products]
              .sort((a, b) => {
                const at = a.type_sort ?? Infinity;
                const bt = b.type_sort ?? Infinity;
                if (at !== bt) return at - bt;
                return (a.sort_order ?? 0) - (b.sort_order ?? 0);
              })
              .map(p => ({
                title: (
                  <div style={{ textAlign: 'center' }}>
                    <div>{p.name}</div>
                    <Tag color={p.remaining < 5 ? 'red' : 'default'} style={{ marginTop: 2 }}>余{p.remaining}</Tag>
                  </div>
                ),
                key: `p_${p.id}`, width: 110, align: 'center',
                render: (_, r) => {
                  const item = r.items?.find(i => i.product_id === p.id);
                  return (
                    <InputNumber min={0} variant="borderless" placeholder="—"
                      value={item?.quantity || undefined}
                      onBlur={(e) => {
                        const n = e.target.value === '' ? 0 : parseInt(e.target.value);
                        if (!isNaN(n) && n !== (item?.quantity || 0)) handleItemQtyChange(r, p.id, n);
                      }}
                      style={{ width: '100%' }} />
                  );
                },
              })),
          }
    ] : []),
    {
      title: '操作', key: 'action', width: 110, align: 'center', fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Tooltip title="只登记互换制品信息">
            <Button type="text" icon={<AppstoreAddOutlined />} onClick={() => setRegisterSwap(r)} />
          </Tooltip>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} okText="删除" cancelText="取消">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const groupOptions = [
    { value: null, label: '不分组' },
    { value: 'swap_method_id', label: '按互换方式' },
    { value: 'is_packed', label: '按是否包装' },
    { value: 'is_swapped', label: '按是否已互换' },
  ];

  const getGroupLabel = (key, field) => {
    if (field === 'swap_method_id') {
      return methods.find(m => String(m.id) === key)?.name || '（未选择）';
    }
    if (field === 'is_packed') return key === 'true' ? '已包装' : '未包装';
    if (field === 'is_swapped') return key === 'true' ? '已互换' : '未互换';
    return key;
  };

  const groupSorter = (a, b, field) => {
    if (field === 'swap_method_id') {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      const ai = methods.findIndex(m => String(m.id) === a);
      const bi = methods.findIndex(m => String(m.id) === b);
      return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
    }
    if (field === 'is_packed' || field === 'is_swapped') {
      // 未完成 在前，已完成 在后
      const order = (k) => k === 'false' ? 0 : (k === 'true' ? 1 : 2);
      return order(a) - order(b);
    }
    return 0;
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Space wrap>
          <span>分组：</span>
          <Select value={groupBy} options={groupOptions} onChange={setGroupBy} style={{ width: 180 }} />
          {products.length > 0 && (
            <Button
              icon={itemsCollapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
              onClick={toggleCollapsed}
            >
              {itemsCollapsed ? '展开互换制品列' : '折叠互换制品列'}
            </Button>
          )}
        </Space>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Tag color="blue" style={{ fontSize: 13, padding: '2px 8px', margin: 0 }}>共 {swaps.length} 人</Tag>
          {methods.map(m => {
            const count = swaps.filter(s => s.swap_method_id === m.id).length;
            if (count === 0) return null;
            return (
              <Tag key={m.id} color={methodColor(m.name)} style={{ fontSize: 13, padding: '2px 8px', margin: 0 }}>
                {m.name} {count}
              </Tag>
            );
          })}
          {(() => {
            const noneCount = swaps.filter(s => !s.swap_method_id).length;
            return noneCount > 0
              ? <Tag style={{ fontSize: 13, padding: '2px 8px', margin: 0 }}>未选择 {noneCount}</Tag>
              : null;
          })()}
        </div>
      </div>

      <SortableTable
        columns={columns}
        dataSource={swaps}
        onReorder={handleReorder}
        groupBy={groupBy}
        getGroupLabel={getGroupLabel}
        groupSorter={groupSorter}
        groupFooter={renderGroupFooter}
        storageKey="swaps"
        pagination={false}
        bordered
        size="middle"
        scroll={{ x: 'max-content' }}
        footer={() => (
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => handleAddRow()}>添加一行</Button>
        )}
      />

      {registerSwap && (
        <RegisterItemsModal
          swap={registerSwap}
          products={products}
          methods={methods}
          onClose={() => setRegisterSwap(null)}
          onSaved={onUpdate}
        />
      )}
    </>
  );
}
