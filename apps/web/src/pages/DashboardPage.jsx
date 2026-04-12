import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { dashboardService } from '../services/dashboard.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { useOfflineCache } from '../hooks/useOfflineCache.js';
import { useContentLayout } from '../hooks/useContentLayout.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faCircleUser,
  faDoorOpen,
  faCreditCard,
  faWallet,
  faCircleExclamation,
  faCircleCheck,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { colors, typography, radius, shadows } from '../design-system/tokens.js';
import { OfflineDataBadge } from '../components/OfflineDataBadge.jsx';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
}

function formatMes(mesStr) {
  if (!mesStr) return '';
  const [year, month] = mesStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function formatarMesAno({ year, month }) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function BarChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: colors.neutral500, textAlign: 'center', padding: '24px 0' }}>Sem dados para o período.</p>;
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.entradas, d.saidas]), 1);
  const chartHeight = 140;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: `${chartHeight + 36}px`, paddingTop: '8px' }}>
      {data.map((d) => (
        <div key={d.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: `${chartHeight}px` }}>
            <div
              title={`Entradas: ${formatBRL(d.entradas)}`}
              style={{
                width: '14px',
                height: `${Math.max((d.entradas / maxVal) * chartHeight, 2)}px`,
                background: colors.success,
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.3s ease',
              }}
            />
            <div
              title={`Saídas: ${formatBRL(d.saidas)}`}
              style={{
                width: '14px',
                height: `${Math.max((d.saidas / maxVal) * chartHeight, 2)}px`,
                background: colors.error,
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontSize: typography.sizes.xs, color: colors.neutral500, marginTop: '4px', whiteSpace: 'nowrap' }}>
            {formatMes(d.mes)}
          </span>
        </div>
      ))}
    </div>
  );
}

