import { useState, useEffect } from 'react';
import { Button, InputNumber, Input, Popconfirm, App, Select, Space, Tooltip, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined, PictureOutlined, SettingOutlined } from '@ant-design/icons';
import { api } from '../api';
import SortableTable, { DragHandle } from '../components/SortableTable';
import EditOptionsModal from '../components/EditOptionsModal';

export default function ProductStats({ products, onUpdate, onImageModal }) {
  const { message } = App.useApp();
  const [types, setTypes] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [editingOptions, setEditingOptions] = useState(null); // 'type' | 'character'
  const [groupBy, setGroupBy] = useState(null); // null | 'type_id' | 'character_id'

  const loadOptions = async () => {
    const [t, c] = await Promise.all([api.getProductTypes(), api.getCharacters()]);
    setTypes(t);
    setCharacters(c);
  };

  useEffect(() => { loadOptions(); }, []);

  const handleUpdate = async (id, field, value) => {
    await api.updateProduct(id, { [field]: value });
    onUpdate();
  };

  const handleDelete = async (id) => {
    await api.deleteProduct(id);
    message.success('已删除');
    onUpdate();
  };

  const handleImageClick = async (product) => {
    const images = await api.getProductImages(product.id);
    onImageModal({
      type: 'product', targetId: product.id, targetName: product.name,
      images, currentIndex: 0,
    });
  };

  const handleAddRow = async (defaults = {}) => {
    await api.createProduct({ name: '新制品', total: 0, notes: '', ...defaults });
    onUpdate();
  };

  const renderGroupFooter = (groupBy, key) => {
    const parsed = key === '__none__' ? null : parseInt(key);
    const defaults = key === '__none__' ? { [groupBy]: null } : { [groupBy]: isNaN(parsed) ? key : parsed };
    return (
      <Button type="dashed" block icon={<PlusOutlined />} onClick={() => handleAddRow(defaults)}>添加一行</Button>
    );
  };

  const handleReorder = async (next) => {
    const order = next.map((p, i) => ({ id: p.id, sort_order: i + 1 }));
    await api.reorderProducts(order);
    onUpdate();
  };

  const optionSelect = (list, value, onChange) => (
    <Select
      variant="borderless"
      allowClear
      value={value || undefined}
      placeholder="—"
      style={{ width: '100%' }}
      options={list.map(o => ({ value: o.id, label: o.name }))}
      onChange={onChange}
    />
  );

  const headerWithSetting = (label, target) => (
    <span>
      {label}{' '}
      <Tooltip title="编辑选项">
        <Button size="small" type="text" icon={<SettingOutlined />} onClick={(e) => { e.stopPropagation(); setEditingOptions(target); }} />
      </Tooltip>
    </span>
  );

  const columns = [
    { key: 'sort', width: 40, align: 'center', render: () => <DragHandle /> },
    {
      title: '预览图',
      dataIndex: 'cover_image',
      key: 'cover_image',
      width: 90,
      render: (cover, record) => (
        <div className="preview-thumb" onClick={() => handleImageClick(record)}>
          {cover ? <img src={cover.data} alt="" /> : <PictureOutlined style={{ fontSize: 22, color: '#bbb' }} />}
        </div>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 180,
      render: (v, r) => (
        <Input variant="borderless" defaultValue={v}
          onBlur={(e) => { if (e.target.value !== v) handleUpdate(r.id, 'name', e.target.value); }}
          onPressEnter={(e) => e.target.blur()} />
      ),
    },
    {
      title: headerWithSetting('制品类型', 'type'),
      dataIndex: 'type_id',
      width: 140,
      sorter: (a, b) => {
        const ai = types.findIndex(t => t.id === a.type_id);
        const bi = types.findIndex(t => t.id === b.type_id);
        return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
      },
      render: (v, r) => optionSelect(types, v, (val) => handleUpdate(r.id, 'type_id', val ?? null)),
    },
    {
      title: headerWithSetting('角色', 'character'),
      dataIndex: 'character_id',
      width: 140,
      sorter: (a, b) => {
        const ai = characters.findIndex(c => c.id === a.character_id);
        const bi = characters.findIndex(c => c.id === b.character_id);
        return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
      },
      render: (v, r) => optionSelect(characters, v, (val) => handleUpdate(r.id, 'character_id', val ?? null)),
    },
    {
      title: '剩余',
      dataIndex: 'remaining',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.remaining || 0) - (b.remaining || 0),
      render: (v) => {
        if (v < 0) {
          return (
            <Tooltip title="超额：已兑换数量大于总数">
              <Tag color="red" style={{ fontWeight: 700, fontSize: 14, border: '1px solid #dc2626' }}>{v} ⚠</Tag>
            </Tooltip>
          );
        }
        return <Tag color={v < 5 ? 'red' : 'default'} style={{ fontWeight: 600, fontSize: 14 }}>{v}</Tag>;
      },
    },
    {
      title: '总数',
      dataIndex: 'total',
      width: 110,
      align: 'center',
      sorter: (a, b) => (a.total || 0) - (b.total || 0),
      render: (v, r) => (
        <InputNumber
          key={`total-${r.id}-${v}`}
          min={0}
          variant="borderless"
          defaultValue={v}
          onBlur={(e) => {
            const n = parseInt(e.target.value);
            if (!isNaN(n) && n !== v) handleUpdate(r.id, 'total', n);
          }}
        />
      ),
    },
    {
      title: '已兑换',
      dataIndex: 'exchanged',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.exchanged || 0) - (b.exchanged || 0),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      width: 200,
      render: (v, r) => (
        <Input variant="borderless" placeholder="备注" defaultValue={v || ''}
          onBlur={(e) => { if (e.target.value !== (v || '')) handleUpdate(r.id, 'notes', e.target.value); }}
          onPressEnter={(e) => e.target.blur()} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, r) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} okText="删除" cancelText="取消">
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const groupOptions = [
    { value: null, label: '不分组' },
    { value: 'type_id', label: '按制品类型' },
    { value: 'character_id', label: '按角色' },
  ];

  const getGroupLabel = (key, field) => {
    const list = field === 'type_id' ? types : characters;
    return list.find(o => String(o.id) === key)?.name || '（未分类）';
  };

  const groupSorter = (a, b, field) => {
    const list = field === 'type_id' ? types : characters;
    if (a === '__none__') return 1;
    if (b === '__none__') return -1;
    const ai = list.findIndex(o => String(o.id) === a);
    const bi = list.findIndex(o => String(o.id) === b);
    return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <span>分组：</span>
        <Select
          value={groupBy}
          options={groupOptions}
          onChange={setGroupBy}
          style={{ width: 160 }}
        />
      </Space>

      <SortableTable
        columns={columns}
        dataSource={products}
        onReorder={handleReorder}
        groupBy={groupBy}
        getGroupLabel={getGroupLabel}
        groupSorter={groupSorter}
        groupFooter={renderGroupFooter}
        storageKey="products"
        pagination={false}
        bordered
        size="middle"
        scroll={{ x: 'max-content' }}
        footer={() => (
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => handleAddRow()}>添加一行</Button>
        )}
      />

      {editingOptions === 'type' && (
        <EditOptionsModal
          title="编辑制品类型"
          fetchAll={api.getProductTypes}
          create={api.createProductType}
          update={api.updateProductType}
          remove={api.deleteProductType}
          reorder={api.reorderProductTypes}
          onClose={() => setEditingOptions(null)}
          onSaved={() => { loadOptions(); onUpdate(); }}
        />
      )}
      {editingOptions === 'character' && (
        <EditOptionsModal
          title="编辑角色"
          fetchAll={api.getCharacters}
          create={api.createCharacter}
          update={api.updateCharacter}
          remove={api.deleteCharacter}
          reorder={api.reorderCharacters}
          onClose={() => setEditingOptions(null)}
          onSaved={() => { loadOptions(); onUpdate(); }}
        />
      )}
    </>
  );
}
