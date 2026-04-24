import { createPortal } from 'react-dom';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useEffect } from 'react';
import { Modal } from 'antd';
import useIsMobile from '../hooks/useIsMobile';

// Full-screen mobile page that mimics a subset of the antd Modal API.
// Props supported: open, title, onCancel, onOk, okText, cancelText,
// confirmLoading, children, footer (optional override), maskClosable (ignored).
function MobilePageShell({
  open, title, onCancel, onOk, okText = '保存',
  confirmLoading = false, children, footer,
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const node = (
    <div className="mobile-page" role="dialog" aria-modal="true">
      <header className="mobile-page-header">
        <button
          type="button"
          className="mobile-page-back"
          onClick={onCancel}
          aria-label="返回"
        >
          <ArrowLeftOutlined />
        </button>
        <h2 className="mobile-page-title">{title}</h2>
        {footer === null ? <span style={{ width: 64 }} /> : (
          <Button
            type="primary"
            loading={confirmLoading}
            onClick={onOk}
            size="middle"
          >
            {okText}
          </Button>
        )}
      </header>
      <div className="mobile-page-body">{children}</div>
    </div>
  );

  return createPortal(node, document.body);
}

// Drop-in wrapper: renders a fullscreen page on mobile, or a regular Modal on desktop.
// Accepts the same prop subset as antd Modal listed above.
export default function MobileOrModal({ children, ...props }) {
  const isMobile = useIsMobile();
  if (isMobile) return <MobilePageShell {...props}>{children}</MobilePageShell>;
  return <Modal {...props}>{children}</Modal>;
}

export { MobilePageShell };
