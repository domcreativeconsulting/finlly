import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { metasService } from '../services/metas.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullseye,
  faBars,
  faPlus,
  faPenToSquare,
  faTrash,
  faInbox,
  faFilter,
  faCreditCard,
  faCircleUser,
  faDoorOpen,
  faChevronLeft,
  faChevronRight,
  faCoins,
  faMinus,
} from '@fortawesome/free-solid-svg-icons';
import { Button, Badge, Modal } from '../design-system/index.js';
import { colors, typography, radius, shadows } from '../design-system/tokens.js';

const STATUS_META_LABELS = { ativa: 'Ativa', concluida: 'Concluída', cancelada: 'Cancelada' };
const TIPO_META_LABELS = { economia: 'Economia', despesa: 'Despesa', investimento: 'Investimento' };
const STATUS_META_ENUM = ['ativa', 'concluida', 'cancelada'];
const TIPO_META_ENUM = ['economia', 'despesa', 'investimento'];
const COR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const EMPTY_FORM = {
  nome: '',
  tipo: 'economia',
  valor_alvo: '',
  data_inicio: todayISO(),
  data_fim: '',
  status: 'ativa',
  icone: '',
  cor: '',
  observacoes: '',
};

const EMPTY_MOV_FORM = { valor: '', data: todayISO(), descricao: '', tipo: 'aporte' };

function formatMovDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

function StatusBadge({ status }) {
  const variantMap = { ativa: 'success', concluida: 'info', cancelada: 'danger' };
  return (
    <Badge variant={variantMap[status] || 'neutral'}>
      {STATUS_META_LABELS[status] || status}
    </Badge>
  );
}

function TipoBadge({ tipo }) {
  const variantMap = { economia: 'success', despesa: 'danger', investimento: 'info' };
  return (
    <Badge variant={variantMap[tipo] || 'neutral'}>
      {TIPO_META_LABELS[tipo] || tipo}
    </Badge>
  );
}

