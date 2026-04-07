import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

export default function OfflineBanner({ lastSyncAt }) {
  const isOnline = useOnlineStatus();

  const syncLabel =
    lastSyncAt
      ? new Date(lastSyncAt).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  return (
    <div
      role="alert"
      aria-hidden={isOnline}
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
        opacity: isOnline ? 0 : 1,
        transform: isOnline ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: isOnline ? 'none' : 'auto',
      }}
    >
      ⚠️ Você está offline. Exibindo dados salvos localmente — última versão disponível.
      {syncLabel && ` · Última sincronização: ${syncLabel}`}
    </div>
  );
}
