import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth.js';
import { billingService } from '../services/billing.service.js';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

export default function BillingStatusPage() {
  useAuth();
  const navigate = useNavigate();

  const [assinante, setAssinante] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    billingService
      .getStatus()
      .then((data) => setAssinante(data.assinante ?? null))
      .catch((err) => {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Erro ao carregar status da assinatura.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel() {
    if (
      !window.confirm(
        'Tem certeza que deseja cancelar sua assinatura? Esta ação não pode ser desfeita.',
      )
    )
      return;

    setCancelling(true);
    try {
      await billingService.cancel();
      toast.success('Assinatura cancelada com sucesso.');
      navigate('/checkout');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Erro ao cancelar assinatura.';
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Finlly</h1>
        <Link to="/dashboard" style={styles.backLink}>
          ← Voltar ao painel
        </Link>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.title}>Status da assinatura</h2>

          {loading && (
            <div style={styles.loadingBox}>
              <span style={styles.spinner} />
              <span style={{ color: '#6b7280', marginLeft: '12px' }}>
                Carregando...
              </span>
            </div>
          )}

          {!loading && error && (
            <div style={styles.errorBox}>{error}</div>
          )}

          {!loading && !error && !assinante && (
            <div style={styles.emptyBox}>
              <p style={styles.emptyText}>
                Você não possui uma assinatura ativa.
              </p>
              <Link to="/checkout" style={styles.actionLink}>
                Assinar um plano →
              </Link>
            </div>
          )}

          {!loading && !error && assinante && (
            <>
              <dl style={styles.dl}>
                <div style={styles.dlRow}>
                  <dt style={styles.dt}>Plano</dt>
                  <dd style={styles.dd}>{assinante.plano ?? '—'}</dd>
                </div>
                <div style={styles.dlRow}>
                  <dt style={styles.dt}>Status</dt>
                  <dd style={styles.dd}>
                    <span
                      style={
                        assinante.status === 'ativo'
                          ? styles.badgeAtivo
                          : styles.badgeOther
                      }
                    >
                      {assinante.status ?? '—'}
                    </span>
                  </dd>
                </div>
                <div style={styles.dlRow}>
                  <dt style={styles.dt}>Ciclo</dt>
                  <dd style={styles.dd}>{assinante.ciclo ?? '—'}</dd>
                </div>
                <div style={styles.dlRow}>
                  <dt style={styles.dt}>Forma de pagamento</dt>
                  <dd style={styles.dd}>{assinante.formaPagamento ?? '—'}</dd>
                </div>
                <div style={styles.dlRow}>
                  <dt style={styles.dt}>Próximo vencimento</dt>
                  <dd style={styles.dd}>
                    {formatDate(assinante.dataProximoVencimento)}
                  </dd>
                </div>
                {assinante.asaasStatus && (
                  <div style={styles.dlRow}>
                    <dt style={styles.dt}>Status Asaas</dt>
                    <dd style={styles.dd}>{assinante.asaasStatus}</dd>
                  </div>
                )}
              </dl>

              <div style={styles.actions}>
                <Link to="/checkout" style={styles.actionLink}>
                  Mudar plano
                </Link>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  style={cancelling ? styles.btnCancelDisabled : styles.btnCancel}
                >
                  {cancelling ? 'Cancelando...' : 'Cancelar assinatura'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    padding: '12px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#2563eb',
    margin: 0,
  },
  backLink: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#2563eb',
    textDecoration: 'none',
  },
  main: {
    maxWidth: '520px',
    margin: '0 auto',
    padding: '40px 24px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 32,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 24px',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 0',
  },
  spinner: {
    display: 'inline-block',
    width: '22px',
    height: '22px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    flexShrink: 0,
  },
  errorBox: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px',
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '12px',
  },
  emptyText: {
    fontSize: '15px',
    color: '#6b7280',
    margin: 0,
  },
  dl: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  dlRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  dt: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '500',
    margin: 0,
  },
  dd: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
    textAlign: 'right',
  },
  badgeAtivo: {
    display: 'inline-block',
    padding: '2px 10px',
    backgroundColor: '#dcfce7',
    color: '#16a34a',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: '600',
  },
  badgeOther: {
    display: 'inline-block',
    padding: '2px 10px',
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: '600',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '24px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  actionLink: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#2563eb',
    textDecoration: 'none',
  },
  btnCancel: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#dc2626',
    backgroundColor: '#fff',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  btnCancelDisabled: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#9ca3af',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'not-allowed',
  },
};
