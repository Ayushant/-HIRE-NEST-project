import React from 'react';

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const XIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const AlertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const InfoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const typeStyles = {
  success: { bg: '#059669', border: '#10B981', Icon: CheckIcon },
  error:   { bg: '#DC2626', border: '#EF4444', Icon: XIcon },
  warning: { bg: '#D97706', border: '#F59E0B', Icon: AlertIcon },
  info:    { bg: '#2563EB', border: '#3B82F6', Icon: InfoIcon }
};

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '380px'
    }}>
      {toasts.map(t => {
        const { bg, border, Icon } = typeStyles[t.type] || typeStyles.info;
        return (
          <div
            key={t.id}
            style={{
              background: bg,
              border: `1px solid ${border}`,
              color: '#fff',
              padding: '12px 14px',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              animation: 'toastSlideIn 0.25s ease',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: 500,
              lineHeight: 1.45
            }}
            onClick={() => removeToast(t.id)}
          >
            <span style={{ flexShrink: 0, display: 'flex', opacity: 0.9, paddingTop: '1px' }}>
              <Icon />
            </span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeToast(t.id); }}
              style={{
                background: 'none', border: 'none', color: '#fff',
                cursor: 'pointer', padding: '0', opacity: 0.7,
                flexShrink: 0, display: 'flex', alignItems: 'center'
              }}
            >
              <XIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}
