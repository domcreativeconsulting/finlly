import { useEffect } from 'react';
import { colors, radius, shadows, typography } from '../tokens.js';

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = '540px',
  style,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        style={{
          background: colors.white,
          borderRadius: radius.lg,
          boxShadow: shadows.xl,
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          overflowY: 'auto',
          ...style,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px 16px',
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: typography.sizes['2xl'],
                fontWeight: typography.weights.semibold,
                color: colors.neutral900,
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Fechar"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                color: colors.neutral500,
                padding: '4px',
                lineHeight: 1,
                borderRadius: radius.sm,
              }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