export default function MetasPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [modalAberto, setModalAberto] = useState(false);
  const [metaEmEdicao, setMetaEmEdicao] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');

  const [confirmDelete, setConfirmDelete] = useState(null);

  // Movimentos modal state
  const [modalMovimentosAberto, setModalMovimentosAberto] = useState(false);
  const [metaMovimentos, setMetaMovimentos] = useState(null);
  const [loadingMovimentos, setLoadingMovimentos] = useState(false);
  const [savingMovimento, setSavingMovimento] = useState(false);
  const [confirmDeleteMov, setConfirmDeleteMov] = useState(null);
  const [formMovimento, setFormMovimento] = useState(EMPTY_MOV_FORM);

  const carregarMetas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 12 };
      if (filtroStatus) params.status = filtroStatus;
      if (filtroTipo) params.tipo = filtroTipo;
      if (filtroBusca) params.busca = filtroBusca;
      const result = await metasService.listar(params);
      setMetas(result.items ?? []);
      setTotal(result.total ?? 0);
      setTotalPages(result.totalPages ?? 1);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erro ao carregar metas.');
    } finally {
      setLoading(false);
    }
  }, [page, filtroStatus, filtroTipo, filtroBusca]);

  useEffect(() => {
    carregarMetas();
  }, [carregarMetas]);

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

  function abrirModal(meta = null) {
    setMetaEmEdicao(meta);
    if (meta) {
      setForm({
        nome: meta.nome || '',
        tipo: meta.tipo || 'economia',
        valor_alvo: String(meta.valorAlvo ?? meta.valor_alvo ?? ''),
        data_inicio: meta.dataInicio || meta.data_inicio || todayISO(),
        data_fim: meta.dataFim || meta.data_fim || '',
        status: meta.status || 'ativa',
        icone: meta.icone || '',
        cor: meta.cor || '',
        observacoes: meta.observacoes || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setMetaEmEdicao(null);
    setForm(EMPTY_FORM);
  }

  function validarForm() {
    if (!form.nome.trim()) {
      toast.error('O nome da meta é obrigatório.');
      return false;
    }
    if (!form.valor_alvo || parseFloat(form.valor_alvo) <= 0) {
      toast.error('O valor alvo deve ser um número maior que zero.');
      return false;
    }
    if (!form.data_inicio || !ISO_DATE_REGEX.test(form.data_inicio)) {
      toast.error('A data de início é obrigatória e deve estar no formato AAAA-MM-DD.');
      return false;
    }
    if (form.cor && !COR_REGEX.test(form.cor)) {
      toast.error('A cor deve estar no formato #RRGGBB (ex.: #2563eb).');
      return false;
    }
    return true;
  }

  async function handleSalvar(e) {
    e.preventDefault();
    if (!validarForm()) return;
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        valor_alvo: parseFloat(form.valor_alvo),
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || undefined,
        status: form.status,
        icone: form.icone || undefined,
        cor: form.cor || undefined,
        observacoes: form.observacoes || undefined,
      };
      if (metaEmEdicao) {
        await metasService.atualizar(metaEmEdicao.id, payload);
        toast.success('Meta atualizada com sucesso!');
      } else {
        await metasService.criar(payload);
        toast.success('Meta criada com sucesso!');
      }
      fecharModal();
      carregarMetas();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar meta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(id) {
    try {
      await metasService.excluir(id);
      toast.success('Meta excluída.');
      setConfirmDelete(null);
      carregarMetas();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir meta.');
    }
  }

  function limparFiltros() {
    setFiltroStatus('');
    setFiltroTipo('');
    setFiltroBusca('');
    setPage(1);
  }

  function aplicarFiltros(e) {
    e.preventDefault();
    setPage(1);
    carregarMetas();
  }

  async function abrirModalMovimentos(meta) {
    setModalMovimentosAberto(true);
    setMetaMovimentos(meta);
    setFormMovimento(EMPTY_MOV_FORM);
    setConfirmDeleteMov(null);
    setLoadingMovimentos(true);
    try {
      const result = await metasService.obter(meta.id);
      setMetaMovimentos(result.item ?? result);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao carregar movimentos.');
    } finally {
      setLoadingMovimentos(false);
    }
  }

  function fecharModalMovimentos() {
    setModalMovimentosAberto(false);
    setMetaMovimentos(null);
    setFormMovimento(EMPTY_MOV_FORM);
    setConfirmDeleteMov(null);
    carregarMetas();
  }

  async function recarregarMovimentos(id) {
    setLoadingMovimentos(true);
    try {
      const result = await metasService.obter(id);
      setMetaMovimentos(result.item ?? result);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar movimentos.');
    } finally {
      setLoadingMovimentos(false);
    }
  }

  async function handleCriarMovimento(e) {
    e.preventDefault();
    if (!formMovimento.valor || parseFloat(formMovimento.valor) <= 0) {
      toast.error('O valor deve ser um número positivo.');
      return;
    }
    if (!formMovimento.data) {
      toast.error('A data é obrigatória.');
      return;
    }
    setSavingMovimento(true);
    try {
      const valorFinal = formMovimento.tipo === 'retirada'
        ? -Math.abs(parseFloat(formMovimento.valor))
        : Math.abs(parseFloat(formMovimento.valor));
      await metasService.criarMovimento(metaMovimentos.id, {
        valor: valorFinal,
        data: formMovimento.data,
        descricao: formMovimento.descricao || undefined,
      });
      toast.success(formMovimento.tipo === 'retirada' ? 'Retirada registrada!' : 'Aporte registrado!');
      setFormMovimento(EMPTY_MOV_FORM);
      await recarregarMovimentos(metaMovimentos.id);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao registrar movimento.');
    } finally {
      setSavingMovimento(false);
    }
  }

  async function handleExcluirMovimento(movId) {
    try {
      await metasService.excluirMovimento(metaMovimentos.id, movId);
      toast.success('Movimento excluído.');
      setConfirmDeleteMov(null);
      await recarregarMovimentos(metaMovimentos.id);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir movimento.');
    }
  }

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
        <AppSidebar
          sidebarOpen={sidebarOpen}
          currentPath="/metas"
          isExpanded={sidebarExpanded}
          onHoverChange={setSidebarExpanded}
        />
        <div
          style={{
            ...s.mainArea,
            marginLeft: !sidebarOpen ? '0px' : sidebarExpanded ? '236px' : '108px',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                  <FontAwesomeIcon icon={faBullseye} style={{ fontSize: 24, color: '#2563eb' }} />
                  <h1 style={s.pageTitle}>Metas</h1>
                  <span style={s.badge}>{total} meta{total !== 1 ? 's' : ''}</span>
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: 14, color: colors.neutral600 ?? '#4b5563' }}>
                  Defina metas financeiras, acompanhe o progresso e alcance seus objetivos.
                </p>
                <Button variant="primary" onClick={() => abrirModal()}>
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                  Nova meta
                </Button>
              </div>
            </div>

            {/* Avatar / Dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
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

          {/* Main Content */}
          <InadimplenteGuard>
            <div style={s.content}>

              {/* Filters */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: shadows.sm, padding: '20px 24px', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <span style={{ fontWeight: 600, fontSize: 15, color: colors.neutral800 ?? '#1e293b' }}>Filtros</span>
                  <span style={{ fontSize: 13, color: colors.neutral500 ?? '#6b7280' }}>Refine a lista de metas</span>
                </div>
                <form onSubmit={aplicarFiltros}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={labelStyle}>Buscar por nome</label>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="Digite o nome da meta..."
                        value={filtroBusca}
                        onChange={(e) => setFiltroBusca(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select
                        style={inputStyle}
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value)}
                      >
                        <option value="">Todos</option>
                        {STATUS_META_ENUM.map((s) => (
                          <option key={s} value={s}>{STATUS_META_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Tipo</label>
                      <select
                        style={inputStyle}
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value)}
                      >
                        <option value="">Todos</option>
                        {TIPO_META_ENUM.map((t) => (
                          <option key={t} value={t}>{TIPO_META_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Button variant="primary" type="submit">
                      <FontAwesomeIcon icon={faFilter} style={{ marginRight: 6 }} />
                      Filtrar
                    </Button>
                    <button
                      type="button"
                      onClick={limparFiltros}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#2563eb', padding: '6px 4px' }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                </form>
              </div>

              {/* Loading / Error */}
              {loading && (
                <div style={{ textAlign: 'center', padding: 48, color: colors.neutral500 ?? '#6b7280' }}>
                  Carregando...
                </div>
              )}

              {!loading && error && (
                <div style={{ textAlign: 'center', padding: 48, color: '#dc2626' }}>
                  {error}
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && metas.length === 0 && (
                <div style={{ textAlign: 'center', padding: 64, color: colors.neutral400 ?? '#9ca3af' }}>
                  <FontAwesomeIcon icon={faInbox} style={{ fontSize: 48, marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
                  <p style={{ margin: '0 0 20px 0', fontSize: 16 }}>Nenhuma meta encontrada.</p>
                  <Button variant="primary" onClick={() => abrirModal()}>
                    <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                    Criar primeira meta
                  </Button>
                </div>
              )}

              {/* Cards Grid */}
              {!loading && !error && metas.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
                  {metas.map((meta) => {
                    const valorAlvo = meta.valorAlvo ?? meta.valor_alvo ?? 0;
                    const valorAtual = meta.valorAtual ?? meta.valor_atual ?? 0;
                    const valorRestante = Math.max(0, valorAlvo - valorAtual);
                    const pct = valorAlvo > 0 ? Math.min(100, (valorAtual / valorAlvo) * 100) : 0;
                    const barColor = meta.status === 'concluida' ? '#16a34a' : '#2563eb';
                    const dataFim = meta.dataFim ?? meta.data_fim;
                    const dataInicio = meta.dataInicio ?? meta.data_inicio;

                    return (
                      <div
                        key={meta.id}
                        style={{
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 12,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                          padding: '20px 24px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {meta.icone && (
                              <span style={{ fontSize: 18 }}>{meta.icone}</span>
                            )}
                            <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{meta.nome}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              title="Movimentos"
                              onClick={() => abrirModalMovimentos(meta)}
                              style={{ ...iconBtn, color: '#2563eb' }}
                            >
                              <FontAwesomeIcon icon={faCoins} />
                            </button>
                            <button
                              title="Editar"
                              onClick={() => abrirModal(meta)}
                              style={iconBtn}
                            >
                              <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                            <button
                              title="Excluir"
                              onClick={() => setConfirmDelete(meta.id)}
                              style={{ ...iconBtn, color: '#dc2626' }}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </div>

                        {/* Badges */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <StatusBadge status={meta.status} />
                          <TipoBadge tipo={meta.tipo} />
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#6b7280' }}>
                            <span>Progresso</span>
                            <span style={{ fontWeight: 600, color: barColor }}>{pct.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>

                        {/* Values */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          <div>
                            <p style={miniLabelStyle}>Alvo</p>
                            <p style={miniValueStyle}>{formatBRL(valorAlvo)}</p>
                          </div>
                          <div>
                            <p style={miniLabelStyle}>Atual</p>
                            <p style={{ ...miniValueStyle, color: '#2563eb' }}>{formatBRL(valorAtual)}</p>
                          </div>
                          <div>
                            <p style={miniLabelStyle}>Restante</p>
                            <p style={{ ...miniValueStyle, color: valorRestante > 0 ? '#f59e0b' : '#16a34a' }}>{formatBRL(valorRestante)}</p>
                          </div>
                        </div>

                        {/* Dates */}
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280' }}>
                          <span>Início: <strong>{formatDate(dataInicio)}</strong></span>
                          <span>Prazo: <strong>{dataFim ? formatDate(dataFim) : 'Sem prazo'}</strong></span>
                        </div>

                        {/* Observações */}
                        {meta.observacoes && (
                          <p style={{ margin: 0, fontSize: 13, color: '#4b5563', fontStyle: 'italic' }}>
                            {meta.observacoes}
                          </p>
                        )}

                        {/* Inline confirm delete */}
                        {confirmDelete === meta.id && (
                          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 13, color: '#991b1b' }}>Confirmar exclusão?</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => handleExcluir(meta.id)}
                                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                              >
                                Excluir
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <FontAwesomeIcon icon={faChevronLeft} style={{ marginRight: 4 }} />
                    Anterior
                  </Button>
                  <span style={{ alignSelf: 'center', fontSize: 14, color: '#4b5563' }}>
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próximo
                    <FontAwesomeIcon icon={faChevronRight} style={{ marginLeft: 4 }} />
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

      {/* Modal criar/editar */}
      <Modal open={modalAberto} onClose={fecharModal} title={metaEmEdicao ? 'Editar Meta' : 'Nova Meta'}>
        <form onSubmit={handleSalvar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Nome */}
          <div>
            <label style={labelStyle}>Nome <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              style={inputStyle}
              type="text"
              maxLength={255}
              required
              placeholder="Ex.: Reserva de emergência"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>

          {/* Tipo + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Tipo <span style={{ color: '#ef4444' }}>*</span></label>
              <select
                style={inputStyle}
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              >
                {TIPO_META_ENUM.map((t) => (
                  <option key={t} value={t}>{TIPO_META_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                style={inputStyle}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUS_META_ENUM.map((s) => (
                  <option key={s} value={s}>{STATUS_META_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Valor alvo */}
          <div>
            <label style={labelStyle}>Valor alvo (R$) <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              style={inputStyle}
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              value={form.valor_alvo}
              onChange={(e) => setForm((f) => ({ ...f, valor_alvo: e.target.value }))}
            />
          </div>

          {/* Datas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Data de início <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                style={inputStyle}
                type="date"
                required
                value={form.data_inicio}
                onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Data fim (prazo)</label>
              <input
                style={inputStyle}
                type="date"
                value={form.data_fim}
                onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
              />
            </div>
          </div>

          {/* Ícone + Cor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Ícone (emoji ou texto)</label>
              <input
                style={inputStyle}
                type="text"
                maxLength={50}
                placeholder="Ex.: 🎯"
                value={form.icone}
                onChange={(e) => setForm((f) => ({ ...f, icone: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Cor (#RRGGBB)</label>
              <input
                style={inputStyle}
                type="text"
                maxLength={7}
                placeholder="#2563eb"
                value={form.cor}
                onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))}
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              maxLength={1000}
              placeholder="Notas ou estratégias para esta meta..."
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <Button type="button" variant="secondary" onClick={fecharModal} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Salvando...' : metaEmEdicao ? 'Atualizar meta' : 'Criar meta'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal movimentos */}
      <Modal
        open={modalMovimentosAberto}
        onClose={fecharModalMovimentos}
        title={metaMovimentos ? `Movimentos — ${metaMovimentos.nome}` : 'Movimentos'}
      >
        {loadingMovimentos && (
          <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>Carregando...</div>
        )}

        {!loadingMovimentos && metaMovimentos && (() => {
          const valorAlvo = metaMovimentos.valorAlvo ?? metaMovimentos.valor_alvo ?? 0;
          const movimentos = metaMovimentos.movimentos ?? [];
          const valorAtual = movimentos.reduce((sum, m) => sum + Number(m.valor ?? 0), 0);
          const valorRestante = Math.max(0, valorAlvo - valorAtual);
          const pct = valorAlvo > 0 ? Math.min(100, (valorAtual / valorAlvo) * 100) : 0;
          const barColor = metaMovimentos.status === 'concluida' ? '#16a34a' : '#2563eb';

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Progresso */}
              <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <StatusBadge status={metaMovimentos.status} />
                  <TipoBadge tipo={metaMovimentos.tipo} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#6b7280' }}>
                  <span>Progresso</span>
                  <span style={{ fontWeight: 600, color: barColor }}>{pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <p style={miniLabelStyle}>Alvo</p>
                    <p style={miniValueStyle}>{formatBRL(valorAlvo)}</p>
                  </div>
                  <div>
                    <p style={miniLabelStyle}>Atual</p>
                    <p style={{ ...miniValueStyle, color: '#2563eb' }}>{formatBRL(valorAtual)}</p>
                  </div>
                  <div>
                    <p style={miniLabelStyle}>Restante</p>
                    <p style={{ ...miniValueStyle, color: valorRestante > 0 ? '#f59e0b' : '#16a34a' }}>{formatBRL(valorRestante)}</p>
                  </div>
                </div>
              </div>

              {/* Formulário novo movimento */}
              <form onSubmit={handleCriarMovimento} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111827' }}>Novo movimento</p>

                {/* Tipo: Aporte / Retirada */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setFormMovimento((f) => ({ ...f, tipo: 'aporte' }))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: `2px solid ${formMovimento.tipo === 'aporte' ? '#16a34a' : '#e5e7eb'}`,
                      background: formMovimento.tipo === 'aporte' ? '#f0fdf4' : '#fff',
                      color: formMovimento.tipo === 'aporte' ? '#16a34a' : '#6b7280',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    Aporte
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMovimento((f) => ({ ...f, tipo: 'retirada' }))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: `2px solid ${formMovimento.tipo === 'retirada' ? '#dc2626' : '#e5e7eb'}`,
                      background: formMovimento.tipo === 'retirada' ? '#fef2f2' : '#fff',
                      color: formMovimento.tipo === 'retirada' ? '#dc2626' : '#6b7280',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <FontAwesomeIcon icon={faMinus} />
                    Retirada
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Valor (R$) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      style={inputStyle}
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={formMovimento.valor}
                      onChange={(e) => setFormMovimento((f) => ({ ...f, valor: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Data <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      style={inputStyle}
                      type="date"
                      required
                      value={formMovimento.data}
                      onChange={(e) => setFormMovimento((f) => ({ ...f, data: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Descrição (opcional)</label>
                  <input
                    style={inputStyle}
                    type="text"
                    maxLength={255}
                    placeholder="Ex.: Salário de janeiro"
                    value={formMovimento.descricao}
                    onChange={(e) => setFormMovimento((f) => ({ ...f, descricao: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingMovimento}
                    style={{ background: formMovimento.tipo === 'retirada' ? '#dc2626' : undefined }}
                  >
                    {savingMovimento
                      ? 'Salvando...'
                      : formMovimento.tipo === 'retirada'
                        ? 'Registrar retirada'
                        : 'Registrar aporte'}
                  </Button>
                </div>
              </form>

              {/* Histórico */}
              <div>
                <p style={{ margin: '0 0 10px 0', fontWeight: 600, fontSize: 14, color: '#111827' }}>
                  Histórico ({movimentos.length})
                </p>
                {movimentos.length === 0 && (
                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                    Nenhum movimento registrado.
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...movimentos].reverse().map((mov) => {
                    const isPositivo = Number(mov.valor) >= 0;
                    const dataFormatada = formatMovDate(mov.data);
                    return (
                      <div
                        key={mov.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: isPositivo ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${isPositivo ? '#bbf7d0' : '#fecaca'}`,
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isPositivo ? '#16a34a' : '#dc2626' }}>
                            {isPositivo ? '+' : ''}{formatBRL(Number(mov.valor))}
                          </span>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>{dataFormatada}</span>
                          {mov.descricao && (
                            <span style={{ fontSize: 12, color: '#374151' }}>{mov.descricao}</span>
                          )}
                        </div>

                        {confirmDeleteMov === mov.id ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#991b1b' }}>Excluir?</span>
                            <button
                              onClick={() => handleExcluirMovimento(mov.id)}
                              style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setConfirmDeleteMov(null)}
                              style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            title="Excluir movimento"
                            onClick={() => setConfirmDeleteMov(mov.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 13, padding: '4px 6px', borderRadius: 4 }}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
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

const miniLabelStyle = {
  margin: '0 0 2px 0',
  fontSize: 11,
  fontWeight: 500,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const miniValueStyle = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  color: '#111827',
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
