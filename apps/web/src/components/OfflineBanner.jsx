import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#f59e0b',
        color: '#ffffff',
        textAlign: 'center',
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: 600,
        letterSpacing: '0.01em',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      ⚠️ Você está offline. Exibindo dados salvos localmente — última versão disponível.
    </div>
  );
}
