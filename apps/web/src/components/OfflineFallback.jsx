// Exibido quando o usuário está offline e não há cache disponível para aquele recurso
export function OfflineFallback({ message }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      color: '#6b7280',
    }}>
      <span style={{ fontSize: '48px', marginBottom: '16px' }}>📡</span>
      <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#374151' }}>
        Sem conexão
      </h3>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
        {message || 'Este conteúdo não está disponível offline. Conecte-se à internet para acessar os dados mais recentes.'}
      </p>
    </div>
  );
}
