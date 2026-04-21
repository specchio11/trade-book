import { useState, useRef } from 'react';
import { Select, Divider, Input, Space, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

export default function CreatableSelect({ options, value, onChange, onCreate, placeholder, variant, allowClear = true, style }) {
  const [searchValue, setSearchValue] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef(null);

  const handleAdd = async () => {
    const name = searchValue.trim();
    if (!name) return;
    setAdding(true);
    try {
      const newId = await onCreate(name);
      setSearchValue('');
      onChange(newId);
    } finally {
      setAdding(false);
    }
  };

  const hasExactMatch = options.some(o => o.label === searchValue.trim());

  return (
    <Select
      showSearch
      filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
      variant={variant}
      allowClear={allowClear}
      value={value || undefined}
      placeholder={placeholder}
      style={style || { width: '100%' }}
      options={options}
      onChange={onChange}
      searchValue={searchValue}
      onSearch={setSearchValue}
      dropdownRender={(menu) => (
        <>
          {menu}
          {searchValue.trim() && !hasExactMatch && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <div style={{ padding: '4px 8px' }}>
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  loading={adding}
                  onClick={handleAdd}
                  block
                  style={{ textAlign: 'left' }}
                >
                  新建「{searchValue.trim()}」
                </Button>
              </div>
            </>
          )}
        </>
      )}
    />
  );
}
