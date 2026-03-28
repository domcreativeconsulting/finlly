import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { metasService } from '../services/metas.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFlag,
  faBars,
  faPlus,
  faPenToSquare,
  faInbox,
  faCreditCard,
  faCircleUser,
  faDoorOpen,
  faChevronLeft,
  faChevronRight,
  faMinus,
} from '@fortawesome/free-solid-svg-icons';
import { Badge, Modal } from '../design-system/index.js';
import {
  colors,
  typography,
  radius,
  shadows,
} from '../design-system/tokens.js';

const STATUS_META_LABELS = {
  ativa: 'Ativa',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  pausada: 'Pausada',
};
const STATUS_META_CARD_LABELS = {
  ativa: 'ativa',
  concluida: 'concluída',
  cancelada: 'cancelada',
  pausada: 'pausada',
};
const TIPO_META_LABELS = {
  economia: 'Economia',
  despesa: 'Despesa',
  investimento: 'Investimento',
};
const STATUS_META_ENUM = ['ativa', 'concluida', 'cancelada', 'pausada'];
const TIPO_META_ENUM = ['economia', 'despesa', 'investimento'];
const COR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor ?? 0);
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

const EMPTY_MOV_FORM = {
  valor: '',
  data: todayISO(),
  descricao: '',
  tipo: 'aporte',
};

const EMPTY_NOVA_META_FORM = {
  nome: '',
  valor_alvo: '',
  data_fim: '',
  observacoes: '',
  prioridade: 'media',
  conta_vinculada: '',
};

function formatMovDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

function getBarColor(pct, status) {
  if (status === 'concluida') return '#16a34a';
  if (pct >= 100) return '#16a34a';
  if (pct >= 66) return '#10b981';
  if (pct >= 33) return '#2563eb';
  return '#f59e0b';
}

