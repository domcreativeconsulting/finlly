import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth.js';
import { billingService } from '../services/billing.service.js';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { Button, Badge } from '../design-system/index.js';
import { colors, typography, tokens, radius, shadows } from '../design-system/tokens.js';
import { getApiError } from '../utils/getApiError.js';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

export default function BillingStatusPage() {
  useAuth();
  const navigate = useNavigate();

  const [sidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const [assinante, setAssinante] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    billingService
      .getStatus()
      .then((data) => setAssinante(data.assinante ?? null))
      .catch((err) => {
        setError(getApiError(err, 'Erro ao carregar status da assinatura.'));
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
      toast.error(getApiError(err, 'Erro ao cancelar assinatura.'));
    } finally {
      setCancelling(false);
    }
  }

  const contentMarginLeft = sidebarExpanded ? '236px' : '108px';

  return (
    <InadimplenteGuard>
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          backgroundColor: colors.bg,
          fontFamily: tokens.fontFamily,
        }}
      >
        <AppSidebar
          sidebarOpen={sidebarOpen}
          currentPath="/assinatura"
          isExpanded={sidebarExpanded}
          onHoverChange={setSidebarExpanded}
        />

        <main
          style={{
            flex: 1,
            marginLeft: contentMarginLeft,
            transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: '32px 32px 32px 24px',
            minHeight: '100vh',
          }}
        >
          {/* Page header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: typography.sizes['5xl'],
                  fontWeight: typography.weights.bold,
                  color: colors.neutral800,
                }}
              >
                Assinatura
              </h1>
              <p
                style={{
                  margin: '4px 0 0',
                  color: colors.neutral500,
                  fontSize: typography.sizes.md,
                }}
              >
                Gerencie sua assinatura do Finlly
              </p>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 0',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '22px',
                  height: '22px',
                  border: `3px solid ${colors.neutral200}`,
                  borderTopColor: colors.primaryLight,
                  borderRadius: radius.full,
                  animation: 'spin 0.7s linear infinite',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: colors.neutral500,
                  marginLeft: '12px',
                  fontSize: typography.sizes.md,
                }}
              >
                Carregando...
              </span>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: colors.errorBg,
                border: `1px solid ${colors.errorBorder}`,
                borderRadius: radius.md,
                color: colors.error,
                fontSize: typography.sizes.md,
              }}
            >
              {error}
            </div>
          )}

          {/* No subscription state */}
          {!loading && !error && !assinante && (
            <div
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: '32px',
                boxShadow: shadows.sm,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '16px',
                maxWidth: '480px',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: typography.sizes['4xl'],
                  fontWeight: typography.weights.semibold,
                  color: colors.neutral800,
                }}
              >
                Assinatura
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: typography.sizes.md,
                  color: colors.neutral500,
                }}
              >
                Você não possui uma assinatura ativa.
              </p>
              <Button onClick={() => navigate('/checkout')}>
                Assinar um plano →
              </Button>
            </div>
          )}

          {/* Subscription active: 2-column layout */}
          {!loading && !error && assinante && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                alignItems: 'start',
              }}
            >
              {/* Left card — Subscription status */}
              <div
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: '28px',
                  boxShadow: shadows.sm,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: typography.sizes['4xl'],
                      fontWeight: typography.weights.semibold,
                      color: colors.neutral800,
                    }}
                  >
                    Assinatura
                  </h2>
                  <Badge variant={assinante.status === 'ativo' ? 'success' : 'neutral'}>
                    {assinante.status ?? '—'}
                  </Badge>
                </div>

                <p
                  style={{
                    margin: '0 0 20px',
                    fontSize: typography.sizes.base,
                    color: colors.neutral500,
                  }}
                >
                  Seu acesso ao sistema depende de pagamento recorrente confirmado no Asaas.
                </p>

                {assinante.status === 'ativo' && (
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: colors.successBg,
                      border: `1px solid ${tokens.color.successBorder}`,
                      borderRadius: radius.md,
                      color: colors.successText,
                      fontSize: typography.sizes.base,
                      fontWeight: typography.weights.medium,
                      marginBottom: '20px',
                    }}
                  >
                    ✓ Ativo. Seu acesso está liberado.
                  </div>
                )}

                <dl style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {[
                    { label: 'Plano', value: assinante.plano ?? '—' },
                    { label: 'Ciclo', value: assinante.ciclo ?? '—' },
                    { label: 'Forma de pagamento', value: assinante.formaPagamento ?? '—' },
                    {
                      label: 'Próximo vencimento',
                      value: formatDate(assinante.dataProximoVencimento),
                    },
                    ...(assinante.asaasStatus
                      ? [{ label: 'Status Asaas', value: assinante.asaasStatus }]
                      : []),
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: `1px solid ${colors.neutral100}`,
                      }}
                    >
                      <dt
                        style={{
                          fontSize: typography.sizes.md,
                          color: colors.neutral500,
                          fontWeight: typography.weights.medium,
                          margin: 0,
                        }}
                      >
                        {label}
                      </dt>
                      <dd
                        style={{
                          fontSize: typography.sizes.md,
                          fontWeight: typography.weights.semibold,
                          color: colors.neutral800,
                          margin: 0,
                          textAlign: 'right',
                        }}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div style={{ marginTop: '20px' }}>
                  <Button
                    variant="danger"
                    onClick={handleCancel}
                    disabled={cancelling}
                    loading={cancelling}
                  >
                    {cancelling ? 'Cancelando...' : 'Cancelar assinatura'}
                  </Button>
                </div>
              </div>

              {/* Right card — Create / renew subscription */}
              <div
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: '28px',
                  boxShadow: shadows.sm,
                }}
              >
                <h2
                  style={{
                    margin: '0 0 8px',
                    fontSize: typography.sizes['4xl'],
                    fontWeight: typography.weights.semibold,
                    color: colors.neutral800,
                  }}
                >
                  Criar / renovar assinatura
                </h2>
                <p
                  style={{
                    margin: '0 0 24px',
                    fontSize: typography.sizes.base,
                    color: colors.neutral500,
                  }}
                >
                  Acesse o checkout para criar uma nova assinatura ou renovar o seu plano atual.
                </p>
                <Button onClick={() => navigate('/checkout')}>
                  Ir para o checkout →
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </InadimplenteGuard>
  );
}
