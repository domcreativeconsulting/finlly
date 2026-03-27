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
  faFilter,
  faCircleUser,
  faDoorOpen,
  faChartLine,
  faArrowUp,
  faArrowDown,
} from '@fortawesome/free-solid-svg-icons';
import { Button, Modal } from '../design-system/index.js';
import { colors, typography, radius } from '../design-system/tokens.js';

const STATUS_META_LABELS = { ativa: 'Ativa', concluida: 'Concluída', cancelada: 'Cancelada' };
const TIPO_META_LABELS = { economia: 'Economia', despesa: 'Despesa', investimento: 'Investimento' };
const STATUS_META_ENUM = ['ativa', 'concluida', 'cancelada'];
const TIPO_META_ENUM = ['economia', 'despesa', 'investimento'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const COR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
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

function StatusBadge({ status }) {
  const map = {
    ativa: { bg: '#dcfce7', color: '#166534', label: 'Ativa' },
    concluida: { bg: '#dbeafe', color: '#1d4ed8', label: 'Concluída' },
    cancelada: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelada' },
  };
  const st = map[status] ?? { bg: '#f3f4f6', color: '#374151', label: status };
  return (
    <span
      style={{
        background: st.bg,
        color: st.color,
        borderRadius: 99,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {st.label}
    </span>
  );
}

function TipoMetaBadge({ tipo }) {
  const map = {
    economia: { bg: '#f0fdf4', color: '#15803d', label: 'Economia' },
    despesa: { bg: '#fef9c3', color: '#854d0e', label: 'Despesa' },
    investimento: { bg: '#eff6ff', color: '#1d4ed8', label: 'Investimento' },
  };
  const st = map[tipo] ?? { bg: '#f3f4f6', color: '#374151', label: tipo };
  return (
    <span
      style={{
        background: st.bg,
        color: st.color,
        borderRadius: 99,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {st.label}
    </span>
  );
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  padding: '20px 24px',
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${colors.neutral300 ?? '#d1d5db'}`,
  fontSize: 14,
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  marginBottom: 4,
  fontSize: 13,
  fontWeight: 500,
  color: colors.neutral700 ?? '#374151',
};

const miniLabelStyle = {
  margin: '0 0 2px',
  fontSize: 11,
  color: '#6b7280',
  fontWeight: 500,
};

const miniValueStyle = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  color: '#111827',
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
    background: colors.white ?? '#fff',
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
    borderRadius: radius.lg ?? '12px',
    margin: '24px 28px 28px',
  },
};

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

  const [metaSelecionada, setMetaSelecionada] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [modalMovimento, setModalMovimento] = useState(null);
  const [formMovimento, setFormMovimento] = useState({ valor: '', data: todayISO(), descricao: '', movimentacao_id: '' });
  const [savingMovimento, setSavingMovimento] = useState(false);
  const [confirmDeleteMov, setConfirmDeleteMov] = useState(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const carregarMetas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page };
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

  function abrirModalCriar() {
    setMetaEmEdicao(null);
    setForm(EMPTY_FORM);
    setModalAberto(true);
  }

  function abrirModalEditar(meta) {
    setMetaEmEdicao(meta);
    setForm({
      nome: meta.nome ?? '',
      tipo: meta.tipo ?? 'economia',
      valor_alvo: meta.valorAlvo?.toString() ?? '',
      data_inicio: meta.dataInicio ?? todayISO(),
      data_fim: meta.dataFim ?? '',
      status: meta.status ?? 'ativa',
      icone: meta.icone ?? '',
      cor: meta.cor ?? '',
      observacoes: meta.observacoes ?? '',
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setMetaEmEdicao(null);
    setForm(EMPTY_FORM);
  }

  async function salvar() {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    const valorAlvoNum = Number(form.valor_alvo);
    if (!form.valor_alvo || isNaN(valorAlvoNum) || valorAlvoNum <= 0) {
      toast.error('Valor alvo deve ser um número positivo.');
      return;
    }
    if (!form.data_inicio || !ISO_DATE_REGEX.test(form.data_inicio)) {
      toast.error('Data de início inválida.');
      return;
    }
    if (form.data_fim && !ISO_DATE_REGEX.test(form.data_fim)) {
      toast.error('Data fim inválida.');
      return;
    }
    if (form.cor && !COR_REGEX.test(form.cor)) {
      toast.error('Cor deve estar no formato #RRGGBB.');
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      valor_alvo: valorAlvoNum,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      status: form.status,
      icone: form.icone || null,
      cor: form.cor || null,
      observacoes: form.observacoes || null,
    };

    setSaving(true);
    try {
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
      const msg = err?.response?.data?.message || 'Erro ao salvar meta.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function excluir(meta) {
    if (!window.confirm(`Excluir a meta "${meta.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await metasService.excluir(meta.id);
      toast.success('Meta excluída.');
      if (metaSelecionada?.id === meta.id) fecharDetalhe();
      carregarMetas();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir meta.');
    }
  }

  async function abrirDetalhe(meta) {
    setMetaSelecionada(meta);
    setLoadingDetalhe(true);
    try {
      const data = await metasService.obter(meta.id);
      setDetalhe(data);
    } catch {
      toast.error('Erro ao carregar detalhes');
    } finally {
      setLoadingDetalhe(false);
    }
  }

  function fecharDetalhe() {
    setMetaSelecionada(null);
    setDetalhe(null);
    setConfirmDeleteMov(null);
  }

  async function salvarMovimento() {
    const valorNum = Number(formMovimento.valor);
    if (!valorNum || valorNum <= 0) {
      toast.error('Informe um valor válido maior que zero');
      return;
    }
    if (!formMovimento.data || !ISO_DATE_REGEX.test(formMovimento.data)) {
      toast.error('Informe uma data válida');
      return;
    }
    setSavingMovimento(true);
    try {
      const valorFinal = modalMovimento === 'retirada' ? -valorNum : valorNum;
      await metasService.criarMovimento(metaSelecionada.id, {
        valor: valorFinal,
        data: formMovimento.data,
        descricao: formMovimento.descricao || null,
        movimentacao_id: formMovimento.movimentacao_id || null,
      });
      toast.success(modalMovimento === 'aporte' ? 'Aporte registrado!' : 'Retirada registrada!');
      setModalMovimento(null);
      setFormMovimento({ valor: '', data: todayISO(), descricao: '', movimentacao_id: '' });
      await abrirDetalhe(metaSelecionada);
      await carregarMetas();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar movimento');
    } finally {
      setSavingMovimento(false);
    }
  }

  async function excluirMovimento(movId) {
    try {
      await metasService.excluirMovimento(metaSelecionada.id, movId);
      toast.success('Movimento excluído');
      setConfirmDeleteMov(null);
      await abrirDetalhe(metaSelecionada);
      await carregarMetas();
    } catch {
      toast.error('Erro ao excluir movimento');
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
                  Defina suas metas financeiras, acompanhe o progresso e mantenha o foco nos seus objetivos.
                </p>
                <Button variant="primary" onClick={abrirModalCriar}>
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                  Nova Meta
                </Button>
              </div>
            </div>

            {/* User dropdown */}
            <div style={s.topBarRight}>
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 14,
                    color: colors.neutral700 ?? '#374151',
                    padding: '4px 8px',
                    borderRadius: radius.sm ?? '6px',
                  }}
                  onClick={() => setDropdownOpen((o) => !o)}
                >
                  <FontAwesomeIcon icon={faCircleUser} style={{ fontSize: 20, color: '#2563eb' }} />
                  <span>{usuario?.nome ?? usuario?.email ?? 'Usuário'}</span>
                </button>
                {dropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '110%',
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 100,
                      minWidth: 180,
                    }}
                  >
                    <button
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 14,
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onClick={() => { setDropdownOpen(false); navigate('/perfil'); }}
                    >
                      <FontAwesomeIcon icon={faCircleUser} />
                      Perfil
                    </button>
                    <button
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 14,
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onClick={() => { setDropdownOpen(false); logout(); navigate('/login'); }}
                    >
                      <FontAwesomeIcon icon={faDoorOpen} style={{ fontSize: '18px', marginRight: '5px' }} />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <InadimplenteGuard>
            <div style={s.content}>
              {/* Filtros */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <input
                  placeholder="Buscar por nome..."
                  value={filtroBusca}
                  onChange={(e) => { setFiltroBusca(e.target.value); setPage(1); }}
                  style={{ ...inputStyle, width: 220 }}
                />
                <select
                  value={filtroStatus}
                  onChange={(e) => { setFiltroStatus(e.target.value); setPage(1); }}
                  style={{ ...inputStyle, width: 150 }}
                >
                  <option value="">Todos os status</option>
                  {STATUS_META_ENUM.map((st) => (
                    <option key={st} value={st}>{STATUS_META_LABELS[st]}</option>
                  ))}
                </select>
                <select
                  value={filtroTipo}
                  onChange={(e) => { setFiltroTipo(e.target.value); setPage(1); }}
                  style={{ ...inputStyle, width: 160 }}
                >
                  <option value="">Todos os tipos</option>
                  {TIPO_META_ENUM.map((t) => (
                    <option key={t} value={t}>{TIPO_META_LABELS[t]}</option>
                  ))}
                </select>
                {(filtroStatus || filtroTipo || filtroBusca) && (
                  <Button
                    variant="secondary"
                    onClick={() => { setFiltroStatus(''); setFiltroTipo(''); setFiltroBusca(''); setPage(1); }}
                  >
                    <FontAwesomeIcon icon={faFilter} style={{ marginRight: 6 }} />
                    Limpar filtros
                  </Button>
                )}
              </div>

              {/* Loading */}
              {loading && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                  Carregando metas...
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div
                  style={{
                    background: '#fee2e2',
                    color: '#991b1b',
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 16,
                  }}
                >
                  {error}
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && metas.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                  <FontAwesomeIcon icon={faBullseye} style={{ fontSize: 48, marginBottom: 16, color: '#d1d5db' }} />
                  <p style={{ fontSize: 16, fontWeight: 500 }}>Nenhuma meta encontrada.</p>
                  <p style={{ fontSize: 14 }}>Clique em &quot;Nova Meta&quot; para começar.</p>
                </div>
              )}

              {/* Grid de cards */}
              {!loading && !error && metas.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 16,
                  }}
                >
                  {metas.map((meta) => (
                    <div key={meta.id} style={cardStyle}>
                      {/* Header */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                            {meta.icone && (
                              <span style={{ fontSize: 18 }}>{meta.icone}</span>
                            )}
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 15,
                                color: meta.cor ?? (colors.neutral900 ?? '#111827'),
                                wordBreak: 'break-word',
                              }}
                            >
                              {meta.nome}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <StatusBadge status={meta.status} />
                            <TipoMetaBadge tipo={meta.tipo} />
                          </div>
                        </div>
                        {/* Ações */}
                        <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexShrink: 0 }}>
                          <button
                            title="Editar meta"
                            onClick={() => abrirModalEditar(meta)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#2563eb',
                              fontSize: 15,
                              padding: '4px 6px',
                              borderRadius: 4,
                            }}
                          >
                            <FontAwesomeIcon icon={faPenToSquare} />
                          </button>
                          <button
                            title="Excluir meta"
                            onClick={() => excluir(meta)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#dc2626',
                              fontSize: 15,
                              padding: '4px 6px',
                              borderRadius: 4,
                            }}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>

                      {/* Barra de progresso */}
                      <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8, margin: '10px 0' }}>
                        <div
                          style={{
                            width: `${Math.min(meta.percentualConcluido ?? 0, 100)}%`,
                            height: '100%',
                            borderRadius: 99,
                            background: meta.status === 'concluida' ? '#22c55e' : '#2563eb',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        {(meta.percentualConcluido ?? 0).toFixed(1)}% concluído
                      </span>

                      {/* Valores */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 8,
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: '1px solid #f3f4f6',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>
                            Valor alvo
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                            {formatBRL(meta.valorAlvo)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>
                            Valor atual
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>
                            {formatBRL(meta.valorAtual)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>
                            Restante
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>
                            {formatBRL(meta.valorRestante)}
                          </div>
                        </div>
                      </div>

                      {/* Datas */}
                      <div
                        style={{
                          display: 'flex',
                          gap: 16,
                          marginTop: 10,
                          fontSize: 12,
                          color: '#6b7280',
                        }}
                      >
                        <span>
                          <strong>Início:</strong> {formatDate(meta.dataInicio)}
                        </span>
                        <span>
                          <strong>Prazo:</strong> {formatDate(meta.dataFim)}
                        </span>
                      </div>

                      {/* Observações */}
                      {meta.observacoes && (
                        <div
                          style={{
                            marginTop: 10,
                            fontSize: 12,
                            color: '#6b7280',
                            fontStyle: 'italic',
                            borderTop: '1px solid #f3f4f6',
                            paddingTop: 8,
                          }}
                        >
                          {meta.observacoes}
                        </div>
                      )}

                      {/* Ver histórico */}
                      <button
                        onClick={() => abrirDetalhe(meta)}
                        style={{
                          marginTop: 12,
                          width: '100%',
                          background: 'none',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: '7px 0',
                          fontSize: 13,
                          color: '#2563eb',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        <FontAwesomeIcon icon={faChartLine} style={{ marginRight: 6 }} />
                        Ver histórico &amp; progresso
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Paginação */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span style={{ alignSelf: 'center', fontSize: 14, color: '#4b5563' }}>
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

      {/* Backdrop do painel de detalhe */}
      {metaSelecionada && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Fechar painel"
          onClick={fecharDetalhe}
          onKeyDown={(e) => e.key === 'Escape' && fecharDetalhe()}
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.15)' }}
        />
      )}

      {/* Painel lateral de detalhe */}
      {metaSelecionada && (
        <div
          style={{
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            width: 420,
            background: '#fff',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* Header do painel */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                Detalhes
              </p>
              <h3 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 700, color: '#111827' }}>
                {metaSelecionada.nome}
              </h3>
            </div>
            <button
              onClick={fecharDetalhe}
              aria-label="Fechar detalhes"
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}
            >
              ×
            </button>
          </div>

          {loadingDetalhe ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Carregando...</div>
          ) : detalhe ? (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Progresso grande */}
              {(() => {
                const item = detalhe.item;
                const pct = Math.min(item.percentualConcluido ?? 0, 100);
                const barColor = item.status === 'concluida' ? '#16a34a' : '#2563eb';
                return (
                  <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Progresso</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: barColor }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 12, borderRadius: 6, background: '#e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: barColor,
                          borderRadius: 6,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div>
                        <p style={miniLabelStyle}>Alvo</p>
                        <p style={miniValueStyle}>{formatBRL(item.valorAlvo)}</p>
                      </div>
                      <div>
                        <p style={miniLabelStyle}>Atual</p>
                        <p style={{ ...miniValueStyle, color: '#2563eb' }}>{formatBRL(item.valorAtual)}</p>
                      </div>
                      <div>
                        <p style={miniLabelStyle}>Restante</p>
                        <p style={{ ...miniValueStyle, color: '#dc2626' }}>{formatBRL(item.valorRestante)}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Badges status/tipo */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <StatusBadge status={detalhe.item.status} />
                <TipoMetaBadge tipo={detalhe.item.tipo} />
              </div>

              {/* Datas */}
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#4b5563' }}>
                <span><strong>Início:</strong> {formatDate(detalhe.item.dataInicio)}</span>
                <span><strong>Prazo:</strong> {formatDate(detalhe.item.dataFim)}</span>
              </div>

              {/* Botões Aporte e Retirada */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setModalMovimento('aporte');
                    setFormMovimento({ valor: '', data: todayISO(), descricao: '', movimentacao_id: '' });
                  }}
                  style={{
                    flex: 1,
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 0',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <FontAwesomeIcon icon={faArrowUp} style={{ marginRight: 6 }} />
                  Aportar
                </button>
                <button
                  onClick={() => {
                    setModalMovimento('retirada');
                    setFormMovimento({ valor: '', data: todayISO(), descricao: '', movimentacao_id: '' });
                  }}
                  style={{
                    flex: 1,
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 0',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <FontAwesomeIcon icon={faArrowDown} style={{ marginRight: 6 }} />
                  Retirar
                </button>
              </div>

              {/* Lista de movimentos */}
              {(() => {
                const movimentos = detalhe.item.movimentos ?? [];
                return (
                  <div>
                    <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                      Histórico de movimentos ({movimentos.length})
                    </p>
                    {movimentos.length === 0 ? (
                      <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                        Nenhum movimento registrado.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[...movimentos]
                          .sort((a, b) => new Date(b.data) - new Date(a.data))
                          .map((mov) => {
                            const isAporte = Number(mov.valor) >= 0;
                            return (
                              <div
                                key={mov.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  background: '#f9fafb',
                                  borderRadius: 8,
                                  border: '1px solid #e5e7eb',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      background: isAporte ? '#dcfce7' : '#fee2e2',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <FontAwesomeIcon
                                      icon={isAporte ? faArrowUp : faArrowDown}
                                      style={{ fontSize: 11, color: isAporte ? '#16a34a' : '#dc2626' }}
                                    />
                                  </div>
                                  <div>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: isAporte ? '#16a34a' : '#dc2626' }}>
                                      {isAporte ? '+' : ''}{formatBRL(Math.abs(Number(mov.valor)))}
                                    </p>
                                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                                      {formatDate(mov.data)}{mov.descricao ? ` · ${mov.descricao}` : ''}
                                    </p>
                                  </div>
                                </div>
                                {confirmDeleteMov === mov.id ? (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={() => excluirMovimento(mov.id)}
                                      style={{
                                        background: '#dc2626',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 5,
                                        padding: '3px 8px',
                                        fontSize: 11,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Confirmar
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteMov(null)}
                                      style={{
                                        background: '#f3f4f6',
                                        color: '#374151',
                                        border: 'none',
                                        borderRadius: 5,
                                        padding: '3px 8px',
                                        fontSize: 11,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteMov(mov.id)}
                                    aria-label="Excluir movimento"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: '#9ca3af',
                                      fontSize: 13,
                                      padding: 4,
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faTrash} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>
      )}

      {/* Modal de Movimento (aporte/retirada) */}
      {modalMovimento && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '28px 32px',
              width: 380,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
              <FontAwesomeIcon
                icon={modalMovimento === 'aporte' ? faArrowUp : faArrowDown}
                style={{ marginRight: 8, color: modalMovimento === 'aporte' ? '#16a34a' : '#dc2626' }}
              />
              {modalMovimento === 'aporte' ? 'Novo Aporte' : 'Nova Retirada'}
            </h3>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Valor (R$) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formMovimento.valor}
                onChange={(e) => setFormMovimento((f) => ({ ...f, valor: e.target.value }))}
                style={inputStyle}
                placeholder="0,00"
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Data *</label>
              <input
                type="date"
                value={formMovimento.data}
                onChange={(e) => setFormMovimento((f) => ({ ...f, data: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Descrição (opcional)</label>
              <input
                type="text"
                maxLength={255}
                value={formMovimento.descricao}
                onChange={(e) => setFormMovimento((f) => ({ ...f, descricao: e.target.value }))}
                style={inputStyle}
                placeholder="Ex: Depósito mensal..."
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>ID da Movimentação (opcional)</label>
              <input
                type="text"
                value={formMovimento.movimentacao_id}
                onChange={(e) => setFormMovimento((f) => ({ ...f, movimentacao_id: e.target.value }))}
                style={inputStyle}
                placeholder="UUID (opcional)"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModalMovimento(null)}
                disabled={savingMovimento}
                style={{
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={salvarMovimento}
                disabled={savingMovimento}
                style={{
                  background: modalMovimento === 'aporte' ? '#16a34a' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 22px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {savingMovimento ? 'Salvando...' : modalMovimento === 'aporte' ? 'Registrar Aporte' : 'Registrar Retirada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criar/Editar */}
      <Modal
        isOpen={modalAberto}
        onClose={fecharModal}
        title={metaEmEdicao ? 'Editar Meta' : 'Nova Meta'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
          {/* Nome */}
          <div>
            <label style={labelStyle}>Nome *</label>
            <input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              maxLength={255}
              placeholder="Ex: Viagem Europa"
              style={inputStyle}
            />
          </div>

          {/* Tipo */}
          <div>
            <label style={labelStyle}>Tipo *</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              style={inputStyle}
            >
              {TIPO_META_ENUM.map((t) => (
                <option key={t} value={t}>{TIPO_META_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Valor Alvo */}
          <div>
            <label style={labelStyle}>Valor Alvo (R$) *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.valor_alvo}
              onChange={(e) => setForm((f) => ({ ...f, valor_alvo: e.target.value }))}
              placeholder="Ex: 10000.00"
              style={inputStyle}
            />
          </div>

          {/* Data Início */}
          <div>
            <label style={labelStyle}>Data de Início *</label>
            <input
              type="date"
              value={form.data_inicio}
              onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* Data Fim (prazo) */}
          <div>
            <label style={labelStyle}>Data Fim (prazo)</label>
            <input
              type="date"
              value={form.data_fim}
              onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              style={inputStyle}
            >
              {STATUS_META_ENUM.map((st) => (
                <option key={st} value={st}>{STATUS_META_LABELS[st]}</option>
              ))}
            </select>
          </div>

          {/* Ícone */}
          <div>
            <label style={labelStyle}>Ícone (emoji ou texto, max 50)</label>
            <input
              value={form.icone}
              onChange={(e) => setForm((f) => ({ ...f, icone: e.target.value }))}
              maxLength={50}
              placeholder="Ex: 🏖️"
              style={inputStyle}
            />
          </div>

          {/* Cor */}
          <div>
            <label style={labelStyle}>Cor (#RRGGBB)</label>
            <input
              value={form.cor}
              onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))}
              maxLength={7}
              placeholder="#2563eb"
              style={inputStyle}
            />
          </div>

          {/* Observações */}
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <Button variant="secondary" onClick={fecharModal} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={salvar} disabled={saving}>
              {saving ? 'Salvando...' : metaEmEdicao ? 'Salvar alterações' : 'Criar meta'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