function KPICard({ label, value, subtitle, color, bgColor, icon, loading }) {
  return (
    <div
      style={{
        background: colors.white,
        borderRadius: radius.lg,
        boxShadow: shadows.sm,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        borderLeft: `4px solid ${color}`,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: typography.sizes.sm, color: colors.neutral500, fontWeight: typography.weights.medium }}>
          {label}
        </span>
        <span style={{ fontSize: '18px', color, background: bgColor, borderRadius: radius.full, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesomeIcon icon={icon} style={{ fontSize: '14px' }} />
        </span>
      </div>
      {loading ? (
        <div style={{ height: '28px', background: colors.neutral200, borderRadius: radius.sm, width: '80%' }} />
      ) : (
        <span style={{ fontSize: typography.sizes['3xl'], fontWeight: typography.weights.bold, color: colors.neutral900 }}>
          {value}
        </span>
      )}
      {!loading && subtitle && (
        <span style={{ fontSize: typography.sizes.xs, color: colors.neutral400 }}>{subtitle}</span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { saveCache, readCache } = useOfflineCache(usuario?.id);
  const { isMobile, contentStyle } = useContentLayout();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState({ year: hoje.getFullYear(), month: hoje.getMonth() + 1 });

  const [dashboardMensal, setDashboardMensal] = useState(null);
  const [evolucao, setEvolucao] = useState([]);
  const [contas, setContas] = useState([]);

  const [loadingMensal, setLoadingMensal] = useState(true);
  const [loadingEvolucao, setLoadingEvolucao] = useState(true);
  const [loadingContas, setLoadingContas] = useState(true);

  const [cacheMensalInfo, setCacheMensalInfo] = useState(null);

  const contentMarginLeft = !sidebarOpen ? '0px' : sidebarExpanded ? '236px' : '108px';
  const mainContentStyle = isMobile
    ? { ...contentStyle }
    : { marginLeft: contentMarginLeft, transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)' };

  function mesAnterior() {
    setMesSelecionado((prev) => {
      if (prev.month === 1) return { year: prev.year - 1, month: 12 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }

  function mesSeguinte() {
    setMesSelecionado((prev) => {
      if (prev.month === 12) return { year: prev.year + 1, month: 1 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }

  const carregarDadosMensais = useCallback(async () => {
    setLoadingMensal(true);
    try {
      const data = await dashboardService.getDashboardMensal(mesSelecionado);
      setDashboardMensal(data);
      saveCache('dashboard', { mensal: data, mes: mesSelecionado });
      setCacheMensalInfo(null);
    } catch {
      if (!isOnline) {
        const cached = readCache('dashboard');
        if (cached) {
          setDashboardMensal(cached.data.mensal);
          setCacheMensalInfo(cached.savedAt);
          return;
        }
      }
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoadingMensal(false);
    }
  }, [mesSelecionado, isOnline, saveCache, readCache]);

  const carregarEvolucao = useCallback(async () => {
    setLoadingEvolucao(true);
    try {
      const data = await dashboardService.getEvolucaoMensal(6);
      setEvolucao(data);
      saveCache('dashboard-evolucao', data);
    } catch {
      if (!isOnline) {
        const cached = readCache('dashboard-evolucao');
        if (cached) {
          setEvolucao(cached.data);
          return;
        }
      }
      toast.error('Erro ao carregar evolução mensal');
    } finally {
      setLoadingEvolucao(false);
    }
  }, [isOnline, saveCache, readCache]);

  const carregarContas = useCallback(async () => {
    setLoadingContas(true);
    try {
      const data = await dashboardService.getSaldoPorConta();
      setContas(data);
      saveCache('dashboard-contas', data);
    } catch {
      if (!isOnline) {
        const cached = readCache('dashboard-contas');
        if (cached) {
          setContas(cached.data);
          return;
        }
      }
      toast.error('Erro ao carregar saldo por conta');
    } finally {
      setLoadingContas(false);
    }
  }, [isOnline, saveCache, readCache]);

  useEffect(() => {
    carregarDadosMensais();
  }, [carregarDadosMensais]);

  useEffect(() => {
    carregarEvolucao();
    carregarContas();
  }, [carregarEvolucao, carregarContas]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  function handleMenuNavigate(path) {
    setDropdownOpen(false);
    navigate(path);
  }

  const initials = getInitials(usuario?.nome);

  const categorias = dashboardMensal?.categories ?? [];
  const categoriasOut = categorias.filter((c) => c.type === 'OUT');
  const categoriasIn = categorias.filter((c) => c.type === 'IN');
  const maxOut = categoriasOut.length > 0 ? Math.max(...categoriasOut.map((c) => c.amount), 1) : 1;
  const maxIn = categoriasIn.length > 0 ? Math.max(...categoriasIn.map((c) => c.amount), 1) : 1;

  const cards = dashboardMensal?.cards;

  const navBtnStyle = {
    background: colors.neutral100,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.neutral600,
    fontSize: '12px',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: colors.bg }}>
      <AppSidebar
        sidebarOpen={sidebarOpen}
        currentPath="/dashboard"
        isExpanded={sidebarExpanded}
        onHoverChange={setSidebarExpanded}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          ...mainContentStyle,
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 28px',
            background: colors.white,
            borderBottom: `1px solid ${colors.border}`,
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: colors.neutral600, padding: '4px 8px', borderRadius: radius.sm }}
              aria-label="Menu"
              onClick={() => {
                if (!sidebarOpen) {
                  setSidebarOpen(true);
                  setSidebarExpanded(true);
                } else {
                  setSidebarExpanded(!sidebarExpanded);
                }
              }}
            >
              <FontAwesomeIcon icon={faBars} />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: typography.sizes['5xl'], fontWeight: typography.weights.bold, color: colors.neutral800 }}>
                Dashboard
              </h1>
              <p style={{ margin: 0, fontSize: typography.sizes.sm, color: colors.neutral500 }}>
                Olá, {usuario?.nome?.split(' ')[0] || 'usuário'}! Aqui está seu resumo financeiro.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Month selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button style={navBtnStyle} onClick={mesAnterior} aria-label="Mês anterior">
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <span style={{ fontWeight: typography.weights.semibold, minWidth: '130px', textAlign: 'center', fontSize: typography.sizes.sm, color: colors.neutral800 }}>
                {formatarMesAno(mesSelecionado)}
              </span>
              <button style={navBtnStyle} onClick={mesSeguinte} aria-label="Próximo mês">
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>

            <div ref={dropdownRef} style={{ position: 'relative', marginLeft: '8px' }}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '700',
                  flexShrink: 0,
                  cursor: 'pointer',
                  border: 'none',
                  outline: 'none',
                  userSelect: 'none',
                  boxShadow: dropdownOpen ? '0 0 0 3px rgba(37,99,235,0.25)' : 'none',
                }}
                title={usuario?.nome || ''}
                aria-label={`Menu do usuário ${usuario?.nome || ''}`}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                {initials}
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '230px',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.13)',
                  border: '1px solid #e5e7eb',
                  zIndex: 1050,
                  overflow: 'hidden',
                  padding: '4px 0',
                }}>
                  <div style={{ padding: '14px 16px 12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '2px' }}>
                      {usuario?.nome || 'Usuário'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {usuario?.email || ''}
                    </div>
                  </div>

                  <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #f3f4f6' }} />

                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => handleMenuNavigate('/assinatura')}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '18px', marginRight: '5px' }} />
                    Assinatura
                  </button>

                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => handleMenuNavigate('/perfil')}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <FontAwesomeIcon icon={faCircleUser} style={{ fontSize: '18px', color: '#4b5563', marginRight: '5px' }} />
                    Perfil
                  </button>

                  <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #f3f4f6' }} />

                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', fontSize: '14px', fontWeight: '500', color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => { setDropdownOpen(false); logout(); }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <FontAwesomeIcon icon={faDoorOpen} style={{ fontSize: '18px', marginRight: '5px' }} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <InadimplenteGuard>
          <main style={{ flex: 1, padding: '28px 32px 40px' }}>

            {/* Cache notice when offline */}
            {!isOnline && cacheMensalInfo && (
              <div style={{ marginBottom: '16px' }}>
                <OfflineDataBadge savedAt={cacheMensalInfo} />
              </div>
            )}

            {/* KPI Cards — executive view */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
                marginBottom: '28px',
              }}
            >
              <KPICard
                label="A Pagar (mês)"
                value={formatBRL(cards?.accountsPayable?.amount)}
                subtitle={cards?.accountsPayable?.count != null ? `${cards.accountsPayable.count} lançamento${cards.accountsPayable.count !== 1 ? 's' : ''}` : undefined}
                color={colors.warning}
                bgColor={colors.warningBg}
                icon={faCircleExclamation}
                loading={loadingMensal}
              />
              <KPICard
                label="A Receber (mês)"
                value={formatBRL(cards?.accountsReceivable?.amount)}
                subtitle={cards?.accountsReceivable?.count != null ? `${cards.accountsReceivable.count} lançamento${cards.accountsReceivable.count !== 1 ? 's' : ''}` : undefined}
                color="#0369a1"
                bgColor="#e0f2fe"
                icon={faCircleCheck}
                loading={loadingMensal}
              />
              <KPICard
                label="Saldo Atual"
                value={formatBRL(cards?.currentBalance)}
                color={colors.primaryLight}
                bgColor={colors.primaryBg}
                icon={faWallet}
                loading={loadingMensal}
              />
            </div>

            {/* Bottom sections */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

              {/* Evolução mensal */}
              <div
                style={{
                  background: colors.white,
                  borderRadius: radius.lg,
                  boxShadow: shadows.sm,
                  padding: '24px',
                  position: 'relative',
                  minHeight: '280px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: typography.sizes['2xl'], fontWeight: typography.weights.semibold, color: colors.neutral800 }}>
                    Evolução Mensal
                  </h2>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: typography.sizes.xs, color: colors.neutral500 }}>
                      <span style={{ width: '10px', height: '10px', background: colors.success, borderRadius: '2px', display: 'inline-block' }} />
                      Entradas
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: typography.sizes.xs, color: colors.neutral500 }}>
                      <span style={{ width: '10px', height: '10px', background: colors.error, borderRadius: '2px', display: 'inline-block' }} />
                      Saídas
                    </span>
                  </div>
                </div>
                {loadingEvolucao ? (
                  <div style={{ height: '176px', background: colors.neutral100, borderRadius: radius.md }} />
                ) : (
                  <BarChart data={evolucao} />
                )}
              </div>

              {/* Categorias — Saídas e Entradas */}
              <div
                style={{
                  background: colors.white,
                  borderRadius: radius.lg,
                  boxShadow: shadows.sm,
                  padding: '24px',
                  minHeight: '280px',
                }}
              >
                <h2 style={{ margin: '0 0 16px', fontSize: typography.sizes['2xl'], fontWeight: typography.weights.semibold, color: colors.neutral800 }}>
                  Categorias do Mês
                </h2>
                {loadingMensal ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} style={{ height: '28px', background: colors.neutral100, borderRadius: radius.sm }} />
                    ))}
                  </div>
                ) : categorias.length === 0 ? (
                  <p style={{ color: colors.neutral500, textAlign: 'center', padding: '24px 0', fontSize: typography.sizes.sm }}>
                    Sem movimentações por categoria no mês.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {categoriasOut.length > 0 && (
                      <div>
                        <p style={{ margin: '0 0 8px', fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.error, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Saídas
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {categoriasOut.map((cat) => (
                            <div key={cat.categoryId}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                <span style={{ fontSize: typography.sizes.sm, color: colors.neutral700, fontWeight: typography.weights.medium }}>
                                  {cat.categoryName}
                                </span>
                                <span style={{ fontSize: typography.sizes.sm, color: colors.neutral600 }}>
                                  {formatBRL(cat.amount)}
                                </span>
                              </div>
                              <div style={{ background: colors.neutral100, borderRadius: radius.full, height: '6px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${(cat.amount / maxOut) * 100}%`,
                                    background: colors.error,
                                    borderRadius: radius.full,
                                    transition: 'width 0.4s ease',
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {categoriasIn.length > 0 && (
                      <div>
                        <p style={{ margin: '0 0 8px', fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.success, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Entradas
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {categoriasIn.map((cat) => (
                            <div key={cat.categoryId}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                <span style={{ fontSize: typography.sizes.sm, color: colors.neutral700, fontWeight: typography.weights.medium }}>
                                  {cat.categoryName}
                                </span>
                                <span style={{ fontSize: typography.sizes.sm, color: colors.neutral600 }}>
                                  {formatBRL(cat.amount)}
                                </span>
                              </div>
                              <div style={{ background: colors.neutral100, borderRadius: radius.full, height: '6px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${(cat.amount / maxIn) * 100}%`,
                                    background: colors.success,
                                    borderRadius: radius.full,
                                    transition: 'width 0.4s ease',
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Saldo por Conta */}
              <div
                style={{
                  background: colors.white,
                  borderRadius: radius.lg,
                  boxShadow: shadows.sm,
                  padding: '24px',
                  gridColumn: '1 / -1',
                }}
              >
                <h2 style={{ margin: '0 0 16px', fontSize: typography.sizes['2xl'], fontWeight: typography.weights.semibold, color: colors.neutral800 }}>
                  Saldo por Conta
                </h2>
                {loadingContas ? (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{ width: '180px', height: '72px', background: colors.neutral100, borderRadius: radius.md }} />
                    ))}
                  </div>
                ) : contas.length === 0 ? (
                  <p style={{ color: colors.neutral500, fontSize: typography.sizes.sm }}>Nenhuma conta ativa encontrada.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {contas.map((conta) => (
                      <div
                        key={conta.id}
                        style={{
                          background: colors.neutral50,
                          border: `1px solid ${colors.border}`,
                          borderRadius: radius.md,
                          padding: '14px 18px',
                          minWidth: '160px',
                        }}
                      >
                        <p style={{ margin: '0 0 4px', fontSize: typography.sizes.sm, color: colors.neutral500, fontWeight: typography.weights.medium }}>
                          {conta.nome}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: typography.sizes['2xl'],
                            fontWeight: typography.weights.bold,
                            color: conta.saldo >= 0 ? colors.success : colors.error,
                          }}
                        >
                          {formatBRL(conta.saldo)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </main>
        </InadimplenteGuard>

        {/* Footer */}
        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ backgroundColor: '#33528a', color: '#FFFFFF', textAlign: 'center', paddingTop: '18px', paddingBottom: '18px', paddingLeft: '32px', paddingRight: '32px', fontSize: '14px', fontWeight: '500', letterSpacing: '0.01em', borderRadius: radius.lg }}>
            Finlly • painel financeiro pessoal — {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}

