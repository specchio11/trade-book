import React, { useState, useEffect } from 'react';
import { HolderOutlined } from '@ant-design/icons';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Table, Button, Collapse, Typography } from 'antd';
import { Resizable } from 'react-resizable';

const RowContext = React.createContext({});

export function DragHandle() {
  const { setActivatorNodeRef, listeners } = React.useContext(RowContext);
  return (
    <Button
      type="text"
      size="small"
      icon={<HolderOutlined />}
      style={{ cursor: 'move' }}
      ref={setActivatorNodeRef}
      {...listeners}
    />
  );
}

function Row({ children, ...props }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: props['data-row-key'] });
  const style = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' } : {}),
  };
  const ctx = React.useMemo(() => ({ setActivatorNodeRef, listeners }), [setActivatorNodeRef, listeners]);
  return (
    <RowContext.Provider value={ctx}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes}>
        {children}
      </tr>
    </RowContext.Provider>
  );
}

const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

function InnerTable({ dataSource, columns: rawColumns, onReorder, storageKey, ...rest }) {
  // Track widths so columns are resizable
  const [widths, setWidths] = useState(() => {
    if (storageKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(`colw:${storageKey}`) || '{}');
        return saved;
      } catch { /* noop */ }
    }
    return {};
  });

  useEffect(() => {
    if (storageKey) localStorage.setItem(`colw:${storageKey}`, JSON.stringify(widths));
  }, [widths, storageKey]);

  const buildResizable = (col) => {
    if (col.children) return { ...col, children: col.children.map(buildResizable) };
    const key = col.key || col.dataIndex;
    const w = widths[key] ?? col.width;
    if (!w) return col;
    return {
      ...col,
      width: w,
      onHeaderCell: () => ({
        width: typeof w === 'number' ? w : undefined,
        onResize: (_, { size }) => {
          setWidths((prev) => ({ ...prev, [key]: size.width }));
        },
      }),
    };
  };

  const columns = rawColumns.map(buildResizable);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 1 } }));

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = dataSource.findIndex((i) => i.id === active.id);
    const newIndex = dataSource.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(dataSource, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={dataSource.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <Table
          rowKey="id"
          components={{
            header: { cell: ResizableTitle },
            body: { row: Row },
          }}
          dataSource={dataSource}
          columns={columns}
          {...rest}
        />
      </SortableContext>
    </DndContext>
  );
}

export default function SortableTable({ dataSource, groupBy, getGroupValue, getGroupLabel, groupFooter, ...rest }) {
  if (!groupBy) {
    return <InnerTable dataSource={dataSource} {...rest} />;
  }

  // Build groups
  const groups = new Map();
  for (const row of dataSource) {
    const k = getGroupValue ? getGroupValue(row, groupBy) : row[groupBy];
    const key = k == null || k === '' ? '__none__' : String(k);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const items = Array.from(groups.entries()).map(([key, rows]) => {
    const label = key === '__none__' ? '（未分类）' : (getGroupLabel ? getGroupLabel(key, groupBy, rows) : key);
    const innerRest = groupFooter
      ? { ...rest, footer: () => groupFooter(groupBy, key, rows) }
      : rest;
    return {
      key,
      label: <Typography.Text strong>{label} <Typography.Text type="secondary">（{rows.length}）</Typography.Text></Typography.Text>,
      children: <InnerTable dataSource={rows} {...innerRest} />,
    };
  });

  const allKeys = items.map(i => i.key);
  const groupSig = `${groupBy}:${allKeys.join('|')}`;
  const [activeKey, setActiveKey] = React.useState(allKeys);
  const sigRef = React.useRef(groupSig);
  if (sigRef.current !== groupSig) {
    sigRef.current = groupSig;
    // Re-expand whenever groupBy or the set of groups changes
    queueMicrotask(() => setActiveKey(allKeys));
  }

  return (
    <Collapse
      activeKey={activeKey}
      onChange={(keys) => setActiveKey(Array.isArray(keys) ? keys : [keys])}
      items={items}
    />
  );
}
