import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth.js';
import { useContentLayout } from '../hooks/useContentLayout.js';
import { billingService } from '../services/billing.service.js';
import AppSidebar from '../components/AppSidebar.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { Button, Badge } from '../design-system/index.js';
import {
  colors,
  typography,
  tokens,
  radius,
  shadows,
} from '../design-system/tokens.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faCreditCard,
  faFileInvoice,
  faCalendarDays,
  faRotate,
} from '@fortawesome/free-solid-svg-icons';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr.split('T')[0]);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function VencimentoBadge({ dateStr }) {
  const days = getDaysUntil(dateStr);
  if (days === null)
    return <span style={{ fontWeight: 600, color: colors.neutral800 }}>—</span>;
  if (days < 0)
    return (
      <span style={{ fontWeight: 600, color: '#dc2626', fontSize: 14 }}>
        {formatDate(dateStr)} · Vencido
      </span>
    );
  if (days <= 7)
    return (
      <span style={{ fontWeight: 600, color: '#d97706', fontSize: 14 }}>
        {formatDate(dateStr)} · {days}d restantes
      </span>
    );
  return (
    <span style={{ fontWeight: 600, color: colors.neutral800, fontSize: 14 }}>
      {formatDate(dateStr)}
    </span>
  );
}

function PagamentoBadge({ forma }) {
  if (!forma)
    return <span style={{ fontWeight: 600, color: colors.neutral400 }}>—</span>;
  const map = {
    PIX: { bg: '#dcfce7', color: '#16a34a', label: 'PIX', icon: faBolt },
    CREDIT_CARD: {
      bg: '#eff6ff',
      color: '#2563eb',
      label: 'Cartão de crédito',
      icon: faCreditCard,
    },
    BOLETO: {
      bg: '#fef9c3',
      color: '#ca8a04',
      label: 'Boleto',
      icon: faFileInvoice,
    },
  };
  const style = map[forma.toUpperCase()] || {
    bg: colors.neutral100,
    color: colors.neutral600,
    label: forma,
    icon: faCreditCard,
  };
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: 99,
        fontSize: 13,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <FontAwesomeIcon icon={style.icon} style={{ fontSize: 11 }} />
      {style.label}
    </span>
  );
}

function CicloBadge({ ciclo }) {
  if (!ciclo)
    return <span style={{ fontWeight: 600, color: colors.neutral400 }}>—</span>;
  const map = {
    mensal: { bg: '#eff6ff', color: '#2563eb', label: 'Mensal' },
    anual: { bg: '#f0fdf4', color: '#16a34a', label: 'Anual' },
  };
  const style = map[ciclo.toLowerCase()] || {
    bg: colors.neutral100,
    color: colors.neutral600,
    label: ciclo,
  };
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: 99,
        fontSize: 13,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 11 }} />
      {style.label}
    </span>
  );
}

const PRECOS = { mensal: 'R$ 39,90/mês', anual: 'R$ 399,00/ano' };

