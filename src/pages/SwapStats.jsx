import { useState, useEffect } from 'react';
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

// Inline editor that stays in sync with external value changes (e.g. modal saves)
function InlineEdit({ value, onCommit, placeholder }) {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);
  return (
    <Input
      variant="borderless"
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== (value || '')) onCommit(local); }}
      onPressEnter={(e) => e.target.blur()}
    />
  );
}

export default function SwapStats({ swaps, products, methods, onUpdate, onReloadSwap, onReloadProduct, onAppendSwap, onRemoveSwap, onPatchSwap, onPatchProduct, onReorderSwapsLocal, onEditMethods, onImageModal, showAddSwap, onCloseAddSwap }) {
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

  // When top-right add button triggers, open RegisterItemsModal in add mode
  useEffect(() => {
    if (showAddSwap) {
      handleAddRow();
      onCloseAddSwap();
    }
  }, [showAddSwap]);

  // Optimistic: patch local state, then fire-and-forget the network call. On error, refetch.
  const handleUpdate = (id, field, value) => {
    onPatchSwap({ id, [field]: value });
    api.updateSwap(id, { [field]: value }).catch(() => {
      message.error('保存失败');
      onReloadSwap(id);
    });
  };

  const handleItemQtyChange = (swap, productId, newQty) => {
    const product = products.find(p => p.id === productId);
    const existing = swap.items?.find(i => i.product_id === productId);
    const oldQty = existing?.quantity || 0;
    const delta = (newQty || 0) - oldQty;
    if (product && product.remaining - delta < 0) {
      message.error(`余量不足（剩余 ${product.remaining}，已约 ${oldQty}）`);
      return;
    }
    // Optimistic patches
    const nextItems = (swap.items || []).filter(i => i.product_id !== productId);
    if ((newQty || 0) > 0) nextItems.push({ swap_id: swap.id, product_id: productId, quantity: newQty, product_name: product?.name });
    onPatchSwap({ id: swap.id, items: nextItems });
    if (product) onPatchProduct({ id: productId, remaining: product.remaining - delta, exchanged: (product.exchanged || 0) + delta });
    const items = products.map(p => {
      const ex = nextItems.find(i => i.product_id === p.id);
      return { product_id: p.id, quantity: ex?.quantity || 0 };
    });
    api.updateSwapItems(swap.id, items).catch(() => {
      message.error('保存失败');
      onReloadSwap(swap.id);
      onReloadProduct(productId);
    });
  };

  const handleDelete = async (id) => {
    const swap = swaps.find(s => s.id === id);
    const affectedProductIds = (swap?.items || []).map(it => it.product_id);
    onRemoveSwap(id);
    try {
      await api.deleteSwap(id);
      message.success('已删除');
      affectedProductIds.forEach(pid => onReloadProduct(pid));
    } catch {
      message.error('删除失败');
      onUpdate();
    }
  };

  const handleAddRow = (defaults = {}) => {
    setRegisterSwap({
      nickname: '',
      qq: '',
      swap_method_id: null,
      received_product: '',
      notes: '',
      address: '',
      items: [],
      ...defaults,
    });
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
    onReorderSwapsLocal(next);
    const order = next.map((s, i) => ({ id: s.id, sort_order: i + 1 }));
    await api.reorderSwaps(order);
  };

  const columns = [
    { key: 'sort', width: 40, fixed: 'left', align: 'center', render: () => <DragHandle /> },
    {
      title: '昵称', dataIndex: 'nickname', width: 140, fixed: 'left',
      render: (v, r) => <InlineEdit value={v} onCommit={(val) => handleUpdate(r.id, 'nickname', val)} />,
    },
    {
      title: 'QQ', dataIndex: 'qq', width: 140, fixed: 'left',
      render: (v, r) => <InlineEdit value={v} onCommit={(val) => handleUpdate(r.id, 'qq', val)} />,
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
      defaultSortOrder: 'ascend',
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
      render: (v, r) => <InlineEdit value={v} placeholder="—" onCommit={(val) => handleUpdate(r.id, 'received_product', val)} />,
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
      render: (v, r) => <InlineEdit value={v} placeholder="互寄地址" onCommit={(val) => handleUpdate(r.id, 'address', val)} />,
    },
    {
      title: '备注', dataIndex: 'notes', width: 160,
      render: (v, r) => <InlineEdit value={v} placeholder="—" onCommit={(val) => handleUpdate(r.id, 'notes', val)} />,
    },
    ...(products.length > 0 ? [
      itemsCollapsed
        ? {
            title: (
              <Space size={4}>
                <span>互换制品</span>
                <Tooltip title="展开制品列">
                  <Button size="small" type="text" icon={<DoubleRightOutlined />} onClick={(e) => { e.stopPropagation(); toggleCollapsed(); }} />
                </Tooltip>
              </Space>
            ),
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
            title: (
              <Space size={4}>
                <span>互换制品</span>
                <Tooltip title="折叠制品列">
                  <Button size="small" type="text" icon={<DoubleLeftOutlined />} onClick={(e) => { e.stopPropagation(); toggleCollapsed(); }} />
                </Tooltip>
              </Space>
            ),
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
        dataSource={[...swaps].sort((a, b) => {
          const ai = methods.findIndex(m => m.id === a.swap_method_id);
          const bi = methods.findIndex(m => m.id === b.swap_method_id);
          return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
        })}
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
          onCreated={(newId, affectedProductIds) => {
            onAppendSwap(newId);
            affectedProductIds.forEach(pid => onReloadProduct(pid));
          }}
          onUpdated={(swapId, affectedProductIds) => {
            onReloadSwap(swapId);
            affectedProductIds.forEach(pid => onReloadProduct(pid));
          }}
        />
      )}
    </>
  );
}
