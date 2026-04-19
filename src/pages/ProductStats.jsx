import { Table, Button, InputNumber, Input, Popconfirm, App } from 'antd';
import { DeleteOutlined, PlusOutlined, PictureOutlined } from '@ant-design/icons';
import { api } from '../api';

export default function ProductStats({ products, onUpdate, onImageModal }) {
  const { message } = App.useApp();

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

  const handleAddRow = async () => {
    await api.createProduct({ name: '新制品', total: 0, notes: '' });
    onUpdate();
  };

  const columns = [
    {
      title: '预览图',
      dataIndex: 'cover_image',
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
      render: (v, r) => (
        <Input
          variant="borderless"
          defaultValue={v}
          onBlur={(e) => { if (e.target.value !== v) handleUpdate(r.id, 'name', e.target.value); }}
          onPressEnter={(e) => e.target.blur()}
        />
      ),
    },
    {
      title: '剩余',
      dataIndex: 'remaining',
      width: 80,
      align: 'center',
      render: (v) => <span style={{ color: v < 5 ? '#dc2626' : 'inherit', fontWeight: 600 }}>{v}</span>,
    },
    {
      title: '总数',
      dataIndex: 'total',
      width: 110,
      align: 'center',
      render: (v, r) => (
        <InputNumber
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
    },
    {
      title: '备注',
      dataIndex: 'notes',
      render: (v, r) => (
        <Input
          variant="borderless"
          placeholder="备注"
          defaultValue={v || ''}
          onBlur={(e) => { if (e.target.value !== (v || '')) handleUpdate(r.id, 'notes', e.target.value); }}
          onPressEnter={(e) => e.target.blur()}
        />
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

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={products}
      pagination={false}
      bordered
      size="middle"
      footer={() => (
        <Button type="dashed" block icon={<PlusOutlined />} onClick={handleAddRow}>添加一行</Button>
      )}
    />
  );
}
