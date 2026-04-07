export function OfflineDataBadge({ savedAt }) {
  if (!savedAt) return null;
  const dt = new Date(savedAt);
  const label = dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <span
      style={{
        fontSize: '12px',
        color: '#92400e',
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '4px',
        padding: '2px 8px',
        marginLeft: '8px',
        fontWeight: 500,
      }}
    >
      📦 Cache · {label}
    </span>
  );
}
