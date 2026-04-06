import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { dashboardService } from '../services/dashboard.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faCircleUser,
  faDoorOpen,
  faArrowTrendUp,
  faArrowTrendDown,
  faScaleBalanced,
  faWallet,
  faCircleExclamation,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '../design-system/index.js';
import { colors, typography, radius, shadows } from '../design-system/tokens.js';

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
}

function firstDayOfMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastDayOfMonth() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

function formatMes(mesStr) {
  if (!mesStr) return '';
  const [year, month] = mesStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
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

function KPICard({ label, value, color, bgColor, icon, loading }) {
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
    </div>
  );
}

export default function DashboardPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const [dataInicio, setDataInicio] = useState(firstDayOfMonth());
  const [dataFim, setDataFim] = useState(lastDayOfMonth());

  const [kpis, setKpis] = useState(null);
  const [evolucao, setEvolucao] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [contas, setContas] = useState([]);

  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingEvolucao, setLoadingEvolucao] = useState(true);
  const [loadingCategorias, setLoadingCategorias] = useState(true);
  const [loadingContas, setLoadingContas] = useState(true);

  const contentMarginLeft = !sidebarOpen ? '0px' : sidebarExpanded ? '236px' : '108px';

  const carregarDados = useCallback(async () => {
    setLoadingKpis(true);
    setLoadingCategorias(true);

    try {
      const [kpisData, categoriasData] = await Promise.all([
        dashboardService.getKPIs({ dataInicio, dataFim }),
        dashboardService.getTopCategorias({ dataInicio, dataFim, tipo: 'saida', limit: 8 }),
      ]);
      setKpis(kpisData);
      setCategorias(categoriasData);
    } catch {
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoadingKpis(false);
      setLoadingCategorias(false);
    }
  }, [dataInicio, dataFim]);

  const carregarEvolucao = useCallback(async () => {
    setLoadingEvolucao(true);
    try {
      const data = await dashboardService.getEvolucaoMensal(6);
      setEvolucao(data);
    } catch {
      toast.error('Erro ao carregar evolução mensal');
    } finally {
      setLoadingEvolucao(false);
    }
  }, []);

  const carregarContas = useCallback(async () => {
    setLoadingContas(true);
    try {
      const data = await dashboardService.getSaldoPorConta();
      setContas(data);
    } catch {
      toast.error('Erro ao carregar saldo por conta');
    } finally {
      setLoadingContas(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    carregarEvolucao();
    carregarContas();
  }, [carregarEvolucao, carregarContas]);

  const maxCategoria = categorias.length > 0 ? Math.max(...categorias.map((c) => c.total), 1) : 1;

  const resultadoColor = kpis?.resultado >= 0 ? colors.success : colors.error;

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
          marginLeft: contentMarginLeft,
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: radius.md, border: `1px solid ${colors.border}`, fontSize: typography.sizes.sm, color: colors.neutral700 }}
            />
            <span style={{ color: colors.neutral400, fontSize: typography.sizes.sm }}>até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: radius.md, border: `1px solid ${colors.border}`, fontSize: typography.sizes.sm, color: colors.neutral700 }}
            />
            <Button size="sm" onClick={carregarDados}>Filtrar</Button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
              <button
                onClick={() => navigate('/perfil')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.neutral500, fontSize: '18px', padding: '4px' }}
                title="Meu perfil"
              >
                <FontAwesomeIcon icon={faCircleUser} />
              </button>
              <button
                onClick={logout}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.neutral500, fontSize: '18px', padding: '4px' }}
                title="Sair"
              >
                <FontAwesomeIcon icon={faDoorOpen} />
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <InadimplenteGuard>
          <main style={{ flex: 1, padding: '28px 28px 40px' }}>

            {/* KPI Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '28px',
              }}
            >
              <KPICard
                label="Saldo Atual"
                value={formatBRL(kpis?.saldo_atual)}
                color={colors.primaryLight}
                bgColor={colors.primaryBg}
                icon={faWallet}
                loading={loadingKpis}
              />
              <KPICard
                label="Entradas"
                value={formatBRL(kpis?.total_entradas)}
                color={colors.success}
                bgColor={colors.successBg}
                icon={faArrowTrendUp}
                loading={loadingKpis}
              />
              <KPICard
                label="Saídas"
                value={formatBRL(kpis?.total_saidas)}
                color={colors.error}
                bgColor={colors.errorBg}
                icon={faArrowTrendDown}
                loading={loadingKpis}
              />
              <KPICard
                label="Resultado"
                value={formatBRL(kpis?.resultado)}
                color={resultadoColor}
                bgColor={kpis?.resultado >= 0 ? colors.successBg : colors.errorBg}
                icon={faScaleBalanced}
                loading={loadingKpis}
              />
              <KPICard
                label="A Pagar (pendente)"
                value={formatBRL(kpis?.contas_pagar_pendente)}
                color={colors.warning}
                bgColor={colors.warningBg}
                icon={faCircleExclamation}
                loading={loadingKpis}
              />
              <KPICard
                label="A Receber (pendente)"
                value={formatBRL(kpis?.contas_receber_pendente)}
                color="#0369a1"
                bgColor="#e0f2fe"
                icon={faCircleCheck}
                loading={loadingKpis}
              />
            </div>

            {/* Bottom sections */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>

              {/* Evolução mensal */}
              <div
                style={{
                  background: colors.white,
                  borderRadius: radius.lg,
                  boxShadow: shadows.sm,
                  padding: '24px',
                  position: 'relative',
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

              {/* Top Categorias */}
              <div
                style={{
                  background: colors.white,
                  borderRadius: radius.lg,
                  boxShadow: shadows.sm,
                  padding: '24px',
                }}
              >
                <h2 style={{ margin: '0 0 16px', fontSize: typography.sizes['2xl'], fontWeight: typography.weights.semibold, color: colors.neutral800 }}>
                  Top Categorias (Saídas)
                </h2>
                {loadingCategorias ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} style={{ height: '28px', background: colors.neutral100, borderRadius: radius.sm }} />
                    ))}
                  </div>
                ) : categorias.length === 0 ? (
                  <p style={{ color: colors.neutral500, textAlign: 'center', padding: '24px 0', fontSize: typography.sizes.sm }}>
                    Sem saídas por categoria no período.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {categorias.map((cat) => (
                      <div key={cat.categoria_id ?? cat.categoria_nome}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: typography.sizes.sm, color: colors.neutral700, fontWeight: typography.weights.medium }}>
                            {cat.categoria_nome}
                          </span>
                          <span style={{ fontSize: typography.sizes.sm, color: colors.neutral600 }}>
                            {formatBRL(cat.total)}
                          </span>
                        </div>
                        <div style={{ background: colors.neutral100, borderRadius: radius.full, height: '6px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${(cat.total / maxCategoria) * 100}%`,
                              background: colors.error,
                              borderRadius: radius.full,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    ))}
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
      </div>
    </div>
  );
}