function StatusCardBadge({ status }) {
  const styleMap = {
    ativa: {
      background: '#eff6ff',
      color: '#2563eb',
      border: '1px solid #bfdbfe',
    },
    concluida: {
      background: '#f0fdf4',
      color: '#16a34a',
      border: '1px solid #bbf7d0',
    },
    cancelada: {
      background: '#fef2f2',
      color: '#dc2626',
      border: '1px solid #fecaca',
    },
    pausada: {
      background: '#fffbeb',
      color: '#d97706',
      border: '1px solid #fde68a',
    },
  };
  const st = styleMap[status] || styleMap.ativa;
  return (
    <span
      style={{
        ...st,
        borderRadius: 99,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {STATUS_META_CARD_LABELS[status] || status}
    </span>
  );
}

function PrioridadeBadge({ prioridade }) {
  if (!prioridade) return null;
  const styleMap = {
    alta: {
      background: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fde68a',
    },
    media: {
      background: '#f3f4f6',
      color: '#6b7280',
      border: '1px solid #e5e7eb',
    },
    baixa: {
      background: '#ecfdf5',
      color: '#065f46',
      border: '1px solid #a7f3d0',
    },
  };
  const st = styleMap[prioridade] || styleMap.media;
  return (
    <span
      style={{
        ...st,
        borderRadius: 99,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {prioridade}
    </span>
  );
}

function StatusBadge({ status }) {
  const variantMap = {
    ativa: 'success',
    concluida: 'info',
    cancelada: 'danger',
    pausada: 'warning',
  };
  return (
    <Badge variant={variantMap[status] || 'neutral'}>
      {STATUS_META_LABELS[status] || status}
    </Badge>
  );
}

function TipoBadge({ tipo }) {
  const variantMap = {
    economia: 'success',
    despesa: 'danger',
    investimento: 'info',
  };
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

  const [filtroStatus] = useState('');
  const [filtroTipo] = useState('');
  const [filtroBusca] = useState('');

  const [confirmDelete, setConfirmDelete] = useState(null);

  // Movimentos modal state
  const [modalMovimentosAberto, setModalMovimentosAberto] = useState(false);
  const [metaMovimentos, setMetaMovimentos] = useState(null);
  const [loadingMovimentos, setLoadingMovimentos] = useState(false);
  const [savingMovimento, setSavingMovimento] = useState(false);
  const [confirmDeleteMov, setConfirmDeleteMov] = useState(null);
  const [formMovimento, setFormMovimento] = useState(EMPTY_MOV_FORM);

  const [movimentosHistorico, setMovimentosHistorico] = useState([]);
  const [movimentosPage, setMovimentosPage] = useState(1);
  const [movimentosTotalPages, setMovimentosTotalPages] = useState(1);
  const [movimentosTotal, setMovimentosTotal] = useState(0);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Inline create form
  const [novaMetaForm, setNovaMetaForm] = useState(EMPTY_NOVA_META_FORM);
  const [criandoMeta, setCriandoMeta] = useState(false);

  // Aporte forms indexed by meta.id
  const [aportesForms, setAportesForms] = useState({});

  // Confirm cancel per card
  const [confirmCancelar, setConfirmCancelar] = useState(null);

  function handleInputFocus(e) {
    e.currentTarget.style.outline = '2px solid rgb(37 99 235 / 45%)';
    e.currentTarget.style.outlineOffset = '0px';
  }
  function handleInputBlur(e) {
    e.currentTarget.style.outline = 'none';
  }

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
      toast.error(
        'A data de início é obrigatória e deve estar no formato AAAA-MM-DD.'
      );
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

  async function carregarHistorico(metaId, page = 1) {
    setLoadingHistorico(true);
    try {
      const result = await metasService.listarMovimentos(metaId, {
        page,
        limit: 10,
        order_dir: 'desc',
      });
      setMovimentosHistorico(result.items ?? []);
      setMovimentosPage(result.page ?? 1);
      setMovimentosTotalPages(result.totalPages ?? 1);
      setMovimentosTotal(result.total ?? 0);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Erro ao carregar histórico.'
      );
    } finally {
      setLoadingHistorico(false);
    }
  }

  async function abrirModalMovimentos(meta) {
    setModalMovimentosAberto(true);
    setMetaMovimentos(meta);
    setFormMovimento(EMPTY_MOV_FORM);
    setConfirmDeleteMov(null);
    setMovimentosPage(1);
    setLoadingMovimentos(true);
    try {
      const [result] = await Promise.all([
        metasService.obter(meta.id),
        carregarHistorico(meta.id, 1),
      ]);
      setMetaMovimentos(result.item ?? result);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Erro ao carregar movimentos.'
      );
    } finally {
      setLoadingMovimentos(false);
    }
  }

  function fecharModalMovimentos() {
    setModalMovimentosAberto(false);
    setMetaMovimentos(null);
    setFormMovimento(EMPTY_MOV_FORM);
    setConfirmDeleteMov(null);
    setMovimentosHistorico([]);
    setMovimentosPage(1);
    setMovimentosTotalPages(1);
    setMovimentosTotal(0);
    carregarMetas();
  }

  async function recarregarMovimentos(id) {
    setLoadingMovimentos(true);
    try {
      const [result] = await Promise.all([
        metasService.obter(id),
        carregarHistorico(id, movimentosPage),
      ]);
      setMetaMovimentos(result.item ?? result);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Erro ao atualizar movimentos.'
      );
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
      const valorFinal =
        formMovimento.tipo === 'retirada'
          ? -Math.abs(parseFloat(formMovimento.valor))
          : Math.abs(parseFloat(formMovimento.valor));
      await metasService.criarMovimento(metaMovimentos.id, {
        valor: valorFinal,
        data: formMovimento.data,
        descricao: formMovimento.descricao || undefined,
      });
      toast.success(
        formMovimento.tipo === 'retirada'
          ? 'Retirada registrada!'
          : 'Aporte registrado!'
      );
      setFormMovimento(EMPTY_MOV_FORM);
      await recarregarMovimentos(metaMovimentos.id);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Erro ao registrar movimento.'
      );
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

  async function handleCriarMetaInline(e) {
    e.preventDefault();
    if (!novaMetaForm.nome.trim()) {
      toast.error('O título da meta é obrigatório.');
      return;
    }
    if (!novaMetaForm.valor_alvo || parseFloat(novaMetaForm.valor_alvo) <= 0) {
      toast.error('O valor alvo deve ser um número maior que zero.');
      return;
    }
    setCriandoMeta(true);
    try {
      await metasService.criar({
        nome: novaMetaForm.nome.trim(),
        tipo: 'economia',
        valor_alvo: parseFloat(novaMetaForm.valor_alvo),
        data_inicio: todayISO(),
        data_fim: novaMetaForm.data_fim || undefined,
        status: 'ativa',
        observacoes: novaMetaForm.observacoes || undefined,
        prioridade: novaMetaForm.prioridade || undefined,
      });
      toast.success('Meta criada com sucesso!');
      setNovaMetaForm(EMPTY_NOVA_META_FORM);
      carregarMetas();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao criar meta.');
    } finally {
      setCriandoMeta(false);
    }
  }

  async function handlePausar(id) {
    try {
      await metasService.atualizar(id, { status: 'pausada' });
      toast.success('Meta pausada.');
      carregarMetas();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao pausar meta.');
    }
  }

  async function handleReativar(id) {
    try {
      await metasService.atualizar(id, { status: 'ativa' });
      toast.success('Meta reativada.');
      carregarMetas();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao reativar meta.');
    }
  }

  async function handleCancelarMeta(id) {
    try {
      await metasService.atualizar(id, { status: 'cancelada' });
      toast.success('Meta cancelada.');
      setConfirmCancelar(null);
      carregarMetas();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao cancelar meta.');
    }
  }

  function getAporteForm(metaId) {
    return (
      aportesForms[metaId] || {
        descricao: '',
        valor: '',
        data: todayISO(),
        obs: '',
      }
    );
  }

  function updateAporteForm(metaId, changes) {
    setAportesForms((prev) => ({
      ...prev,
      [metaId]: { ...getAporteForm(metaId), ...changes },
    }));
  }

  async function handleRegistrarAporte(e, metaId) {
    e.preventDefault();
    const aForm = getAporteForm(metaId);
    if (!aForm.valor || parseFloat(aForm.valor) <= 0) {
      toast.error('O valor deve ser positivo.');
      return;
    }
    if (!aForm.data) {
      toast.error('A data é obrigatória.');
      return;
    }
    try {
      const descricao =
        [aForm.descricao, aForm.obs].filter(Boolean).join(' — ') || undefined;
      await metasService.criarMovimento(metaId, {
        valor: parseFloat(aForm.valor),
        data: aForm.data,
        descricao,
      });
      toast.success('Aporte registrado!');
      updateAporteForm(metaId, {
        descricao: '',
        valor: '',
        data: todayISO(),
        obs: '',
      });
      carregarMetas();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao registrar aporte.');
    }
  }

  return (
    <>
      <div
        style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}
      >
        <AppSidebar
          sidebarOpen={sidebarOpen}
          currentPath="/metas"
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
          {/* Top Bar — simplified */}
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
                    fontWeight: 700,
                    fontSize: 18,
                    color: '#111827',
                    lineHeight: 1.2,
                  }}
                >
                  Finlly
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                  Gestão financeira pessoal
                </div>
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
              {/* Page heading */}
              <div style={{ marginBottom: 24 }}>
                <h2
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: 28,
                    fontWeight: 700,
                    color: '#111827',
                  }}
                >
                  Metas
                </h2>
                <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
                  Defina metas, registre aportes e acompanhe progresso. Base do
                  produto + base do agente.
                </p>
              </div>

              {/* Inline Create Form */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  boxShadow: shadows.sm,
                  padding: 24,
                  marginBottom: 24,
                }}
              >
                <p
                  style={{
                    margin: '0 0 16px 0',
                    fontWeight: 600,
                    fontSize: 15,
                    color: '#111827',
                  }}
                >
                  Criar nova meta
                </p>
                <form onSubmit={handleCriarMetaInline}>
                  {/* Row 1: Título, Valor alvo, Data alvo */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr',
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="Ex: Reserva de emergência, Entrada do apartamento..."
                      value={novaMetaForm.nome}
                      onChange={(e) =>
                        setNovaMetaForm((f) => ({ ...f, nome: e.target.value }))
                      }
                      maxLength={255}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                    <input
                      style={inputStyle}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Ex: 10.000,00"
                      value={novaMetaForm.valor_alvo}
                      onChange={(e) =>
                        setNovaMetaForm((f) => ({
                          ...f,
                          valor_alvo: e.target.value,
                        }))
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                    <input
                      style={inputStyle}
                      type="date"
                      value={novaMetaForm.data_fim}
                      onChange={(e) =>
                        setNovaMetaForm((f) => ({
                          ...f,
                          data_fim: e.target.value,
                        }))
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                  </div>

                  {/* Row 2: Descrição */}
                  <div style={{ marginBottom: 12 }}>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="Ex: 6 meses de custo fixo, meta 2026..."
                      value={novaMetaForm.observacoes}
                      onChange={(e) =>
                        setNovaMetaForm((f) => ({
                          ...f,
                          observacoes: e.target.value,
                        }))
                      }
                      maxLength={1000}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                  </div>

                  {/* Row 3: Prioridade, Conta, Botão */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <select
                      style={{ ...inputStyle, width: 'auto', minWidth: 130 }}
                      value={novaMetaForm.prioridade}
                      onChange={(e) =>
                        setNovaMetaForm((f) => ({
                          ...f,
                          prioridade: e.target.value,
                        }))
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Média</option>
                      <option value="baixa">Baixa</option>
                    </select>
                    <select
                      style={{ ...inputStyle, width: 'auto', minWidth: 200 }}
                      value={novaMetaForm.conta_vinculada}
                      onChange={(e) =>
                        setNovaMetaForm((f) => ({
                          ...f,
                          conta_vinculada: e.target.value,
                        }))
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    >
                      <option value="">Sem vínculo</option>
                    </select>
                    <button
                      type="submit"
                      disabled={criandoMeta}
                      style={{
                        marginLeft: 'auto',
                        background: '#1e3a5f',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 20px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: criandoMeta ? 'not-allowed' : 'pointer',
                        opacity: criandoMeta ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <FontAwesomeIcon icon={faFlag} />
                      {criandoMeta ? 'Criando...' : 'Criar meta'}
                    </button>
                  </div>
                </form>
              </div>

              {/* "Suas metas" section */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  boxShadow: shadows.sm,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    Suas metas
                  </h3>
                  <span style={{ fontSize: 14, color: '#6b7280' }}>
                    {total} meta{total !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Loading */}
                {loading && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 48,
                      color: '#6b7280',
                    }}
                  >
                    Carregando...
                  </div>
                )}

                {/* Error */}
                {!loading && error && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 48,
                      color: '#dc2626',
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Empty state */}
                {!loading && !error && metas.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 64,
                      color: '#9ca3af',
                    }}
                  >
                    <FontAwesomeIcon
                      icon={faInbox}
                      style={{
                        fontSize: 48,
                        display: 'block',
                        margin: '0 auto 16px',
                      }}
                    />
                    <p style={{ margin: '0 0 8px 0', fontSize: 16 }}>
                      Nenhuma meta encontrada.
                    </p>
                    <p style={{ margin: 0, fontSize: 14 }}>
                      Use o formulário acima para criar sua primeira meta.
                    </p>
                  </div>
                )}

                {/* Cards Grid — 2 columns */}
                {!loading && !error && metas.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 20,
                      marginBottom: 16,
                    }}
                  >
                    {metas.map((meta) => {
                      const valorAlvo = meta.valorAlvo ?? meta.valor_alvo ?? 0;
                      const valorAtual =
                        meta.valorAtual ?? meta.valor_atual ?? 0;
                      const pct =
                        valorAlvo > 0
                          ? Math.min(100, (valorAtual / valorAlvo) * 100)
                          : 0;
                      const dataFim = meta.dataFim ?? meta.data_fim;
                      const prioridade = meta.prioridade || null;
                      const aForm = getAporteForm(meta.id);

                      return (
                        <div
                          key={meta.id}
                          style={{
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 12,
                            padding: '20px 24px',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          {/* Card Header */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: 10,
                            }}
                          >
                            {/* Left: name + badges */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: 15,
                                  color: '#111827',
                                }}
                              >
                                {meta.nome}
                              </span>
                              <StatusCardBadge status={meta.status} />
                              {prioridade && (
                                <PrioridadeBadge prioridade={prioridade} />
                              )}
                            </div>
                            {/* Right: progress values + date + edit */}
                            <div
                              style={{
                                textAlign: 'right',
                                flexShrink: 0,
                                marginLeft: 12,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 11,
                                  color: '#6b7280',
                                  marginBottom: 2,
                                }}
                              >
                                Progresso
                              </div>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: '#111827',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatBRL(valorAtual)} / {formatBRL(valorAlvo)}
                              </div>
                              {dataFim && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: '#6b7280',
                                    marginTop: 2,
                                  }}
                                >
                                  Alvo: {formatDate(dataFim)}
                                </div>
                              )}
                              <button
                                title="Editar meta"
                                onClick={() => abrirModal(meta)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#6b7280',
                                  fontSize: 13,
                                  marginTop: 4,
                                  padding: '2px 4px',
                                }}
                              >
                                <FontAwesomeIcon icon={faPenToSquare} />
                              </button>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div
                            style={{
                              height: 8,
                              borderRadius: 4,
                              background: '#e5e7eb',
                              overflow: 'hidden',
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: '#2563eb',
                                borderRadius: 4,
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>

                          {/* Percentage + actions */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 16,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 15,
                                color: '#111827',
                              }}
                            >
                              {Math.round(pct)}%
                            </span>
                            <div
                              style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'center',
                              }}
                            >
                              {confirmCancelar === meta.id ? (
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 6,
                                    alignItems: 'center',
                                  }}
                                >
                                  <span
                                    style={{ fontSize: 12, color: '#dc2626' }}
                                  >
                                    Confirmar?
                                  </span>
                                  <button
                                    onClick={() => handleCancelarMeta(meta.id)}
                                    style={{
                                      background: '#dc2626',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: 5,
                                      padding: '4px 10px',
                                      fontSize: 12,
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Sim
                                  </button>
                                  <button
                                    onClick={() => setConfirmCancelar(null)}
                                    style={{
                                      background: '#f3f4f6',
                                      color: '#374151',
                                      border: 'none',
                                      borderRadius: 5,
                                      padding: '4px 10px',
                                      fontSize: 12,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {meta.status === 'ativa' && (
                                    <button
                                      onClick={() => handlePausar(meta.id)}
                                      style={{
                                        background: 'transparent',
                                        border: '1px solid #d97706',
                                        color: '#d97706',
                                        borderRadius: 6,
                                        padding: '5px 12px',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Pausar
                                    </button>
                                  )}
                                  {meta.status === 'pausada' && (
                                    <button
                                      onClick={() => handleReativar(meta.id)}
                                      style={{
                                        background: 'transparent',
                                        border: '1px solid #2563eb',
                                        color: '#2563eb',
                                        borderRadius: 6,
                                        padding: '5px 12px',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Reativar
                                    </button>
                                  )}
                                  {meta.status !== 'cancelada' &&
                                    meta.status !== 'concluida' && (
                                      <button
                                        onClick={() =>
                                          setConfirmCancelar(meta.id)
                                        }
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#6b7280',
                                          borderRadius: 6,
                                          padding: '5px 8px',
                                          fontSize: 13,
                                          fontWeight: 500,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Cancelar
                                      </button>
                                    )}
                                  {(meta.status === 'cancelada' ||
                                    meta.status === 'concluida') && (
                                    <button
                                      onClick={() => setConfirmDelete(meta.id)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#dc2626',
                                        borderRadius: 6,
                                        padding: '5px 8px',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Excluir
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Inline confirm delete */}
                          {confirmDelete === meta.id && (
                            <div
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: 8,
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                marginBottom: 12,
                              }}
                            >
                              <span style={{ fontSize: 13, color: '#991b1b' }}>
                                Confirmar exclusão permanente?
                              </span>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  onClick={() => handleExcluir(meta.id)}
                                  style={{
                                    background: '#dc2626',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '5px 12px',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                  }}
                                >
                                  Excluir
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  style={{
                                    background: '#f3f4f6',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '5px 12px',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Inline Aporte Form */}
                          <div
                            style={{
                              borderTop: '1px solid #f3f4f6',
                              paddingTop: 12,
                            }}
                          >
                            <form
                              onSubmit={(e) =>
                                handleRegistrarAporte(e, meta.id)
                              }
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr 1fr auto',
                                  gap: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <input
                                  style={{
                                    ...inputStyle,
                                    fontSize: 13,
                                    padding: '6px 8px',
                                  }}
                                  type="text"
                                  placeholder="Aporte"
                                  value={aForm.descricao}
                                  onChange={(e) =>
                                    updateAporteForm(meta.id, {
                                      descricao: e.target.value,
                                    })
                                  }
                                  maxLength={100}
                                  onFocus={handleInputFocus}
                                  onBlur={handleInputBlur}
                                />
                                <input
                                  style={{
                                    ...inputStyle,
                                    fontSize: 13,
                                    padding: '6px 8px',
                                  }}
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  placeholder="Valor (R$)"
                                  value={aForm.valor}
                                  onChange={(e) =>
                                    updateAporteForm(meta.id, {
                                      valor: e.target.value,
                                    })
                                  }
                                  onFocus={handleInputFocus}
                                  onBlur={handleInputBlur}
                                />
                                <input
                                  style={{
                                    ...inputStyle,
                                    fontSize: 13,
                                    padding: '6px 8px',
                                  }}
                                  type="date"
                                  value={aForm.data}
                                  onChange={(e) =>
                                    updateAporteForm(meta.id, {
                                      data: e.target.value,
                                    })
                                  }
                                  onFocus={handleInputFocus}
                                  onBlur={handleInputBlur}
                                />
                                <button
                                  type="submit"
                                  style={{
                                    background: '#fff',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 6,
                                    padding: '6px 12px',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    color: '#374151',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  ⊕ Registrar
                                </button>
                              </div>
                              <input
                                style={{
                                  ...inputStyle,
                                  fontSize: 12,
                                  padding: '5px 8px',
                                  color: '#6b7280',
                                }}
                                type="text"
                                placeholder="Obs (opcional). Ex: aporte salário, ajuste manual..."
                                value={aForm.obs}
                                onChange={(e) =>
                                  updateAporteForm(meta.id, {
                                    obs: e.target.value,
                                  })
                                }
                                maxLength={255}
                                onFocus={handleInputFocus}
                                onBlur={handleInputBlur}
                              />
                            </form>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 12,
                      marginTop: 8,
                    }}
                  >
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      style={{
                        background: '#f3f4f6',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 14px',
                        cursor: page <= 1 ? 'not-allowed' : 'pointer',
                        color: '#374151',
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} /> Anterior
                    </button>
                    <span
                      style={{
                        alignSelf: 'center',
                        fontSize: 14,
                        color: '#4b5563',
                      }}
                    >
                      Página {page} de {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      style={{
                        background: '#f3f4f6',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 14px',
                        cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                        color: '#374151',
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      Próximo <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </InadimplenteGuard>

          {/* Footer */}
          <div style={s.footer}>
            Finlly • painel financeiro pessoal — {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* Modal editar meta */}
      <Modal
        open={modalAberto}
        onClose={fecharModal}
        title={metaEmEdicao ? 'Editar Meta' : 'Nova Meta'}
      >
        <form
          onSubmit={handleSalvar}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {/* Nome */}
          <div>
            <label style={labelStyle}>
              Nome <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              style={inputStyle}
              type="text"
              maxLength={255}
              required
              placeholder="Ex.: Reserva de emergência"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          {/* Tipo + Status */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <div>
              <label style={labelStyle}>
                Tipo <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                style={inputStyle}
                value={form.tipo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              >
                {TIPO_META_ENUM.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_META_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
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
                {STATUS_META_ENUM.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Valor alvo */}
          <div>
            <label style={labelStyle}>
              Valor alvo (R$) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              style={inputStyle}
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              value={form.valor_alvo}
              onChange={(e) =>
                setForm((f) => ({ ...f, valor_alvo: e.target.value }))
              }
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          {/* Datas */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <div>
              <label style={labelStyle}>
                Data de início <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                style={inputStyle}
                type="date"
                required
                value={form.data_inicio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, data_inicio: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div>
              <label style={labelStyle}>Data fim (prazo)</label>
              <input
                style={inputStyle}
                type="date"
                value={form.data_fim}
                onChange={(e) =>
                  setForm((f) => ({ ...f, data_fim: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
          </div>

          {/* Ícone + Cor */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <div>
              <label style={labelStyle}>Ícone (emoji ou texto)</label>
              <input
                style={inputStyle}
                type="text"
                maxLength={50}
                placeholder="Ex.: 🎯"
                value={form.icone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, icone: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, cor: e.target.value }))
                }
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
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
              onChange={(e) =>
                setForm((f) => ({ ...f, observacoes: e.target.value }))
              }
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={fecharModal}
              disabled={saving}
              style={{
                background: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 14,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving
                ? 'Salvando...'
                : metaEmEdicao
                  ? 'Atualizar meta'
                  : 'Criar meta'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal movimentos */}
      <Modal
        open={modalMovimentosAberto}
        onClose={fecharModalMovimentos}
        title={
          metaMovimentos ? `Movimentos — ${metaMovimentos.nome}` : 'Movimentos'
        }
      >
        {loadingMovimentos && (
          <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
            Carregando...
          </div>
        )}

        {!loadingMovimentos &&
          metaMovimentos &&
          (() => {
            const valorAlvo =
              metaMovimentos.valorAlvo ?? metaMovimentos.valor_alvo ?? 0;
            const movimentos = metaMovimentos.movimentos ?? [];
            const valorAtual = movimentos.reduce(
              (sum, m) => sum + Number(m.valor ?? 0),
              0
            );
            const valorRestante = Math.max(0, valorAlvo - valorAtual);
            const pct =
              valorAlvo > 0 ? Math.min(100, (valorAtual / valorAlvo) * 100) : 0;
            const barColor = getBarColor(pct, metaMovimentos.status);

            return (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
              >
                {/* Progresso */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: '16px 20px',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <StatusBadge status={metaMovimentos.status} />
                    <TipoBadge tipo={metaMovimentos.tipo} />
                  </div>

                  {/* Percentual em destaque */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      Progresso
                    </span>
                    <span
                      style={{ fontSize: 22, fontWeight: 800, color: barColor }}
                    >
                      {pct.toFixed(1)}%
                    </span>
                  </div>

                  {/* Barra com milestones */}
                  <div
                    style={{
                      position: 'relative',
                      height: 14,
                      borderRadius: 7,
                      background: '#e5e7eb',
                      overflow: 'hidden',
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: 7,
                        transition: 'width 0.5s ease',
                      }}
                    />
                    {[25, 50, 75].map((m) => (
                      <div
                        key={m}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: `${m}%`,
                          width: 2,
                          height: '100%',
                          background: 'rgba(255,255,255,0.5)',
                          transform: 'translateX(-50%)',
                        }}
                      />
                    ))}
                  </div>

                  {/* Labels de milestone */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 10,
                      color: '#9ca3af',
                      marginBottom: 12,
                      paddingLeft: '23%',
                      paddingRight: '23%',
                    }}
                  >
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <div>
                      <p style={miniLabelStyle}>Alvo</p>
                      <p style={miniValueStyle}>{formatBRL(valorAlvo)}</p>
                    </div>
                    <div>
                      <p style={miniLabelStyle}>Atual</p>
                      <p style={{ ...miniValueStyle, color: '#2563eb' }}>
                        {formatBRL(valorAtual)}
                      </p>
                    </div>
                    <div>
                      <p style={miniLabelStyle}>Restante</p>
                      <p
                        style={{
                          ...miniValueStyle,
                          color: valorRestante > 0 ? '#f59e0b' : '#16a34a',
                        }}
                      >
                        {formatBRL(valorRestante)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Formulário novo movimento */}
                <form
                  onSubmit={handleCriarMovimento}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      fontSize: 14,
                      color: '#111827',
                    }}
                  >
                    Novo movimento
                  </p>

                  {/* Tipo: Aporte / Retirada */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setFormMovimento((f) => ({ ...f, tipo: 'aporte' }))
                      }
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: `2px solid ${formMovimento.tipo === 'aporte' ? '#16a34a' : '#e5e7eb'}`,
                        background:
                          formMovimento.tipo === 'aporte' ? '#f0fdf4' : '#fff',
                        color:
                          formMovimento.tipo === 'aporte'
                            ? '#16a34a'
                            : '#6b7280',
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
                      onClick={() =>
                        setFormMovimento((f) => ({ ...f, tipo: 'retirada' }))
                      }
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: `2px solid ${formMovimento.tipo === 'retirada' ? '#dc2626' : '#e5e7eb'}`,
                        background:
                          formMovimento.tipo === 'retirada'
                            ? '#fef2f2'
                            : '#fff',
                        color:
                          formMovimento.tipo === 'retirada'
                            ? '#dc2626'
                            : '#6b7280',
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

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                    }}
                  >
                    <div>
                      <label style={labelStyle}>
                        Valor (R$) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        style={inputStyle}
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={formMovimento.valor}
                        onChange={(e) =>
                          setFormMovimento((f) => ({
                            ...f,
                            valor: e.target.value,
                          }))
                        }
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>
                        Data <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        style={inputStyle}
                        type="date"
                        required
                        value={formMovimento.data}
                        onChange={(e) =>
                          setFormMovimento((f) => ({
                            ...f,
                            data: e.target.value,
                          }))
                        }
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
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
                      onChange={(e) =>
                        setFormMovimento((f) => ({
                          ...f,
                          descricao: e.target.value,
                        }))
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={savingMovimento}
                      style={{
                        background:
                          formMovimento.tipo === 'retirada'
                            ? '#dc2626'
                            : '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 18px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: savingMovimento ? 'not-allowed' : 'pointer',
                        opacity: savingMovimento ? 0.7 : 1,
                      }}
                    >
                      {savingMovimento
                        ? 'Salvando...'
                        : formMovimento.tipo === 'retirada'
                          ? 'Registrar retirada'
                          : 'Registrar aporte'}
                    </button>
                  </div>
                </form>

                {/* Histórico — Timeline */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 600,
                        fontSize: 14,
                        color: '#111827',
                      }}
                    >
                      Histórico ({movimentosTotal})
                    </p>
                  </div>

                  {loadingHistorico && (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: 16,
                        color: '#6b7280',
                      }}
                    >
                      Carregando histórico...
                    </div>
                  )}

                  {!loadingHistorico && movimentosHistorico.length === 0 && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: '#9ca3af',
                        textAlign: 'center',
                        padding: '16px 0',
                      }}
                    >
                      Nenhum movimento registrado.
                    </p>
                  )}

                  {/* Timeline */}
                  {!loadingHistorico && movimentosHistorico.length > 0 && (
                    <div style={{ position: 'relative', paddingLeft: 28 }}>
                      {/* Linha vertical */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 10,
                          top: 8,
                          bottom: 8,
                          width: 2,
                          background: '#e5e7eb',
                          borderRadius: 2,
                        }}
                      />

                      {movimentosHistorico.map((mov, idx) => {
                        const isPositivo = Number(mov.valor) >= 0;
                        const dotColor = isPositivo ? '#16a34a' : '#dc2626';
                        const valorFormatado = formatBRL(
                          Math.abs(Number(mov.valor))
                        );

                        return (
                          <div
                            key={mov.id}
                            style={{
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              marginBottom:
                                idx < movimentosHistorico.length - 1 ? 16 : 0,
                            }}
                          >
                            {/* Bolinha */}
                            <div
                              style={{
                                position: 'absolute',
                                left: -22,
                                top: 2,
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: dotColor,
                                border: '2px solid #fff',
                                boxShadow: `0 0 0 2px ${dotColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 9,
                                color: '#fff',
                                fontWeight: 700,
                              }}
                            >
                              {isPositivo ? '↑' : '↓'}
                            </div>

                            {/* Conteúdo */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 2,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: dotColor,
                                  }}
                                >
                                  {isPositivo ? '+' : '-'}
                                  {valorFormatado}
                                </span>
                                {mov.descricao && (
                                  <span
                                    style={{ fontSize: 12, color: '#4b5563' }}
                                  >
                                    {mov.descricao}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  gap: 4,
                                }}
                              >
                                <span
                                  style={{ fontSize: 11, color: '#9ca3af' }}
                                >
                                  {formatMovDate(mov.data)}
                                </span>
                                {confirmDeleteMov === mov.id ? (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={() =>
                                        handleExcluirMovimento(mov.id)
                                      }
                                      style={{
                                        background: '#dc2626',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 4,
                                        padding: '2px 8px',
                                        fontSize: 11,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Excluir
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteMov(null)}
                                      style={{
                                        background: '#f3f4f6',
                                        color: '#374151',
                                        border: 'none',
                                        borderRadius: 4,
                                        padding: '2px 8px',
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
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#dc2626',
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      padding: '2px 4px',
                                    }}
                                    title="Excluir movimento"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Paginação do histórico */}
                  {movimentosTotalPages > 1 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <button
                        disabled={movimentosPage <= 1}
                        onClick={() =>
                          carregarHistorico(
                            metaMovimentos.id,
                            movimentosPage - 1
                          )
                        }
                        style={{
                          background: '#f3f4f6',
                          border: 'none',
                          borderRadius: 6,
                          padding: '4px 12px',
                          cursor:
                            movimentosPage <= 1 ? 'not-allowed' : 'pointer',
                          color: '#374151',
                          fontSize: 13,
                        }}
                      >
                        ← Anterior
                      </button>
                      <span
                        style={{
                          alignSelf: 'center',
                          fontSize: 12,
                          color: '#6b7280',
                        }}
                      >
                        {movimentosPage} / {movimentosTotalPages}
                      </span>
                      <button
                        disabled={movimentosPage >= movimentosTotalPages}
                        onClick={() =>
                          carregarHistorico(
                            metaMovimentos.id,
                            movimentosPage + 1
                          )
                        }
                        style={{
                          background: '#f3f4f6',
                          border: 'none',
                          borderRadius: 6,
                          padding: '4px 12px',
                          cursor:
                            movimentosPage >= movimentosTotalPages
                              ? 'not-allowed'
                              : 'pointer',
                          color: '#374151',
                          fontSize: 13,
                        }}
                      >
                        Próximo →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
      </Modal>
    </>
  );
}

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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 28px',
    background: colors.white,
    borderBottom: `1px solid ${colors.border ?? '#e5e7eb'}`,
    gap: '16px',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
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