export default function BillingStatusPage() {
  useAuth();
  const navigate = useNavigate();
  const { isMobile, contentStyle } = useContentLayout();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const [assinante, setAssinante] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

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
    setCancelling(true);
    try {
      await billingService.cancel();
      toast.success('Assinatura cancelada com sucesso.');
      setAssinante(null);
      setConfirmCancel(false);
      navigate('/checkout?plano=mensal&ciclo=mensal&step=2', { replace: true });
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

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            ...(isMobile
              ? contentStyle
              : {
                  marginLeft: !sidebarOpen
                    ? '0px'
                    : sidebarExpanded
                      ? '236px'
                      : '108px',
                  transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }),
          }}
        >
          <PageHeader
            title="Assinatura"
            subtitle="Gerencie sua assinatura do Finlly"
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            sidebarExpanded={sidebarExpanded}
            setSidebarExpanded={setSidebarExpanded}
          />

          <main style={{ flex: 1, padding: '32px 32px 32px 24px' }}>
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
                <Button onClick={() => navigate('/checkout?step=2')}>
                  Assinar um plano →
                </Button>
              </div>
            )}

            {!loading && !error && assinante && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: '24px',
                  alignItems: 'start',
                }}
              >
                {/* Card esquerdo — Status */}
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
                    <Badge
                      variant={
                        assinante.status === 'ativo' ? 'success' : 'neutral'
                      }
                    >
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
                    Seu acesso ao sistema depende de pagamento recorrente
                    confirmado no Asaas.
                  </p>

                  {assinante.status === 'ativo' && (
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: colors.successBg,
                        border: `1px solid ${tokens.color?.successBorder ?? '#bbf7d0'}`,
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

                  <dl style={{ margin: 0, padding: 0 }}>
                    {[
                      {
                        label: 'Plano',
                        value: (
                          <span
                            style={{
                              fontWeight: 600,
                              color: colors.neutral800,
                              textTransform: 'capitalize',
                            }}
                          >
                            {assinante.plano ?? '—'}
                          </span>
                        ),
                      },
                      {
                        label: 'Ciclo',
                        value: <CicloBadge ciclo={assinante.ciclo} />,
                      },
                      {
                        label: 'Forma de pagamento',
                        value: (
                          <PagamentoBadge forma={assinante.formaPagamento} />
                        ),
                      },
                      {
                        label: 'Próximo vencimento',
                        value: (
                          <VencimentoBadge
                            dateStr={assinante.dataProximoVencimento}
                          />
                        ),
                      },
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
                        <dd style={{ margin: 0, textAlign: 'right' }}>
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div style={{ marginTop: '24px' }}>
                    {confirmCancel ? (
                      <div
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: radius.md,
                          padding: '14px 16px',
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 12px',
                            fontSize: 14,
                            color: '#991b1b',
                            fontWeight: 600,
                          }}
                        >
                          Tem certeza? Esta ação não pode ser desfeita.
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={handleCancel}
                            disabled={cancelling}
                            style={{
                              padding: '7px 16px',
                              background: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: radius.sm,
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: cancelling ? 'not-allowed' : 'pointer',
                              opacity: cancelling ? 0.7 : 1,
                            }}
                          >
                            {cancelling ? 'Cancelando...' : 'Sim, cancelar'}
                          </button>
                          <button
                            onClick={() => setConfirmCancel(false)}
                            style={{
                              padding: '7px 16px',
                              background: 'transparent',
                              color: colors.neutral600,
                              border: `1px solid ${colors.neutral300}`,
                              borderRadius: radius.sm,
                              fontSize: 14,
                              cursor: 'pointer',
                            }}
                          >
                            Voltar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmCancel(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: 14,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                          opacity: 0.8,
                        }}
                      >
                        Cancelar assinatura
                      </button>
                    )}
                  </div>
                </div>

                {/* Card direito — Renovar */}
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
                    Manter Plano Ativo
                  </h2>
                  <p
                    style={{
                      margin: '0 0 8px',
                      fontSize: typography.sizes.base,
                      color: colors.neutral500,
                    }}
                  >
                    Sua gestão não pode parar. Clique abaixo para confirmar seu
                    próximo ciclo.
                  </p>

                  <div
                    style={{
                      margin: '0 0 24px',
                      padding: '12px 16px',
                      background: colors.neutral50,
                      borderRadius: radius.md,
                      border: `1px solid ${colors.neutral200}`,
                    }}
                  >
                    <span style={{ fontSize: 13, color: colors.neutral500 }}>
                      Próximo ciclo
                    </span>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: colors.neutral800,
                        marginTop: 2,
                      }}
                    >
                      {PRECOS[assinante.ciclo?.toLowerCase()] ?? 'R$ 39,90/mês'}
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        color: colors.neutral400,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 2,
                      }}
                    >
                      <FontAwesomeIcon
                        icon={faRotate}
                        style={{ fontSize: 11 }}
                      />
                      Recorrência {assinante.ciclo ?? 'mensal'} via{' '}
                      {assinante.formaPagamento ?? 'PIX'}
                    </span>
                  </div>

                  <Button
                    onClick={() =>
                      navigate(
                        `/checkout?plano=${encodeURIComponent(assinante?.plano ?? 'mensal')}&ciclo=${encodeURIComponent(assinante?.ciclo ?? 'mensal')}&step=2`
                      )
                    }
                  >
                    Renovar assinatura →
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </InadimplenteGuard>
  );
}
