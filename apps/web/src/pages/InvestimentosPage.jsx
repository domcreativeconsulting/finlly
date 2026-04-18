import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { investimentosService } from '../services/investimentos.service.js';
import { contasService } from '../services/contas.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faBars,
  faInbox,
  faPenToSquare,
  faTrash,
  faPlus,
  faArrowTrendUp,
  faArrowTrendDown,
  faMoneyBillWave,
  faPercent,
  faCommentDollar,
  faFilter,
  faCreditCard,
  faCircleUser,
  faDoorOpen,
} from '@fortawesome/free-solid-svg-icons';
import { Button, Badge, Modal } from '../design-system/index.js';
import {
  colors,
  typography,
  radius,
  shadows,
} from '../design-system/tokens.js';

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

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = String(dateStr).substring(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '-';
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

function todayISO() {
  return new Date().toISOString().substring(0, 10);
}

function calcularPrazo(dataVencimento) {
  if (!dataVencimento) return '-';
  const hoje = new Date();
  const venc = new Date(dataVencimento);
  const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Vencido';
  return diff === 1 ? '1 dia' : `${diff} dias`;
}

const TIPO_EVENTO_LABELS = {
  aporte: 'Aporte',
  resgate: 'Resgate',
  rendimento: 'Rendimento',
  taxa: 'Taxa',
  dividendo: 'Dividendo',
};

const TIPOS_INVESTIMENTO = [
  'CDB',
  'LCI/LCA',
  'Tesouro Direto',
  'Fundo',
  'Ações',
  'FII',
  'Cripto',
  'Poupança',
  'Outro',
];

const MODELOS_RENTABILIDADE = [
  'Pré-fixado',
  'Pós CDI',
  'IPCA +',
  'Renda variável',
  'Outro',
];

const EMPTY_FORM = {
  contaId: '',
  tipoInvestimento: '',
  produto: '',
  dataAplicacao: todayISO(),
  dataVencimento: '',
  valorAplicado: '',
  taxaAnual: '',
  modeloRentabilidade: '',
  observacoes: '',
  status: 'ativa',
};

function TipoEventoBadge({ tipo }) {
  const variantMap = {
    aporte: 'success',
    resgate: 'danger',
    rendimento: 'success',
    taxa: 'danger',
    dividendo: 'info',
  };
  return (
    <Badge variant={variantMap[tipo] || 'neutral'}>
      {TIPO_EVENTO_LABELS[tipo] || tipo}
    </Badge>
  );
}

export default function InvestimentosPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [investimentos, setInvestimentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [modalAberto, setModalAberto] = useState(false);
  const [investimentoEmEdicao, setInvestimentoEmEdicao] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [modalEventosAberto, setModalEventosAberto] = useState(false);
  const [investimentoSelecionado, setInvestimentoSelecionado] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [posicao, setPosicao] = useState(null);
  const [posicoes, setPosicoes] = useState({});

  const [modalCriarEvento, setModalCriarEvento] = useState(false);
  const [formEvento, setFormEvento] = useState({
    tipo: 'aporte',
    valor: '',
    data: todayISO(),
    descricao: '',
  });
  const [savingEvento, setSavingEvento] = useState(false);

  // Filter states
  const [filtroContaInstituicao, setFiltroContaInstituicao] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroDataDe, setFiltroDataDe] = useState('');
  const [filtroDataAte, setFiltroDataAte] = useState('');
  const [filtrosAtivos, setFiltrosAtivos] = useState({
    conta: 'todas',
    tipo: 'todos',
    dataDe: '',
    dataAte: '',
  });

  const carregarInvestimentos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await investimentosService.listar({ page });
      const items = result.items ?? [];
      setInvestimentos(items);
      setTotal(result.total ?? 0);
      setTotalPages(result.totalPages ?? 1);
      // Load positions in background for each investment
      items.forEach((inv) => {
        investimentosService
          .getPosicao(inv.id)
          .then((res) => {
            setPosicoes((prev) => ({ ...prev, [inv.id]: res.posicao }));
          })
          .catch(() => {});
      });
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Erro ao carregar investimentos.'
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  const carregarTipos = useCallback(async () => {
    try {
      const result = await investimentosService.listarTipos();
      setTipos(result.items ?? []);
    } catch {
      // silently fail; tipos are optional for display
    }
  }, []);

  const carregarContas = useCallback(async () => {
    try {
      const result = await contasService.listar();
      setContas(Array.isArray(result) ? result : []);
    } catch {
      // silently fail; contas are optional
    }
  }, []);

  useEffect(() => {
    carregarInvestimentos();
  }, [carregarInvestimentos]);

  useEffect(() => {
    carregarTipos();
  }, [carregarTipos]);

  useEffect(() => {
    carregarContas();
  }, [carregarContas]);

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

  function abrirModal(investimento = null) {
    setInvestimentoEmEdicao(investimento);
    if (investimento) {
setForm({
  contaId: investimento.contaId || '',
  tipoInvestimento: investimento.tipoId || '',
  produto: investimento.nome || '',
  dataAplicacao: investimento.dataInicio || todayISO(),
  dataVencimento: investimento.dataVencimento || '',
  valorAplicado: String(investimento.valorInicial ?? ''),
  taxaAnual: String(investimento.taxaAnual ?? ''),
  modeloRentabilidade: investimento.modeloRentabilidade || '',
  observacoes: investimento.observacoes || '',
  status: investimento.status || 'ativa',
});
    } else {
      setForm(EMPTY_FORM);
    }
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setInvestimentoEmEdicao(null);
    setForm(EMPTY_FORM);
  }

  async function handleSalvar(e) {
    e.preventDefault();
    setSaving(true);
    try {
const payload = {
  nome: form.produto || '',                 // string
  tipoId: form.tipoInvestimento || undefined, // UUID esperado pela API
  valorInicial: parseFloat(form.valorAplicado) || 0,
  dataInicio: form.dataAplicacao,
  dataVencimento: form.dataVencimento || undefined,
  observacoes: form.observacoes || undefined,
};

      if (investimentoEmEdicao) {
        payload.status = form.status;
        await investimentosService.atualizar(investimentoEmEdicao.id, payload);
        toast.success('Investimento atualizado com sucesso!');
      } else {
        await investimentosService.criar(payload);
        toast.success('Investimento criado com sucesso!');
      }
      fecharModal();
      carregarInvestimentos();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Erro ao salvar investimento.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(id) {
    if (
      !window.confirm(
        'Deseja excluir este investimento? Esta ação não pode ser desfeita.'
      )
    )
      return;
    try {
      await investimentosService.excluir(id);
      toast.success('Investimento excluído.');
      carregarInvestimentos();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Erro ao excluir investimento.'
      );
    }
  }

  async function carregarEventos(investimentoId) {
    setLoadingEventos(true);
    try {
      const result = await investimentosService.listarEventos(investimentoId);
      setEventos(result.items ?? []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao carregar eventos.');
    } finally {
      setLoadingEventos(false);
    }
  }

  async function abrirEventos(investimento) {
    setInvestimentoSelecionado(investimento);
    setEventos([]);
    setPosicao(null);
    setModalEventosAberto(true);
    await carregarEventos(investimento.id);
    try {
      const result = await investimentosService.getPosicao(investimento.id);
      setPosicao(result.posicao);
    } catch {
      // posicao optional
    }
  }

  function fecharEventos() {
    setModalEventosAberto(false);
    setInvestimentoSelecionado(null);
    setEventos([]);
    setPosicao(null);
    setModalCriarEvento(false);
    setFormEvento({
      tipo: 'aporte',
      valor: '',
      data: todayISO(),
      descricao: '',
    });
  }

  async function handleCriarEvento(e) {
    e.preventDefault();
    setSavingEvento(true);
    try {
      await investimentosService.criarEvento(investimentoSelecionado.id, {
        tipo: formEvento.tipo,
        valor: parseFloat(formEvento.valor),
        data: formEvento.data,
        descricao: formEvento.descricao || undefined,
      });
      toast.success('Evento registrado com sucesso!');
      setModalCriarEvento(false);
      setFormEvento({
        tipo: 'aporte',
        valor: '',
        data: todayISO(),
        descricao: '',
      });
      await carregarEventos(investimentoSelecionado.id);
      const result = await investimentosService.getPosicao(
        investimentoSelecionado.id
      );
      setPosicao(result.posicao);
      carregarInvestimentos();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao registrar evento.');
    } finally {
      setSavingEvento(false);
    }
  }

  async function handleExcluirEvento(eventoId) {
    if (!window.confirm('Deseja excluir este evento?')) return;
    try {
      await investimentosService.excluirEvento(
        investimentoSelecionado.id,
        eventoId
      );
      toast.success('Evento excluído.');
      await carregarEventos(investimentoSelecionado.id);
      const result = await investimentosService.getPosicao(
        investimentoSelecionado.id
      );
      setPosicao(result.posicao);
      carregarInvestimentos();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir evento.');
    }
  }

  const saldoColor = (val) => {
    if (val > 0) return '#16a34a';
    if (val < 0) return '#dc2626';
    return '#6b7280';
  };

  // Filter applied investments
  const investimentosFiltrados = investimentos.filter((inv) => {
    if (
      filtrosAtivos.conta !== 'todas' &&
      inv.contaNome !== filtrosAtivos.conta
    )
      return false;
    if (
      filtrosAtivos.tipo !== 'todos' &&
      String(inv.tipoId) !== filtrosAtivos.tipo
    )
      return false;
    if (filtrosAtivos.dataDe && inv.dataInicio < filtrosAtivos.dataDe)
      return false;
    if (filtrosAtivos.dataAte && inv.dataInicio > filtrosAtivos.dataAte)
      return false;
    return true;
  });

  // Summary card calculations
  const totalAplicado = investimentosFiltrados.reduce(
    (acc, inv) => acc + (inv.valorInicial ?? 0),
    0
  );
  const saldoEstimado = investimentosFiltrados.reduce(
    (acc, inv) => acc + (posicoes[inv.id]?.saldoAtual ?? inv.valorInicial ?? 0),
    0
  );
  const ganhoEstimado = saldoEstimado - totalAplicado;
  const rentMedia =
    totalAplicado > 0 ? (ganhoEstimado / totalAplicado) * 100 : 0;

  // Unique conta/instituição options for filter
  const contasUnicas = [
    ...new Set(investimentos.map((inv) => inv.contaNome).filter(Boolean)),
  ];

  function aplicarFiltros() {
    setFiltrosAtivos({
      conta: filtroContaInstituicao,
      tipo: filtroTipo,
      dataDe: filtroDataDe,
      dataAte: filtroDataAte,
    });
  }

  function limparFiltros() {
    setFiltroContaInstituicao('todas');
    setFiltroTipo('todos');
    setFiltroDataDe('');
    setFiltroDataAte('');
    setFiltrosAtivos({
      conta: 'todas',
      tipo: 'todos',
      dataDe: '',
      dataAte: '',
    });
  }

  function handleInputFocus(e) {
    e.currentTarget.style.outline = '2px solid rgb(37 99 235 / 45%)';
    e.currentTarget.style.outlineOffset = '0px';
  }
  function handleInputBlur(e) {
    e.currentTarget.style.outline = 'none';
  }

  return (
    <>
      <div
        style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}
      >
        <AppSidebar
          sidebarOpen={sidebarOpen}
          currentPath="/investimentos"
          isExpanded={sidebarExpanded}
          onHoverChange={setSidebarExpanded}
        />
        <div
          style={{
            ...s.mainArea,
            marginLeft: !sidebarOpen
              ? '0px'
              : sidebarExpanded
                ? '236px'
                : '108px',
            transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Top Bar */}
          <div style={s.topBar}>
            <div style={s.topBarLeft}>
              <button
                style={s.hamburger}
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 4,
                  }}
                >
                  <FontAwesomeIcon
                    icon={faChartLine}
                    style={{ fontSize: 24, color: '#2563eb' }}
                  />
                  <h1 style={s.pageTitle}>Investimentos</h1>
                  <span style={s.badge}>Carteira pessoal • Organiza</span>
                </div>
                <p
                  style={{
                    margin: '0 0 16px 0',
                    fontSize: 14,
                    color: colors.neutral600 ?? '#4b5563',
                  }}
                >
                  Cadastre seus investimentos, acompanhe o valor aplicado, o
                  saldo estimado e a rentabilidade ao longo do tempo.
                </p>
                <Button variant="primary" onClick={() => abrirModal()}>
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                  Novo investimento
                </Button>
              </div>
            </div>

            {/* Avatar / Dropdown */}
            <div
              ref={dropdownRef}
              style={{ position: 'relative', flexShrink: 0 }}
            >
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
                  boxShadow: dropdownOpen
                    ? '0 0 0 3px rgba(37,99,235,0.25)'
                    : 'none',
                }}
                title={usuario?.nome || ''}
                aria-label={`Menu do usuário ${usuario?.nome || ''}`}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                {initials}
              </button>

              {dropdownOpen && (
                <div
                  style={{
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
                  }}
                >
                  <div style={{ padding: '14px 16px 12px' }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '2px',
                      }}
                    >
                      {usuario?.nome || 'Usuário'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {usuario?.email || ''}
                    </div>
                  </div>

                  <hr
                    style={{
                      margin: '4px 0',
                      border: 'none',
                      borderTop: '1px solid #f3f4f6',
                    }}
                  />

                  <button
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onClick={() => handleMenuNavigate('/assinatura')}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = '#f3f4f6')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    <FontAwesomeIcon
                      icon={faCreditCard}
                      style={{ fontSize: '18px', marginRight: '5px' }}
                    />
                    Assinatura
                  </button>

                  <button
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onClick={() => handleMenuNavigate('/perfil')}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = '#f3f4f6')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    <FontAwesomeIcon
                      icon={faCircleUser}
                      style={{
                        fontSize: '18px',
                        color: '#4b5563',
                        marginRight: '5px',
                      }}
                    />
                    Perfil
                  </button>

                  <hr
                    style={{
                      margin: '4px 0',
                      border: 'none',
                      borderTop: '1px solid #f3f4f6',
                    }}
                  />

                  <button
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#dc2626',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = '#fef2f2')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    <FontAwesomeIcon
                      icon={faDoorOpen}
                      style={{ fontSize: '18px', marginRight: '5px' }}
                    />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <InadimplenteGuard>
            <div style={s.content}>
              {/* Summary Cards */}
              {!loading && !error && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  {/* Card 1 – Total aplicado */}
                  <div style={cardStyle}>
                    <p style={cardLabelStyle}>Total aplicado</p>
                    <p style={cardValueStyle}>{formatBRL(totalAplicado)}</p>
                    <p style={cardSubStyle}>Somatório dos aportes filtrados.</p>
                    <FontAwesomeIcon
                      icon={faCommentDollar}
                      style={{ color: '#2563eb', fontSize: 18, marginTop: 8 }}
                    />
                  </div>
                  {/* Card 2 – Saldo estimado */}
                  <div style={cardStyle}>
                    <p style={cardLabelStyle}>Saldo estimado hoje</p>
                    <p style={cardValueStyle}>{formatBRL(saldoEstimado)}</p>
                    <p style={cardSubStyle}>
                      Aplicado + rentabilidade estimada.
                    </p>
                    <FontAwesomeIcon
                      icon={faChartLine}
                      style={{ color: '#2563eb', fontSize: 18, marginTop: 8 }}
                    />
                  </div>
                  {/* Card 3 – Ganho estimado */}
                  <div style={cardStyle}>
                    <p style={cardLabelStyle}>Ganho estimado</p>
                    <p
                      style={{
                        ...cardValueStyle,
                        color: ganhoEstimado >= 0 ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {formatBRL(ganhoEstimado)}
                    </p>
                    <p style={cardSubStyle}>
                      Rent. média: {rentMedia.toFixed(2)}% (estimada)
                    </p>
                    <FontAwesomeIcon
                      icon={faPercent}
                      style={{ color: '#2563eb', fontSize: 18, marginTop: 8 }}
                    />
                  </div>
                </div>
              )}

              {/* Filters Section */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  boxShadow: shadows.sm,
                  padding: '20px 24px',
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: colors.neutral800 ?? '#1e293b',
                    }}
                  >
                    Filtros da carteira
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: colors.neutral500 ?? '#6b7280',
                    }}
                  >
                    Refine os dados para análises específicas
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Conta / instituição</label>
                    <select
                      style={inputStyle}
                      value={filtroContaInstituicao}
                      onChange={(e) =>
                        setFiltroContaInstituicao(e.target.value)
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    >
                      <option value="todas">Todas</option>
                      {contasUnicas.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo de investimento</label>
                    <select
                      style={inputStyle}
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    >
                      <option value="todos">Todos</option>
                      {tipos.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Aplicação de</label>
                    <input
                      style={inputStyle}
                      type="date"
                      value={filtroDataDe}
                      onChange={(e) => setFiltroDataDe(e.target.value)}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>até</label>
                    <input
                      style={inputStyle}
                      type="date"
                      value={filtroDataAte}
                      onChange={(e) => setFiltroDataAte(e.target.value)}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Button variant="primary" onClick={aplicarFiltros}>
                    <FontAwesomeIcon
                      icon={faFilter}
                      style={{ marginRight: 6 }}
                    />
                    Filtrar
                  </Button>
                  <button
                    onClick={limparFiltros}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      color: '#2563eb',
                      padding: '6px 4px',
                    }}
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Loading / Error / Empty */}
              {loading && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 48,
                    color: colors.neutral500 ?? '#6b7280',
                  }}
                >
                  Carregando...
                </div>
              )}

              {!loading && error && (
                <div
                  style={{ textAlign: 'center', padding: 48, color: '#dc2626' }}
                >
                  {error}
                </div>
              )}

              {!loading && !error && investimentosFiltrados.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 64,
                    color: colors.neutral400 ?? '#9ca3af',
                  }}
                >
                  <FontAwesomeIcon
                    icon={faInbox}
                    style={{
                      fontSize: 48,
                      marginBottom: 16,
                      display: 'block',
                      marginLeft: 'auto',
                      marginRight: 'auto',
                    }}
                  />
                  <p style={{ margin: 0 }}>
                    {investimentos.length === 0
                      ? 'Nenhum investimento encontrado. Crie o primeiro!'
                      : 'Nenhum investimento corresponde aos filtros aplicados.'}
                  </p>
                </div>
              )}

              {/* Investment Table */}
              {!loading && !error && investimentosFiltrados.length > 0 && (
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    boxShadow: shadows.sm,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      padding: '16px 20px',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 15,
                        color: colors.neutral800 ?? '#1e293b',
                      }}
                    >
                      Carteira de investimentos
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: colors.neutral500 ?? '#6b7280',
                      }}
                    >
                      Controle por aplicação
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr
                          style={{ background: colors.neutral100 ?? '#f3f4f6' }}
                        >
                          {[
                            'Data aplicação',
                            'Conta / Banco',
                            'Tipo',
                            'Produto',
                            'Aplicado (R$)',
                            'Atual (R$)',
                            'Ganho (R$)',
                            'Rent. (%)',
                            'Prazo',
                            'Ações',
                          ].map((col) => (
                            <th
                              key={col}
                              style={{
                                padding: '10px 14px',
                                textAlign: 'left',
                                fontWeight: 600,
                                color: colors.neutral700 ?? '#374151',
                                borderBottom: '1px solid #e5e7eb',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {investimentosFiltrados.map((inv, idx) => {
                          const pos = posicoes[inv.id];
                          const saldoAtual =
                            pos?.saldoAtual ?? inv.valorInicial ?? 0;
                          const ganho = saldoAtual - (inv.valorInicial ?? 0);
                          const rentPct =
                            (inv.valorInicial ?? 0) > 0
                              ? (ganho / inv.valorInicial) * 100
                              : 0;
                          const ganhoColor =
                            ganho > 0
                              ? '#16a34a'
                              : ganho < 0
                                ? '#dc2626'
                                : (colors.neutral600 ?? '#4b5563');

                          return (
                            <tr
                              key={inv.id}
                              style={{
                                background:
                                  idx % 2 === 0
                                    ? '#fff'
                                    : (colors.neutral50 ?? '#f9fafb'),
                                borderBottom: '1px solid #f3f4f6',
                              }}
                            >
                              <td
                                style={{
                                  padding: '10px 14px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatDate(inv.dataInicio)}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>
                                  {inv.contaNome || '-'}
                                </div>
                                {inv.contaBanco && (
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: colors.neutral500 ?? '#6b7280',
                                    }}
                                  >
                                    {inv.contaBanco}
                                  </div>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: '10px 14px',
                                  color: colors.neutral600 ?? '#4b5563',
                                }}
                              >
                                {inv.tipoNome || '-'}
                              </td>
                              <td
                                style={{
                                  padding: '10px 14px',
                                  fontWeight: 500,
                                }}
                              >
                                {inv.nome}
                              </td>
                              <td
                                style={{
                                  padding: '10px 14px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatBRL(inv.valorInicial)}
                              </td>
                              <td
                                style={{
                                  padding: '10px 14px',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {pos !== undefined ? (
                                  formatBRL(saldoAtual)
                                ) : (
                                  <span
                                    style={{
                                      color: colors.neutral400 ?? '#9ca3af',
                                    }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: '10px 14px',
                                  fontWeight: 600,
                                  color: ganhoColor,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {pos !== undefined ? (
                                  formatBRL(ganho)
                                ) : (
                                  <span
                                    style={{
                                      color: colors.neutral400 ?? '#9ca3af',
                                    }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: '10px 14px',
                                  fontWeight: 600,
                                  color: ganhoColor,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {pos !== undefined ? (
                                  `${rentPct.toFixed(2)}%`
                                ) : (
                                  <span
                                    style={{
                                      color: colors.neutral400 ?? '#9ca3af',
                                    }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: '10px 14px',
                                  whiteSpace: 'nowrap',
                                  color: colors.neutral600 ?? '#4b5563',
                                }}
                              >
                                {calcularPrazo(inv.dataVencimento)}
                              </td>
                              <td
                                style={{
                                  padding: '10px 14px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    title="Editar"
                                    onClick={() => abrirModal(inv)}
                                    style={iconBtn}
                                  >
                                    <FontAwesomeIcon icon={faPenToSquare} />
                                  </button>
                                  <button
                                    title="Eventos"
                                    onClick={() => abrirEventos(inv)}
                                    style={iconBtn}
                                  >
                                    <FontAwesomeIcon icon={faChartLine} />
                                  </button>
                                  <button
                                    title="Excluir"
                                    onClick={() => handleExcluir(inv.id)}
                                    style={{ ...iconBtn, color: '#dc2626' }}
                                  >
                                    <FontAwesomeIcon icon={faTrash} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 12,
                    marginTop: 24,
                  }}
                >
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span
                    style={{
                      alignSelf: 'center',
                      fontSize: 14,
                      color: '#4b5563',
                    }}
                  >
                    Página {page} de {totalPages} ({total} itens)
                  </span>
                  <Button
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próximo
                  </Button>
                </div>
              )}
            </div>
          </InadimplenteGuard>

          {/* Footer */}
          <div style={s.footer}>
            Finlly • painel financeiro pessoal — {new Date().getFullYear()}
          </div>
        </div>
      </div>
      <Modal
        open={modalAberto}
        onClose={fecharModal}
        title={
          investimentoEmEdicao ? 'Editar Investimento' : 'Novo investimento'
        }
      >
        <form
          onSubmit={handleSalvar}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {/* Linha 1: Conta / Instituição + Tipo de investimento */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <div>
              <label style={labelStyle}>
                Conta / Instituição <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                style={inputStyle}
                required
                value={form.contaId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contaId: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              >
                <option value="">Selecione...</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Use as contas cadastradas no módulo de contas.
              </p>
            </div>
            <div>
              <label style={labelStyle}>
                Tipo de investimento <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                style={inputStyle}
                required
                value={form.tipoInvestimento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipoInvestimento: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              >
                <option value="">Selecione...</option>
{tipos && tipos.length > 0 ? (
  tipos.map((t) => (
    <option key={t.id} value={t.id}>
      {t.nome}
    </option>
  ))
) : (
  // fallback visual (se por algum motivo tipos estiver vazio)
  TIPOS_INVESTIMENTO.map((t) => (
    <option key={t} value={t}>
      {t}
    </option>
  ))
)}
              </select>
            </div>
          </div>

          {/* Linha 2: Produto / Descrição + Data de aplicação */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <div>
              <label style={labelStyle}>Produto / Descrição</label>
              <input
                style={inputStyle}
                type="text"
                maxLength={255}
                placeholder="Ex.: CDB 120% CDI, Fundo XYZ"
                value={form.produto}
                onChange={(e) =>
                  setForm((f) => ({ ...f, produto: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Data de aplicação <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                style={inputStyle}
                type="date"
                required
                value={form.dataAplicacao}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dataAplicacao: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
          </div>

          {/* Linha 3: Data de vencimento + Valor aplicado + Taxa anual */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
            }}
          >
            <div>
              <label style={labelStyle}>Data de vencimento</label>
              <input
                style={inputStyle}
                type="date"
                value={form.dataVencimento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dataVencimento: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Valor aplicado (R$) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="0.00"
                value={form.valorAplicado}
                onChange={(e) =>
                  setForm((f) => ({ ...f, valorAplicado: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Formato: 1234.56
              </p>
            </div>
            <div>
              <label style={labelStyle}>Taxa anual (% a.a.)</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex.: 12,5"
                value={form.taxaAnual}
                onChange={(e) =>
                  setForm((f) => ({ ...f, taxaAnual: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Usada para estimar o valor diário.
              </p>
            </div>
          </div>

          {/* Linha 4: Modelo de rentabilidade */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <div>
              <label style={labelStyle}>Modelo de rentabilidade</label>
              <select
                style={inputStyle}
                value={form.modeloRentabilidade}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    modeloRentabilidade: e.target.value,
                  }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              >
                <option value="">Selecione...</option>
                {MODELOS_RENTABILIDADE.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 5: Observações */}
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              maxLength={1000}
              placeholder="Detalhes adicionais, estratégias, metas para esse investimento..."
              value={form.observacoes}
              onChange={(e) =>
                setForm((f) => ({ ...f, observacoes: e.target.value }))
              }
            />
          </div>

          {investimentoEmEdicao && (
            <div>
              <label style={labelStyle}>Status</label>
              <select
                style={inputStyle}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              >
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
                <option value="arquivada">Arquivada</option>
              </select>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 4,
            }}
          >
            <Button
              type="button"
              variant="secondary"
              onClick={fecharModal}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar investimento'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de eventos */}
      <Modal
        open={modalEventosAberto}
        onClose={fecharEventos}
        title={`Eventos — ${investimentoSelecionado?.nome ?? ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Posição consolidada */}
          {posicao && (
            <div
              style={{
                background: '#f9fafb',
                borderRadius: 8,
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px 16px',
              }}
            >
              <PosicaoItem
                label="Total Aportado"
                valor={posicao.totalAportado}
                icon={faArrowTrendUp}
                positive
              />
              <PosicaoItem
                label="Total Resgatado"
                valor={posicao.totalResgatado}
                icon={faArrowTrendDown}
                negative
              />
              <PosicaoItem
                label="Total Rendimentos"
                valor={posicao.totalRendimentos}
                icon={faArrowTrendUp}
                positive
              />
              <PosicaoItem
                label="Total Taxas"
                valor={posicao.totalTaxas}
                icon={faArrowTrendDown}
                negative
              />
              <PosicaoItem
                label="Total Dividendos"
                valor={posicao.totalDividendos}
                icon={faMoneyBillWave}
                positive
              />
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0 0',
                  borderTop: '1px solid #e5e7eb',
                  marginTop: 4,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  Saldo Atual
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: saldoColor(posicao.saldoAtual),
                  }}
                >
                  {formatBRL(posicao.saldoAtual)}
                </span>
              </div>
            </div>
          )}

          {/* Header eventos */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Eventos</span>
            <Button variant="primary" onClick={() => setModalCriarEvento(true)}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
              Registrar evento
            </Button>
          </div>

          {/* Submodal criar evento */}
          {modalCriarEvento && (
            <div
              style={{
                background: '#f3f4f6',
                borderRadius: 8,
                padding: 16,
              }}
            >
              <form
                onSubmit={handleCriarEvento}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Tipo *</label>
                    <select
                      style={inputStyle}
                      required
                      value={formEvento.tipo}
                      onChange={(e) =>
                        setFormEvento((f) => ({ ...f, tipo: e.target.value }))
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    >
                      {Object.entries(TIPO_EVENTO_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Valor *</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={formEvento.valor}
                      onChange={(e) =>
                        setFormEvento((f) => ({ ...f, valor: e.target.value }))
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Data *</label>
                    <input
                      style={inputStyle}
                      type="date"
                      required
                      value={formEvento.data}
                      onChange={(e) =>
                        setFormEvento((f) => ({ ...f, data: e.target.value }))
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Descrição</label>
                    <input
                      style={inputStyle}
                      type="text"
                      maxLength={500}
                      value={formEvento.descricao}
                      onChange={(e) =>
                        setFormEvento((f) => ({
                          ...f,
                          descricao: e.target.value,
                        }))
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8,
                  }}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setModalCriarEvento(false)}
                    disabled={savingEvento}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingEvento}
                  >
                    {savingEvento ? 'Salvando...' : 'Registrar'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Tabela eventos */}
          {loadingEventos && (
            <div style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
              Carregando eventos...
            </div>
          )}
          {!loadingEventos && eventos.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
              <FontAwesomeIcon icon={faInbox} style={{ marginRight: 8 }} />
              Nenhum evento registrado.
            </div>
          )}
          {!loadingEventos && eventos.length > 0 && (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  {['Data', 'Tipo', 'Valor', 'Descrição', ''].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#374151',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 12px' }}>
                      {formatDate(ev.data)}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <TipoEventoBadge tipo={ev.tipo} />
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                      {formatBRL(ev.valor)}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#4b5563' }}>
                      {ev.descricao || '-'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        title="Excluir evento"
                        onClick={() => handleExcluirEvento(ev.id)}
                        style={{ ...iconBtn, color: '#dc2626' }}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={fecharEventos}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PosicaoItem({ label, valor, icon, positive, negative }) {
  const color = positive ? '#16a34a' : negative ? '#dc2626' : '#374151';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
        <FontAwesomeIcon icon={icon} style={{ marginRight: 4 }} />
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color }}>
        {formatBRL(valor)}
      </span>
    </div>
  );
}

const iconBtn = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 6px',
  borderRadius: 4,
  color: colors.neutral600 ?? '#4b5563',
  fontSize: 14,
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  padding: '20px 24px',
};

const cardLabelStyle = {
  margin: '0 0 6px 0',
  fontSize: 12,
  fontWeight: 600,
  color: colors.neutral500 ?? '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const cardValueStyle = {
  margin: '0 0 4px 0',
  fontSize: 22,
  fontWeight: 700,
  color: colors.neutral800 ?? '#1e293b',
};

const cardSubStyle = {
  margin: 0,
  fontSize: 12,
  color: colors.neutral500 ?? '#6b7280',
};

const labelStyle = {
  display: 'block',
  marginBottom: 4,
  fontSize: 13,
  fontWeight: 500,
  color: colors.neutral700 ?? '#374151',
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${colors.neutral300 ?? '#d1d5db'}`,
  fontSize: 14,
  boxSizing: 'border-box',
};

const s = {
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    fontFamily: typography.fontFamily,
  },
  topBar: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '16px 28px',
    background: colors.white,
    borderBottom: `1px solid ${colors.border ?? '#e5e7eb'}`,
    gap: '16px',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  hamburger: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: colors.neutral600 ?? '#4b5563',
    padding: '4px 8px',
    borderRadius: radius.sm ?? '6px',
    marginTop: '2px',
  },
  pageTitle: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 700,
    color: colors.neutral900 ?? '#111827',
  },
  badge: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#2563eb',
    background: '#eff6ff',
    borderRadius: '99px',
    padding: '2px 10px',
  },
  content: {
    padding: '20px 28px',
    flex: 1,
  },
  footer: {
    backgroundColor: '#33528a',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingTop: '18px',
    paddingBottom: '18px',
    paddingLeft: '32px',
    paddingRight: '32px',
    fontSize: '14px',
    fontWeight: '500',
    letterSpacing: '0.01em',
    borderRadius: radius.lg ?? '12px',
    margin: '24px 28px 28px',
  },
};
