import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { dashboardService } from '../services/dashboard.service.js';
import { contasPagarService } from '../services/contasPagar.service.js';
import { contasReceberService } from '../services/contasReceber.service.js';
import { investimentosService } from '../services/investimentos.service.js';
import { metasService } from '../services/metas.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { useContentLayout } from '../hooks/useContentLayout.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faCircleUser,
  faDoorOpen,
  faCreditCard,
  faChartLine,
  faPlus,
  faCalendarCheck,
  faExclamationTriangle,
  faArrowDown,
  faArrowUp,
  faWallet,
  faBullseye,
  faChartPie,
} from '@fortawesome/free-solid-svg-icons';
import { colors, typography, radius, shadows } from '../design-system/tokens.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor ?? 0);
}

function formatBRLShort(valor) {
  if (Math.abs(valor) >= 1000) {
    return `R$${(valor / 1000).toFixed(1)}k`;
  }
  return `R$${valor.toFixed(0)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const datePart = String(dateStr).substring(0, 10);
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y}`;
}

function toISODate(date) {
  return date.toISOString().split('T')[0];
}

function getTodayStr() {
  return toISODate(new Date());
}

function normalizeMeta(meta) {
  const valorAlvo = meta.valorAlvo ?? meta.valor_alvo ?? 0;
  const valorAtual = meta.valorAtual ?? meta.valor_atual ?? 0;
  const dataFim = meta.dataFim ?? meta.data_fim ?? null;
  return { valorAlvo, valorAtual, dataFim };
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

function getDaysAheadStr(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function isSemAssinatura(err) {
  return err?.response?.data?.code === 'SEM_ASSINATURA';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = '18px', style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        background: colors.neutral100,
        borderRadius: radius.sm,
        ...style,
      }}
    />
  );
}

// ─── Line Chart (SVG) ─────────────────────────────────────────────────────────

function LineChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <p
        style={{
          color: colors.neutral500,
          textAlign: 'center',
          padding: '24px 0',
          fontSize: typography.sizes.sm,
        }}
      >
        Sem dados para o período.
      </p>
    );
  }

  const W = 460;
  const H = 160;
  const PAD = { top: 12, right: 12, bottom: 28, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.flatMap((d) => [d.pagar, d.receber]), 1);
  const n = data.length;

  const scaleX = (i) => PAD.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const scaleY = (val) => PAD.top + innerH - (val / maxVal) * innerH;

  const pagarPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(d.pagar)}`)
    .join(' ');
  const receberPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(d.receber)}`)
    .join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto' }}
      aria-label="Gráfico de fluxo 7 dias"
    >
      {/* Grid lines */}
      {yTicks.map((f) => (
        <line
          key={f}
          x1={PAD.left}
          y1={PAD.top + innerH - f * innerH}
          x2={PAD.left + innerW}
          y2={PAD.top + innerH - f * innerH}
          stroke={colors.neutral200}
          strokeWidth="0.5"
        />
      ))}

      {/* Y axis labels */}
      {yTicks.map((f) => (
        <text
          key={f}
          x={PAD.left - 4}
          y={PAD.top + innerH - f * innerH + 4}
          textAnchor="end"
          fontSize="9"
          fill={colors.neutral500}
        >
          {formatBRLShort(maxVal * f)}
        </text>
      ))}

      {/* Saídas line (red) */}
      <path d={pagarPath} fill="none" stroke={colors.error} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Entradas line (green) */}
      <path d={receberPath} fill="none" stroke={colors.success} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Data points – saídas */}
      {data.map((d, i) => (
        <circle key={`p-${i}`} cx={scaleX(i)} cy={scaleY(d.pagar)} r="3" fill={colors.error} />
      ))}

      {/* Data points – entradas */}
      {data.map((d, i) => (
        <circle key={`r-${i}`} cx={scaleX(i)} cy={scaleY(d.receber)} r="3" fill={colors.success} />
      ))}

      {/* X axis labels */}
      {data.map((d, i) => (
        <text
          key={`lbl-${i}`}
          x={scaleX(i)}
          y={H - 4}
          textAnchor="middle"
          fontSize="9"
          fill={colors.neutral500}
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}

// ─── Donut Chart (SVG) ────────────────────────────────────────────────────────

function DonutChart({ aplicado, saldoAtual }) {
  const r = 55;
  const cx = 70;
  const cy = 70;
  const circ = 2 * Math.PI * r;
  const total = (aplicado || 0) + (saldoAtual || 0);

  if (total === 0) {
    return (
      <svg width="140" height="140" viewBox="0 0 140 140" aria-label="Donut chart vazio">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.neutral200} strokeWidth="20" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="11" fill={colors.neutral500}>
          Sem dados
        </text>
      </svg>
    );
  }

  const aplicadoPct = (aplicado || 0) / total;
  const saldoPct = (saldoAtual || 0) / total;
  const aplicadoLen = aplicadoPct * circ;
  const saldoLen = saldoPct * circ;
  const saldoStartDeg = aplicadoPct * 360;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" aria-label="Donut chart investimentos">
      {/* Background track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.neutral200} strokeWidth="20" />
      {/* Saldo atual (green) */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#16a34a"
        strokeWidth="20"
        strokeDasharray={`${saldoLen} ${circ}`}
        strokeDashoffset={0}
        transform={`rotate(${saldoStartDeg - 90} ${cx} ${cy})`}
      />
      {/* Aplicado (blue) */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#2563eb"
        strokeWidth="20"
        strokeDasharray={`${aplicadoLen} ${circ}`}
        strokeDashoffset={0}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  subtitle,
  borderColor,
  icon,
  loading,
  btnLabel,
  btnColor,
  onBtnClick,
  valueColor,
}) {
  return (
    <div
      style={{
        background: colors.white,
        borderRadius: radius.lg,
        boxShadow: shadows.sm,
        padding: '18px 20px',
        borderLeft: `4px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon && (
          <FontAwesomeIcon icon={icon} style={{ color: borderColor, fontSize: '14px' }} />
        )}
        <span
          style={{
            fontSize: typography.sizes.sm,
            color: colors.neutral500,
            fontWeight: typography.weights.medium,
          }}
        >
          {label}
        </span>
      </div>

      {loading ? (
        <>
          <Skeleton height="28px" width="140px" />
          <Skeleton height="14px" width="80px" />
        </>
      ) : (
        <>
          <span
            style={{
              fontSize: typography.sizes['4xl'],
              fontWeight: typography.weights.bold,
              color: valueColor || colors.neutral800,
              lineHeight: 1.2,
            }}
          >
            {value}
          </span>
          {subtitle && (
            <span style={{ fontSize: typography.sizes.xs, color: colors.neutral500 }}>
              {subtitle}
            </span>
          )}
        </>
      )}

      {btnLabel && (
        <button
          onClick={onBtnClick}
          style={{
            marginTop: '6px',
            padding: '5px 12px',
            fontSize: typography.sizes.xs,
            fontWeight: typography.weights.medium,
            background: btnColor || borderColor,
            color: colors.white,
            border: 'none',
            borderRadius: radius.sm,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          {btnLabel}
        </button>
      )}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct || 0));
  return (
    <div
      style={{
        height: '6px',
        background: colors.neutral200,
        borderRadius: radius.full,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          background: colors.primaryLight,
          borderRadius: radius.full,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

function PrioridadeBadge({ prioridade }) {
  const map = {
    alta: { bg: '#fef2f2', color: colors.error, label: 'alta' },
    media: { bg: '#fef9c3', color: colors.warning, label: 'média' },
    baixa: { bg: colors.successBg, color: colors.success, label: 'baixa' },
  };
  const style = map[prioridade] || map.media;
  return (
    <span
      style={{
        padding: '1px 7px',
        borderRadius: radius.full,
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
        background: style.bg,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { isMobile, contentStyle } = useContentLayout();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // KPI states
  const [loadingKPIs, setLoadingKPIs] = useState(true);
  const [pagarHoje, setPagarHoje] = useState({ valor: 0, count: 0 });
  const [receberHoje, setReceberHoje] = useState({ valor: 0, count: 0 });
  const [atrasadas, setAtrasadas] = useState({ valor: 0, count: 0 });
  const [totalSaldo, setTotalSaldo] = useState(0);

  // Investimentos
  const [investimentos, setInvestimentos] = useState([]);
  const [loadingInvestimentos, setLoadingInvestimentos] = useState(true);

  // Metas
  const [metas, setMetas] = useState([]);
  const [loadingMetas, setLoadingMetas] = useState(true);

  // Fluxo 7 dias
  const [fluxo7Dias, setFluxo7Dias] = useState([]);
  const [loadingFluxo, setLoadingFluxo] = useState(true);

  // Próximos vencimentos
  const [proximosVencimentos, setProximosVencimentos] = useState([]);
  const [loadingVencimentos, setLoadingVencimentos] = useState(true);
  const [pagandoId, setPagandoId] = useState(null);

  const initials = getInitials(usuario?.nome);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Load KPIs ──────────────────────────────────────────────────────────────
  const loadKPIs = useCallback(async () => {
    setLoadingKPIs(true);
    try {
      const todayStr = getTodayStr();
      const yesterdayStr = getYesterdayStr();

      const [pagarHojeRes, receberHojeRes, atrasadasRes, contasRes] = await Promise.all([
        contasPagarService
          .listar({ status: 'pendente', data_vencimento_de: todayStr, data_vencimento_ate: todayStr, limit: 200 })
          .catch((err) => {
            if (!isSemAssinatura(err)) toast.error('Erro ao carregar contas a pagar de hoje.');
            return { data: [] };
          }),
        contasReceberService
          .listar({ status: 'pendente', data_vencimento_de: todayStr, data_vencimento_ate: todayStr, limit: 200 })
          .catch((err) => {
            if (!isSemAssinatura(err)) toast.error('Erro ao carregar contas a receber de hoje.');
            return { data: [] };
          }),
        contasPagarService
          .listar({ status: 'pendente', data_vencimento_ate: yesterdayStr, limit: 200 })
          .catch((err) => {
            if (!isSemAssinatura(err)) toast.error('Erro ao carregar contas atrasadas.');
            return { data: [] };
          }),
        dashboardService.getSaldoPorConta().catch((err) => {
          if (!isSemAssinatura(err)) toast.error('Erro ao carregar saldo das contas.');
          return [];
        }),
      ]);

      const pagarHojeData = pagarHojeRes?.data ?? [];
      setPagarHoje({
        valor: pagarHojeData.reduce((s, c) => s + (c.valor ?? 0), 0),
        count: pagarHojeData.length,
      });

      const receberHojeData = receberHojeRes?.data ?? [];
      setReceberHoje({
        valor: receberHojeData.reduce((s, c) => s + (c.valor ?? 0), 0),
        count: receberHojeData.length,
      });

      const atrasadasData = atrasadasRes?.data ?? [];
      setAtrasadas({
        valor: atrasadasData.reduce((s, c) => s + (c.valor ?? 0), 0),
        count: atrasadasData.length,
      });

      const contasArr = Array.isArray(contasRes) ? contasRes : (contasRes?.data ?? []);
      setTotalSaldo(contasArr.reduce((s, c) => s + (c.saldo ?? 0), 0));
    } catch (err) {
      if (!isSemAssinatura(err)) toast.error('Erro ao carregar KPIs.');
    } finally {
      setLoadingKPIs(false);
    }
  }, []);

  // ── Load Investimentos ─────────────────────────────────────────────────────
  const loadInvestimentos = useCallback(async () => {
    setLoadingInvestimentos(true);
    try {
      const res = await investimentosService.listar({ limit: 200 });
      const data = Array.isArray(res) ? res : (res?.data ?? []);
      setInvestimentos(data);
    } catch (err) {
      if (!isSemAssinatura(err)) toast.error('Erro ao carregar investimentos.');
    } finally {
      setLoadingInvestimentos(false);
    }
  }, []);

  // ── Load Metas ─────────────────────────────────────────────────────────────
  const loadMetas = useCallback(async () => {
    setLoadingMetas(true);
    try {
      const res = await metasService.listar({ status: 'ativa', limit: 3 });
      const data = Array.isArray(res) ? res : (res?.data ?? []);
      setMetas(data);
    } catch (err) {
      if (!isSemAssinatura(err)) toast.error('Erro ao carregar metas.');
    } finally {
      setLoadingMetas(false);
    }
  }, []);

  // ── Load Fluxo 7 dias ──────────────────────────────────────────────────────
  const loadFluxo = useCallback(async () => {
    setLoadingFluxo(true);
    try {
      const todayStr = getTodayStr();
      const endStr = getDaysAheadStr(6);

      const [pagarRes, receberRes] = await Promise.all([
        contasPagarService
          .listar({ status: 'pendente', data_vencimento_de: todayStr, data_vencimento_ate: endStr, limit: 200 })
          .catch((err) => {
            if (!isSemAssinatura(err)) toast.error('Erro ao carregar fluxo de caixa.');
            return { data: [] };
          }),
        contasReceberService
          .listar({ status: 'pendente', data_vencimento_de: todayStr, data_vencimento_ate: endStr, limit: 200 })
          .catch((err) => {
            if (!isSemAssinatura(err)) toast.error('Erro ao carregar fluxo de caixa.');
            return { data: [] };
          }),
      ]);

      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return toISODate(d);
      });

      const pagarData = pagarRes?.data ?? [];
      const receberData = receberRes?.data ?? [];

      const fluxo = days.map((dateStr) => {
        const pagar = pagarData
          .filter((c) => String(c.data_vencimento).substring(0, 10) === dateStr)
          .reduce((s, c) => s + (c.valor ?? 0), 0);
        const receber = receberData
          .filter((c) => String(c.data_vencimento).substring(0, 10) === dateStr)
          .reduce((s, c) => s + (c.valor ?? 0), 0);
        const [, m, d] = dateStr.split('-');
        return { label: `${d}/${m}`, pagar, receber };
      });

      setFluxo7Dias(fluxo);
    } catch (err) {
      if (!isSemAssinatura(err)) toast.error('Erro ao carregar fluxo de caixa.');
    } finally {
      setLoadingFluxo(false);
    }
  }, []);

  // ── Load Próximos Vencimentos ──────────────────────────────────────────────
  const loadProximosVencimentos = useCallback(async () => {
    setLoadingVencimentos(true);
    try {
      const todayStr = getTodayStr();

      const [pagarRes, receberRes] = await Promise.all([
        contasPagarService
          .listar({ status: 'pendente', data_vencimento_de: todayStr, limit: 50 })
          .catch((err) => {
            if (!isSemAssinatura(err)) toast.error('Erro ao carregar próximos vencimentos.');
            return { data: [] };
          }),
        contasReceberService
          .listar({ status: 'pendente', data_vencimento_de: todayStr, limit: 50 })
          .catch((err) => {
            if (!isSemAssinatura(err)) toast.error('Erro ao carregar próximos vencimentos.');
            return { data: [] };
          }),
      ]);

      const pagar = (pagarRes?.data ?? []).map((c) => ({ ...c, tipo: 'pagar' }));
      const receber = (receberRes?.data ?? []).map((c) => ({ ...c, tipo: 'receber' }));
      const combined = [...pagar, ...receber]
        .sort((a, b) =>
          String(a.data_vencimento).localeCompare(String(b.data_vencimento)),
        )
        .slice(0, 10);

      setProximosVencimentos(combined);
    } catch (err) {
      if (!isSemAssinatura(err)) toast.error('Erro ao carregar próximos vencimentos.');
    } finally {
      setLoadingVencimentos(false);
    }
  }, []);

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadKPIs();
    loadInvestimentos();
    loadMetas();
    loadFluxo();
    loadProximosVencimentos();
  }, [loadKPIs, loadInvestimentos, loadMetas, loadFluxo, loadProximosVencimentos]);

  // ── Pagar/Receber actions ──────────────────────────────────────────────────
  async function handlePagar(item) {
    if (pagandoId) return;
    setPagandoId(item.id);
    try {
      if (item.tipo === 'pagar') {
        await contasPagarService.pagar(item.id);
        toast.success('Conta paga com sucesso!');
      } else {
        await contasReceberService.receber(item.id);
        toast.success('Recebimento registrado!');
      }
      await Promise.all([loadKPIs(), loadProximosVencimentos(), loadFluxo()]);
    } catch (err) {
      if (!isSemAssinatura(err))
        toast.error(err?.response?.data?.message || 'Erro ao registrar pagamento.');
    } finally {
      setPagandoId(null);
    }
  }

  // ── Computed investimentos values ──────────────────────────────────────────
  const totalAplicado = investimentos.reduce((s, inv) => s + (inv.valorInicial ?? inv.valor_aplicado ?? 0), 0);
  const totalSaldoAtual = investimentos.reduce(
    (s, inv) => s + (inv.saldo_atual ?? inv.saldoAtual ?? inv.valorInicial ?? 0),
    0,
  );
  const ganhoEstimado = totalSaldoAtual - totalAplicado;
  const rentMedia = totalAplicado > 0 ? ((ganhoEstimado / totalAplicado) * 100).toFixed(2) : '0.00';

  // ── Computed metas values ──────────────────────────────────────────────────
  const metasTotalAlvo = metas.reduce((s, m) => s + normalizeMeta(m).valorAlvo, 0);
  const metasTotalAtual = metas.reduce((s, m) => s + normalizeMeta(m).valorAtual, 0);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const cardStyle = {
    background: colors.white,
    borderRadius: radius.lg,
    boxShadow: shadows.sm,
    padding: '20px 24px',
  };

  const cardHeaderStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '16px',
    gap: '8px',
    flexWrap: 'wrap',
  };

  const cardTitleStyle = {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.neutral800,
    margin: 0,
  };

  const cardSubtitleStyle = {
    fontSize: typography.sizes.xs,
    color: colors.neutral500,
    margin: '2px 0 0',
  };

  const outlineBtnStyle = {
    padding: '6px 14px',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    background: 'transparent',
    color: colors.primaryLight,
    border: `1px solid ${colors.primaryLight}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
  };

  const primaryBtnStyle = {
    padding: '8px 16px',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    background: colors.primaryLight,
    color: colors.white,
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const kpiGrid = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '16px',
  };

  const kpiGrid2 = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: '16px',
    marginBottom: '24px',
  };

  const mainGrid = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: '20px',
    marginBottom: '20px',
  };

  const year = new Date().getFullYear();

  return (
    <InadimplenteGuard>
      <div style={{ display: 'flex', minHeight: '100vh', background: colors.bg }}>
        <AppSidebar
          sidebarOpen={sidebarOpen}
          isExpanded={sidebarExpanded}
          onHoverChange={setSidebarExpanded}
          currentPath="/dashboard"
        />

        <main style={{ flex: 1, ...contentStyle }}>
          {/* ── Top Bar ── */}
          <div
            style={{
              background: colors.white,
              borderBottom: `1px solid ${colors.border}`,
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              position: 'sticky',
              top: 0,
              zIndex: 100,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  color: colors.neutral600,
                  fontSize: '16px',
                }}
                aria-label="Toggle sidebar"
              >
                <FontAwesomeIcon icon={faBars} />
              </button>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: typography.sizes.xl,
                    fontWeight: typography.weights.semibold,
                    color: colors.neutral800,
                  }}
                >
                  Dashboard
                </p>
                <p style={{ margin: 0, fontSize: typography.sizes.xs, color: colors.neutral500 }}>
                  Gestão financeira pessoal
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {!isOnline && (
                <span
                  style={{
                    fontSize: typography.sizes.xs,
                    color: colors.warning,
                    fontWeight: typography.weights.medium,
                  }}
                >
                  Offline
                </span>
              )}
              <button
                onClick={() => navigate('/contas-pagar')}
                style={primaryBtnStyle}
              >
                Abrir planejamento
              </button>

              {/* Avatar dropdown */}
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  title={usuario?.nome || ''}
                  aria-label={`Menu do usuário ${usuario?.nome || ''}`}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: radius.full,
                    background: colors.primary,
                    color: colors.white,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.bold,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {initials}
                </button>
                {dropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '44px',
                      background: colors.white,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      boxShadow: shadows.md,
                      minWidth: '160px',
                      zIndex: 200,
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px 6px',
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: typography.sizes.sm,
                          fontWeight: typography.weights.semibold,
                          color: colors.neutral800,
                        }}
                      >
                        {usuario?.nome || 'Usuário'}
                      </p>
                      <p
                        style={{
                          margin: '2px 0 0',
                          fontSize: typography.sizes.xs,
                          color: colors.neutral500,
                        }}
                      >
                        {usuario?.email || ''}
                      </p>
                    </div>
                    {[
                      {
                        icon: faCreditCard,
                        label: 'Assinatura',
                        onClick: () => {
                          navigate('/assinatura');
                          setDropdownOpen(false);
                        },
                      },
                      {
                        icon: faCircleUser,
                        label: 'Perfil',
                        onClick: () => {
                          navigate('/perfil');
                          setDropdownOpen(false);
                        },
                      },
                      {
                        icon: faDoorOpen,
                        label: 'Sair',
                        onClick: () => {
                          logout();
                          setDropdownOpen(false);
                        },
                        color: colors.error,
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.onClick}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: typography.sizes.sm,
                          color: item.color || colors.neutral700,
                          textAlign: 'left',
                        }}
                      >
                        <FontAwesomeIcon icon={item.icon} style={{ width: '14px' }} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Page Content ── */}
          <div style={{ padding: isMobile ? '16px' : '24px' }}>

            {/* ── KPI Cards – top row ── */}
            <div style={kpiGrid}>
              <KPICard
                label="Pagar Hoje"
                value={formatBRL(pagarHoje.valor)}
                subtitle={`${pagarHoje.count} conta${pagarHoje.count !== 1 ? 's' : ''}`}
                borderColor={colors.warning}
                icon={faArrowDown}
                loading={loadingKPIs}
                btnLabel="Ver hoje"
                onBtnClick={() => navigate('/contas-pagar')}
              />
              <KPICard
                label="Receber Hoje"
                value={formatBRL(receberHoje.valor)}
                subtitle={`${receberHoje.count} conta${receberHoje.count !== 1 ? 's' : ''}`}
                borderColor="#0369a1"
                icon={faArrowUp}
                loading={loadingKPIs}
                btnLabel="Ver hoje"
                onBtnClick={() => navigate('/contas-receber')}
              />
              <KPICard
                label="Atrasadas"
                value={formatBRL(atrasadas.valor)}
                subtitle={`${atrasadas.count} conta${atrasadas.count !== 1 ? 's' : ''}`}
                borderColor={colors.error}
                icon={faExclamationTriangle}
                loading={loadingKPIs}
                btnLabel="Resolver"
                btnColor={colors.error}
                onBtnClick={() => navigate('/contas-pagar')}
                valueColor={colors.error}
              />
            </div>

            {/* ── KPI Cards – bottom row ── */}
            <div style={kpiGrid2}>
              <KPICard
                label="Saldo do Mês"
                value={formatBRL(totalSaldo)}
                subtitle="Carteira atual"
                borderColor={colors.primaryLight}
                icon={faWallet}
                loading={loadingKPIs}
                btnLabel="Ver carteira"
                onBtnClick={() => navigate('/contas')}
              />
              <KPICard
                label="Investimentos"
                value={loadingInvestimentos ? '...' : formatBRL(totalSaldoAtual)}
                subtitle={`Aplicado: ${formatBRL(totalAplicado)}`}
                borderColor={colors.success}
                icon={faChartLine}
                loading={loadingInvestimentos}
                btnLabel="Ver investimentos"
                btnColor={colors.success}
                onBtnClick={() => navigate('/investimentos')}
              />
            </div>

            {/* ── Quick actions ── */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '24px',
              }}
            >
              <button
                onClick={() => navigate('/contas-pagar', { state: { openModal: true } })}
                style={primaryBtnStyle}
              >
                <FontAwesomeIcon icon={faPlus} />
                Nova conta a pagar
              </button>
              <button
                onClick={() => navigate('/contas-receber', { state: { openModal: true } })}
                style={outlineBtnStyle}
              >
                + Nova conta a receber
              </button>
              <button
                onClick={() => navigate('/investimentos')}
                style={{
                  ...outlineBtnStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FontAwesomeIcon icon={faChartPie} />
                Investimentos
              </button>
            </div>

            {/* ── Visão Geral + Próximos Vencimentos ── */}
            <div style={mainGrid}>

              {/* Visão Geral – 7-day flow */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <p style={cardTitleStyle}>Visão Geral</p>
                    <p style={cardSubtitleStyle}>Fluxo (7 dias): pagar x receber</p>
                  </div>
                  <button
                    onClick={() => navigate('/contas-pagar')}
                    style={outlineBtnStyle}
                  >
                    Abrir planejamento
                  </button>
                </div>

                {/* Legend */}
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    marginBottom: '8px',
                    fontSize: typography.sizes.xs,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '3px',
                        background: colors.success,
                        borderRadius: '2px',
                      }}
                    />
                    <span style={{ color: colors.neutral600 }}>Entradas</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '3px',
                        background: colors.error,
                        borderRadius: '2px',
                      }}
                    />
                    <span style={{ color: colors.neutral600 }}>Saídas</span>
                  </span>
                </div>

                {loadingFluxo ? (
                  <Skeleton height="140px" />
                ) : (
                  <LineChart data={fluxo7Dias} />
                )}
              </div>

              {/* Próximos Vencimentos */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <p style={cardTitleStyle}>Próximos vencimentos</p>
                    <p style={cardSubtitleStyle}>Pendências a partir de hoje (até 10 itens)</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => navigate('/contas-pagar')} style={outlineBtnStyle}>
                      Pagar
                    </button>
                    <button onClick={() => navigate('/contas-receber')} style={outlineBtnStyle}>
                      Receber
                    </button>
                  </div>
                </div>

                {loadingVencimentos ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} height="36px" />
                    ))}
                  </div>
                ) : proximosVencimentos.length === 0 ? (
                  <p style={{ color: colors.neutral500, fontSize: typography.sizes.sm, textAlign: 'center', padding: '16px 0' }}>
                    Nenhum vencimento pendente a partir de hoje.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.sizes.sm }}>
                      <thead>
                        <tr>
                          {['Tipo', 'Vencimento', 'Descrição', 'Valor', 'Ação'].map((col) => (
                            <th
                              key={col}
                              style={{
                                textAlign: 'left',
                                padding: '6px 8px',
                                fontSize: typography.sizes.xs,
                                color: colors.neutral500,
                                fontWeight: typography.weights.medium,
                                borderBottom: `1px solid ${colors.border}`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {proximosVencimentos.map((item) => (
                          <tr
                            key={`${item.tipo}-${item.id}`}
                            style={{ borderBottom: `1px solid ${colors.neutral100}` }}
                          >
                            <td style={{ padding: '6px 8px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: radius.full,
                                  fontSize: typography.sizes.xs,
                                  fontWeight: typography.weights.medium,
                                  background: item.tipo === 'pagar' ? '#fef2f2' : colors.successBg,
                                  color: item.tipo === 'pagar' ? colors.error : colors.success,
                                }}
                              >
                                {item.tipo === 'pagar' ? 'Pagar' : 'Receber'}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: '6px 8px',
                                color: colors.neutral700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatDate(item.data_vencimento)}
                            </td>
                            <td
                              style={{
                                padding: '6px 8px',
                                color: colors.neutral700,
                                maxWidth: '120px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={item.descricao || item.nome || ''}
                            >
                              {item.descricao || item.nome || '-'}
                            </td>
                            <td
                              style={{
                                padding: '6px 8px',
                                fontWeight: typography.weights.medium,
                                color: item.tipo === 'pagar' ? colors.error : colors.success,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatBRL(item.valor)}
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <button
                                onClick={() => handlePagar(item)}
                                disabled={pagandoId === item.id}
                                style={{
                                  padding: '3px 10px',
                                  fontSize: typography.sizes.xs,
                                  fontWeight: typography.weights.medium,
                                  background:
                                    item.tipo === 'pagar' ? colors.error : colors.success,
                                  color: colors.white,
                                  border: 'none',
                                  borderRadius: radius.sm,
                                  cursor: pagandoId === item.id ? 'wait' : 'pointer',
                                  opacity: pagandoId === item.id ? 0.6 : 1,
                                }}
                              >
                                {pagandoId === item.id
                                  ? '...'
                                  : item.tipo === 'pagar'
                                  ? 'Pagar'
                                  : 'Receber'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ── Investimentos + Metas ── */}
            <div style={mainGrid}>

              {/* Investimentos detalhado */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <p style={cardTitleStyle}>Investimentos</p>
                    <p style={cardSubtitleStyle}>Aplicado x saldo atual (estimado)</p>
                  </div>
                  <button onClick={() => navigate('/investimentos')} style={outlineBtnStyle}>
                    Ver carteira
                  </button>
                </div>

                {loadingInvestimentos ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="20px" />)}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      gap: '24px',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Left: stats */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      {[
                        { label: 'Saldo atual', value: formatBRL(totalSaldoAtual) },
                        { label: 'Aplicado', value: formatBRL(totalAplicado) },
                        {
                          label: 'Ganho estimado',
                          value: formatBRL(ganhoEstimado),
                          color: ganhoEstimado >= 0 ? colors.success : colors.error,
                        },
                        { label: 'Rent. média', value: `${rentMedia}%` },
                      ].map((row) => (
                        <div
                          key={row.label}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '7px 0',
                            borderBottom: `1px solid ${colors.neutral100}`,
                            fontSize: typography.sizes.sm,
                          }}
                        >
                          <span style={{ color: colors.neutral500 }}>{row.label}</span>
                          <span
                            style={{
                              fontWeight: typography.weights.semibold,
                              color: row.color || colors.neutral800,
                            }}
                          >
                            {row.value || '-'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Right: donut chart */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <DonutChart aplicado={totalAplicado} saldoAtual={totalSaldoAtual} />
                      <div style={{ display: 'flex', gap: '12px', fontSize: typography.sizes.xs }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              background: '#2563eb',
                              borderRadius: '2px',
                              display: 'inline-block',
                            }}
                          />
                          Aplicado
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              background: '#16a34a',
                              borderRadius: '2px',
                              display: 'inline-block',
                            }}
                          />
                          Saldo atual
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Metas */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <p style={cardTitleStyle}>Metas</p>
                    <p style={cardSubtitleStyle}>{metas.length} ativa(s)</p>
                  </div>
                  <button onClick={() => navigate('/metas')} style={outlineBtnStyle}>
                    Ver metas
                  </button>
                </div>

                {loadingMetas ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[1, 2, 3].map((i) => <Skeleton key={i} height="60px" />)}
                  </div>
                ) : metas.length === 0 ? (
                  <p style={{ color: colors.neutral500, fontSize: typography.sizes.sm, textAlign: 'center', padding: '16px 0' }}>
                    Nenhuma meta ativa.
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        marginBottom: '12px',
                        padding: '8px 12px',
                        background: colors.neutral50,
                        borderRadius: radius.md,
                        fontSize: typography.sizes.sm,
                        color: colors.neutral600,
                      }}
                    >
                      Total:{' '}
                      <strong>
                        {formatBRL(metasTotalAtual)} / {formatBRL(metasTotalAlvo)}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {metas.map((meta) => {
                        const { valorAlvo, valorAtual, dataFim } = normalizeMeta(meta);
                        const pct =
                          valorAlvo > 0
                            ? Math.min(100, (valorAtual / valorAlvo) * 100)
                            : 0;
                        return (
                          <div key={meta.id}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '4px',
                                gap: '6px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FontAwesomeIcon
                                  icon={faBullseye}
                                  style={{ color: colors.primaryLight, fontSize: '12px' }}
                                />
                                <span
                                  style={{
                                    fontSize: typography.sizes.sm,
                                    fontWeight: typography.weights.medium,
                                    color: colors.neutral800,
                                  }}
                                >
                                  {meta.nome}
                                </span>
                                {meta.prioridade && (
                                  <PrioridadeBadge prioridade={meta.prioridade} />
                                )}
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: typography.sizes.xs,
                                  color: colors.neutral500,
                                }}
                              >
                                {dataFim && <span>{formatDate(dataFim)}</span>}
                                <span style={{ fontWeight: typography.weights.semibold, color: colors.primaryLight }}>
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <ProgressBar pct={pct} />
                            <p
                              style={{
                                margin: '3px 0 0',
                                fontSize: typography.sizes.xs,
                                color: colors.neutral500,
                              }}
                            >
                              {formatBRL(valorAtual)} / {formatBRL(valorAlvo)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Finlly advisor ── */}
            <div
              style={{
                ...cardStyle,
                marginBottom: '20px',
                display: 'flex',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
              }}
            >
              <div>
                <p
                  style={{
                    margin: '0 0 2px',
                    fontSize: typography.sizes.xl,
                    fontWeight: typography.weights.semibold,
                    color: colors.white,
                  }}
                >
                  Finlly
                </p>
                <p style={{ margin: '0 0 6px', fontSize: typography.sizes.xs, color: 'rgba(255,255,255,0.8)' }}>
                  Seu consultor financeiro
                </p>
                <p style={{ margin: 0, fontSize: typography.sizes.sm, color: 'rgba(255,255,255,0.9)' }}>
                  Organize sua semana, revise vencimentos e ajuste metas com disciplina.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/anexos')}
                  style={{
                    padding: '8px 16px',
                    fontSize: typography.sizes.sm,
                    background: 'rgba(255,255,255,0.2)',
                    color: colors.white,
                    border: '1px solid rgba(255,255,255,0.4)',
                    borderRadius: radius.sm,
                    cursor: 'pointer',
                    fontWeight: typography.weights.medium,
                  }}
                >
                  Enviar comprovante/extrato
                </button>
                <button
                  onClick={() => navigate('/metas')}
                  style={{
                    padding: '8px 16px',
                    fontSize: typography.sizes.sm,
                    background: colors.white,
                    color: colors.primary,
                    border: 'none',
                    borderRadius: radius.sm,
                    cursor: 'pointer',
                    fontWeight: typography.weights.medium,
                  }}
                >
                  Revisar metas
                </button>
              </div>
            </div>

          </div>{/* /page content */}

          {/* ── Footer ── */}
          <div
            style={{
              background: colors.primary,
              color: 'rgba(255,255,255,0.8)',
              textAlign: 'center',
              padding: '14px',
              fontSize: typography.sizes.xs,
            }}
          >
            Finlly • painel financeiro pessoal — {year}
          </div>
        </main>
      </div>
    </InadimplenteGuard>
  );
}
