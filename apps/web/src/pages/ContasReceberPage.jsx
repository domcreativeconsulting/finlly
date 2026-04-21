import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import ExportButtons from '../components/ExportButtons.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { contasReceberService } from '../services/contasReceber.service.js';
import { categoriasService } from '../services/categorias.service.js';
import { contasService } from '../services/contas.service.js';
import api from '../services/api.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { useOfflineCache } from '../hooks/useOfflineCache.js';
import { useRequireOnline } from '../hooks/useRequireOnline.js';
import { useContentLayout } from '../hooks/useContentLayout.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHourglassHalf,
  faShieldHalved,
  faCalendarDays,
  faTriangleExclamation,
  faBars,
  faBuilding,
  faTag,
  faChevronDown,
  faCircleCheck,
  faCheck,
  faClipboardList,
  faPenToSquare,
  faPaperclip,
  faEllipsis,
  faCreditCard,
  faCircleUser,
  faDoorOpen,
} from '@fortawesome/free-solid-svg-icons';
import { Button, Modal, Badge } from '../design-system/index.js';
import {
  colors,
  typography,
  radius,
  shadows,
} from '../design-system/tokens.js';
import { downloadBlob } from '../utils/downloadBlob.js';
import { OfflineDataBadge } from '../components/OfflineDataBadge.jsx';
import AnexoUploader from '../components/AnexoUploader.jsx';
import { anexosService } from '../services/anexos.service.js';
import { hasActiveSubscription } from '../config/subscriptionPolicy.js';

const TIPO_MODAL_CAT = 'entrada';
const DEFAULT_FORM_CAT = { nome: '', icone: '', cor: '#33528a', pai_id: '' };

const STATUS_LABELS = {
  pendente: 'Pendente',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
  estornado: 'Estornado',
  falhou: 'Falhou',
};

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function formatDate(data_vencimento) {
  if (!data_vencimento) return '-';
  const datePart = String(data_vencimento).substring(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return '-';
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}

function StatusBadge({ status }) {
  const variantMap = {
    pendente: 'warning',
    recebido: 'success',
    cancelado: 'neutral',
    estornado: 'orange',
    falhou: 'error',
  };
  return (
    <Badge variant={variantMap[status] || 'neutral'}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

function todayISO() {
  return new Date().toISOString().substring(0, 10);
}

function parseVencDate(data_vencimento) {
  if (!data_vencimento) return null;
  return new Date(String(data_vencimento).substring(0, 10) + 'T00:00:00');
}

const EMPTY_FORM = {
  descricao: '',
  valor: '',
  data_vencimento: '',
  tipo: 'variavel',
  parcelas: '1',
  conta_id: '',
  categoria_id: '',
  subcategoria_id: '',
  multa_percentual: '',
  juros_mensal: '',
  multa_fixa: '',
  provisionado: false,
  debito_automatico: false,
  recorrencia: 'nenhuma',
  recorrencia_quantidade: '1',
  observacoes: '',
};

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SortableTh({ field, label, sortField, sortDir, onSort, style }) {
  const active = sortField === field;
  return (
    <th
      style={{ ...style, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort(field)}
    >
      {label}{' '}
      <span style={{ fontSize: '11px', opacity: active ? 1 : 0.3 }}>
        {active ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
      </span>
    </th>
  );
}

function ContaReceberMobileCard({
  conta,
  isOnline,
  hoje,
  menuAbertoId,
  setMenuAbertoId,
  abrirModalEdicao,
  abrirModalReceber,
  handleCancelar,
  handleExcluir,
}) {
  const venc = parseVencDate(conta.data_vencimento);
  const isAtrasada = conta.status === 'pendente' && venc && venc < hoje;
  return (
    <div
      style={{
        background: isAtrasada ? '#fff5f5' : '#ffffff',
        border: `1px solid ${isAtrasada ? '#fecaca' : '#e5e7eb'}`,
        borderRadius: '12px',
        padding: '14px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '8px',
        }}
      >
        <div style={{ flex: 1, marginRight: '8px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
            {conta.descricao}
          </div>
          {conta.recorrencia && (
            <div
              style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}
            >
              {conta.recorrencia === 'mensal' ? 'Fixa' : 'Variável'}
            </div>
          )}
        </div>
        <StatusBadge status={conta.status} />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Vencimento</div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: isAtrasada ? '#dc2626' : '#374151',
            }}
          >
            {formatDate(conta.data_vencimento)}
            {isAtrasada && (
              <span style={{ fontSize: '11px', fontWeight: 600 }}>
                {' '}
                · vencida
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Valor</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
            {formatBRL(conta.valor_a_receber ?? conta.valor)}
          </div>
        </div>
      </div>

      {(conta.conta?.nome || conta.categoria?.nome) && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '10px',
            flexWrap: 'wrap',
          }}
        >
          {conta.conta?.nome && (
            <span
              style={{
                fontSize: '12px',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FontAwesomeIcon icon={faBuilding} style={{ fontSize: '11px' }} />
              {conta.conta.nome}
            </span>
          )}
          {conta.categoria?.nome && (
            <span
              style={{
                fontSize: '12px',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FontAwesomeIcon icon={faTag} style={{ fontSize: '11px' }} />
              {conta.categoria.nome}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          alignItems: 'center',
          borderTop: '1px solid #f3f4f6',
          paddingTop: '10px',
          marginTop: '4px',
        }}
      >
        {conta.status === 'recebido' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              title="Comprovante"
              style={{ cursor: 'pointer', fontSize: '16px', color: '#6b7280' }}
            >
              <FontAwesomeIcon icon={faPaperclip} />
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              Recebido em {formatDate(conta.data_recebimento)}
            </span>
          </div>
        ) : (
          <>
            <button
              style={{
                background: 'none',
                border: 'none',
                fontSize: '15px',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '6px',
                color: '#6b7280',
              }}
              onClick={() => abrirModalEdicao(conta)}
              title="Editar"
            >
              <FontAwesomeIcon icon={faPenToSquare} />
            </button>
            <span
              title="Comprovante"
              style={{
                cursor: 'pointer',
                fontSize: '16px',
                color: '#6b7280',
                padding: '4px 6px',
              }}
            >
              <FontAwesomeIcon icon={faPaperclip} />
            </span>
            {conta.status === 'pendente' && (
              <button
                style={{
                  padding: '6px 14px',
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => abrirModalReceber(conta)}
                title={
                  !isOnline
                    ? 'Disponível apenas online'
                    : 'Registrar recebimento'
                }
                disabled={!isOnline}
              >
                <FontAwesomeIcon icon={faCheck} /> Receber
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '15px',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  color: '#6b7280',
                }}
                title="Mais opções"
                onClick={() =>
                  setMenuAbertoId((id) => (id === conta.id ? null : conta.id))
                }
              >
                <FontAwesomeIcon icon={faEllipsis} />
              </button>
              {menuAbertoId === conta.id && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: '4px',
                    minWidth: '160px',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#374151',
                    }}
                    disabled={!isOnline}
                    title={!isOnline ? 'Disponível apenas online' : undefined}
                    onClick={() => {
                      if (!isOnline) return;
                      setMenuAbertoId(null);
                      handleCancelar(conta);
                    }}
                  >
                    Cancelar conta
                  </button>
                  <button
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#dc2626',
                    }}
                    disabled={!isOnline}
                    title={!isOnline ? 'Disponível apenas online' : undefined}
                    onClick={() => {
                      if (!isOnline) return;
                      setMenuAbertoId(null);
                      handleExcluir(conta);
                    }}
                  >
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ContasReceberPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { saveCache, readCache } = useOfflineCache(usuario?.id);
  const { requireOnline } = useRequireOnline();
  const { isMobile, contentStyle } = useContentLayout();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [menuAbertoId, setMenuAbertoId] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filtrosVisiveis, setFiltrosVisiveis] = useState(true);

  const [filtros, setFiltros] = useState({
    status: '',
    data_vencimento_de: '',
    data_vencimento_ate: '',
    busca: '',
    categoria_id: '',
    conta_id: '',
    valor_min: '',
    valor_max: '',
  });
  const [filtrosAtivos, setFiltrosAtivos] = useState({});

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState('data_vencimento');
  const [sortDir, setSortDir] = useState('asc');

  const [modalAberto, setModalAberto] = useState(false);
  const [contaEmEdicao, setContaEmEdicao] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [salvando, setSalvando] = useState(false);

  // Categorias e contas para os selects do formulário
  const [categorias, setCategorias] = useState([]);
  const [contas, setContas] = useState([]);
  const [loadingSelects, setLoadingSelects] = useState(false);

  // Modal de anexos
  const [modalAnexoAberto, setModalAnexoAberto] = useState(false);
  const [contaParaAnexo, setContaParaAnexo] = useState(null);

  // Modal de recebimento
  const [modalReceberAberto, setModalReceberAberto] = useState(false);
  const [contaParaReceber, setContaParaReceber] = useState(null);
  const [dataRecebimento, setDataRecebimento] = useState(todayISO());
  const [contaIdRecebimento, setContaIdRecebimento] = useState('');
  const [observacoesRecebimento, setObservacoesRecebimento] = useState('');
  const [comprovante, setComprovante] = useState(null);
  const [recebendo, setRecebendo] = useState(false);

  // Grupos expandidos (accordion)
  const [gruposExpandidos, setGruposExpandidos] = useState(new Set());

  // Modal de categorias inline
  const [modalCategoriasAberto, setModalCategoriasAberto] = useState(false);
  const [listaCategoriasModal, setListaCategoriasModal] = useState([]);
  const [loadingCategoriasModal, setLoadingCategoriasModal] = useState(false);
  const [formCat, setFormCat] = useState(DEFAULT_FORM_CAT);
  const [salvandoCat, setSalvandoCat] = useState(false);
  const [catEmEdicao, setCatEmEdicao] = useState(null);
  const [excluindoCatId, setExcluindoCatId] = useState(null);

  // Modal Nova conta financeira
  const [modalContaFinanceiraAberto, setModalContaFinanceiraAberto] =
    useState(false);
  const [formContaFinanceira, setFormContaFinanceira] = useState({
    nome: '',
    tipo: 'corrente',
    banco: '',
    codigo_banco: '',
    saldo_inicial: '',
  });
  const [salvandoContaFinanceira, setSalvandoContaFinanceira] = useState(false);

  const [exportandoCSV, setExportandoCSV] = useState(false);
  const [exportandoPDF, setExportandoPDF] = useState(false);
  const [cacheInfo, setCacheInfo] = useState(null);

  const carregarLista = useCallback(async () => {
    if (!hasActiveSubscription(usuario?.status)) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 20,
        order_by: sortField,
        order_dir: sortDir,
        ...filtrosAtivos,
      };
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] === null || params[k] === undefined)
          delete params[k];
      });
      const result = await contasReceberService.listar(params);
      setLista(result.data);
      setTotalPages(result.totalPages);
      setTotal(result.total ?? 0);
      saveCache('contas-receber', {
        data: result.data,
        totalPages: result.totalPages,
        total: result.total ?? 0,
      });
      setCacheInfo(null);
    } catch (err) {
      if (!isOnline) {
        const cached = readCache('contas-receber');
        if (cached) {
          setLista(cached.data.data);
          setTotalPages(cached.data.totalPages);
          setTotal(cached.data.total);
          setCacheInfo(cached.savedAt);
          return;
        }
      }
      const msg =
        err?.response?.data?.message || 'Erro ao carregar contas a receber.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    filtrosAtivos,
    sortField,
    sortDir,
    isOnline,
    saveCache,
    readCache,
    usuario?.status,
  ]);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    carregarSelects();
  }, []);

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

  async function carregarSelects() {
    setLoadingSelects(true);
    try {
      const [resCateg, resContas] = await Promise.all([
        api.get('/categorias', { params: { tipo: 'entrada', limit: 500 } }),
        api.get('/contas', { params: { limit: 500 } }),
      ]);
      setCategorias(resCateg.data?.data ?? resCateg.data ?? []);
      setContas(resContas.data?.data ?? resContas.data ?? []);
    } catch {
      toast.error('Não foi possível carregar categorias e contas.');
    } finally {
      setLoadingSelects(false);
    }
  }

  function handleFiltroChange(e) {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
  }

  function handleFiltrar(e) {
    e.preventDefault();
    setPage(1);
    setFiltrosAtivos({ ...filtros });
  }

  function handleLimpar() {
    setFiltros({
      status: '',
      data_vencimento_de: '',
      data_vencimento_ate: '',
      busca: '',
      categoria_id: '',
      conta_id: '',
      valor_min: '',
      valor_max: '',
    });
    setFiltrosAtivos({});
    setPage(1);
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  }

  async function handleExportarCSV() {
    setExportandoCSV(true);
    try {
      const params = { format: 'csv', ...filtrosAtivos };
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] === null || params[k] === undefined)
          delete params[k];
      });
      const blob = await contasReceberService.exportar(params);
      const now = new Date();
      const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const periodo = filtrosAtivos.data_vencimento_de
        ? filtrosAtivos.data_vencimento_de.substring(0, 7)
        : mesRef;
      downloadBlob(blob, `contas-receber-${periodo}.csv`);
      toast.success('Exportação CSV concluída!');
    } catch {
      toast.error('Erro ao exportar CSV');
    } finally {
      setExportandoCSV(false);
    }
  }

  async function handleExportarPDF() {
    setExportandoPDF(true);
    try {
      const params = { format: 'pdf', ...filtrosAtivos };
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] === null || params[k] === undefined)
          delete params[k];
      });
      const blob = await contasReceberService.exportar(params);
      const now = new Date();
      const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const periodo = filtrosAtivos.data_vencimento_de
        ? filtrosAtivos.data_vencimento_de.substring(0, 7)
        : mesRef;
      downloadBlob(blob, `contas-receber-${periodo}.pdf`);
      toast.success('Exportação PDF concluída!');
    } catch {
      toast.error('Erro ao exportar PDF');
    } finally {
      setExportandoPDF(false);
    }
  }

  function abrirModalNovo() {
    setContaEmEdicao(null);
    setForm(EMPTY_FORM);
    setModalAberto(true);
    carregarSelects();
  }

  function abrirModalEdicao(conta) {
    setContaEmEdicao(conta);
    const vencimento = conta.data_vencimento
      ? conta.data_vencimento.substring(0, 10)
      : '';
    setForm({
      descricao: conta.descricao || '',
      valor: conta.valor !== undefined ? String(conta.valor) : '',
      data_vencimento: vencimento,
      tipo: conta.tipo || 'variavel',
      parcelas: conta.parcelas ? String(conta.parcelas) : '1',
      conta_id: conta.conta_id || '',
      categoria_id: conta.categoria_id || '',
      subcategoria_id: conta.subcategoria_id || '',
      multa_percentual: conta.multa_percentual
        ? String(conta.multa_percentual)
        : '',
      juros_mensal: conta.juros_mensal ? String(conta.juros_mensal) : '',
      multa_fixa: conta.multa_fixa ? String(conta.multa_fixa) : '',
      provisionado: conta.provisionado || false,
      debito_automatico: conta.debito_automatico || false,
      recorrencia: conta.recorrencia || 'nenhuma',
      recorrencia_quantidade: conta.recorrencia_quantidade
        ? String(conta.recorrencia_quantidade)
        : '1',
      observacoes: conta.observacoes || '',
    });
    setModalAberto(true);
    carregarSelects();
  }

  function fecharModal() {
    setModalAberto(false);
    setContaEmEdicao(null);
    setForm(EMPTY_FORM);
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  const handleSalvar = requireOnline(async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const valor = parseFloat(form.valor);
      if (isNaN(valor) || valor <= 0) {
        toast.error('Informe um valor válido.');
        setSalvando(false);
        return;
      }
      const payload = {
        descricao: form.descricao,
        valor,
        data_vencimento: form.data_vencimento,
        categoria_id: form.categoria_id || null,
        subcategoria_id: form.subcategoria_id || null,
        conta_id: form.conta_id || null,
        observacoes: form.observacoes || null,
        tipo: form.tipo || 'variavel',
        parcelas: form.parcelas ? parseInt(form.parcelas, 10) : 1,
        multa_percentual: form.multa_percentual
          ? parseFloat(form.multa_percentual)
          : null,
        juros_mensal: form.juros_mensal ? parseFloat(form.juros_mensal) : null,
        multa_fixa: form.multa_fixa ? parseFloat(form.multa_fixa) : null,
        provisionado: form.provisionado || false,
        debito_automatico: form.debito_automatico || false,
        recorrencia: form.recorrencia !== 'nenhuma' ? form.recorrencia : null,
        recorrente: form.recorrencia !== 'nenhuma',
        recorrencia_quantidade: form.recorrencia_quantidade
          ? parseInt(form.recorrencia_quantidade, 10)
          : 1,
      };

      if (contaEmEdicao) {
        await contasReceberService.atualizar(contaEmEdicao.id, payload);
        toast.success('Conta atualizada com sucesso!');
      } else {
        const res = await contasReceberService.criar(payload);
        toast.success('Conta criada com sucesso!');
        if (res?.grupo_recorrencia_id) {
          setGruposExpandidos(
            (prev) => new Set([...prev, res.grupo_recorrencia_id])
          );
        }
      }

      fecharModal();
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao salvar conta.';
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  });

  const handleExcluir = requireOnline(async function handleExcluir(conta) {
    if (!window.confirm(`Excluir a conta "${conta.descricao}"?`)) return;
    try {
      await contasReceberService.excluir(conta.id);
      toast.success('Conta excluída com sucesso!');
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao excluir conta.';
      toast.error(msg);
    }
  });

  function abrirModalReceber(conta) {
    setContaParaReceber(conta);
    setDataRecebimento(todayISO());
    setContaIdRecebimento(conta.conta_id || '');
    setObservacoesRecebimento('');
    setComprovante(null);
    setModalReceberAberto(true);
    carregarSelects();
  }

  function fecharModalReceber() {
    setModalReceberAberto(false);
    setContaParaReceber(null);
    setDataRecebimento(todayISO());
    setContaIdRecebimento('');
    setObservacoesRecebimento('');
    setComprovante(null);
  }

  function abrirModalAnexo(conta) {
    setContaParaAnexo(conta);
    setModalAnexoAberto(true);
  }

  function fecharModalAnexo() {
    setModalAnexoAberto(false);
    setContaParaAnexo(null);
  }

  async function handleAnexoSuccess(anexo) {
    try {
      await anexosService.vincular(anexo.id, {
        entidade_tipo: 'contas_receber',
        entidade_id: contaParaAnexo.id,
      });
      toast.success('Anexo vinculado com sucesso.');
    } catch {
      toast.error('Anexo enviado, mas não foi possível vincular à conta.');
    }
  }

  const handleConfirmarRecebimento = requireOnline(
    async function handleConfirmarRecebimento(e) {
      e.preventDefault();
      if (!contaParaReceber) return;
      setRecebendo(true);
      try {
        const payload = { data_recebimento: dataRecebimento };
        if (contaIdRecebimento) payload.conta_id = contaIdRecebimento;
        if (observacoesRecebimento)
          payload.observacoes = observacoesRecebimento;

        await contasReceberService.receber(contaParaReceber.id, payload);

        if (comprovante) {
          toast.success(
            `Conta marcada como recebida! Comprovante "${comprovante.name}" salvo localmente.`
          );
        } else {
          toast.success('Conta marcada como recebida!');
        }
        fecharModalReceber();
        carregarLista();
      } catch (err) {
        const msg =
          err?.response?.data?.message || 'Erro ao registrar recebimento.';
        toast.error(msg);
      } finally {
        setRecebendo(false);
      }
    }
  );

  const handleCancelar = requireOnline(async function handleCancelar(conta) {
    if (!window.confirm(`Cancelar a conta "${conta.descricao}"?`)) return;
    try {
      await contasReceberService.cancelar(conta.id);
      toast.success('Conta cancelada!');
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao cancelar conta.';
      toast.error(msg);
    }
  });

  function toggleGrupo(grupoId) {
    setGruposExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(grupoId)) next.delete(grupoId);
      else next.add(grupoId);
      return next;
    });
  }

  const grupos = useMemo(() => {
    const map = new Map();
    lista.forEach((conta) => {
      if (conta.grupo_recorrencia_id) {
        if (!map.has(conta.grupo_recorrencia_id)) {
          map.set(conta.grupo_recorrencia_id, []);
        }
        map.get(conta.grupo_recorrencia_id).push(conta);
      } else {
        map.set(conta.id, [conta]);
      }
    });
    return Array.from(map.entries());
  }, [lista]);

  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const resumo = useMemo(() => {
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    let pendentes = { count: 0, valor: 0 };
    let provisionadas = { count: 0, valor: 0 };
    let agendadas = { count: 0, valor: 0 };
    let atrasadas = { count: 0, valor: 0 };
    let recebidasNoMes = { count: 0, valor: 0 };

    lista.forEach((c) => {
      const venc = parseVencDate(c.data_vencimento);
      const valor = Number(c.valor || 0);

      if (c.status === 'recebido') {
        const dataReceb = c.data_recebimento
          ? new Date(c.data_recebimento)
          : null;
        if (
          dataReceb &&
          dataReceb.getMonth() === mesAtual &&
          dataReceb.getFullYear() === anoAtual
        ) {
          recebidasNoMes.count++;
          recebidasNoMes.valor += valor;
        }
      } else if (c.status === 'pendente') {
        if (venc && venc < hoje) {
          atrasadas.count++;
          atrasadas.valor += valor;
        } else if (venc && venc > hoje) {
          agendadas.count++;
          agendadas.valor += valor;
        } else {
          pendentes.count++;
          pendentes.valor += valor;
        }
      } else if (c.status === 'provisionado') {
        provisionadas.count++;
        provisionadas.valor += valor;
      }
    });

    return {
      pendentes,
      provisionadas,
      agendadas,
      atrasadas,
      recebidasNoMes,
      total: {
        count: total,
        valor: lista.reduce((s, c) => s + Number(c.valor || 0), 0),
      },
    };
  }, [lista, hoje, total]);

  const handleCancelarGrupo = requireOnline(
    async function handleCancelarGrupo(grupoId, descricao) {
      if (
        !window.confirm(
          `Cancelar todas as parcelas pendentes de "${descricao}"?`
        )
      )
        return;
      try {
        const result = await contasReceberService.cancelarGrupo(grupoId);
        toast.success(`${result.canceladas} parcela(s) cancelada(s)!`);
        carregarLista();
      } catch (err) {
        const msg = err?.response?.data?.message || 'Erro ao cancelar grupo.';
        toast.error(msg);
      }
    }
  );

  async function carregarCategoriasModal() {
    setLoadingCategoriasModal(true);
    try {
      const res = await api.get('/categorias', {
        params: { tipo: TIPO_MODAL_CAT, limit: 500 },
      });
      setListaCategoriasModal(res.data?.data ?? res.data ?? []);
    } catch {
      toast.error('Erro ao carregar categorias.');
    } finally {
      setLoadingCategoriasModal(false);
    }
  }

  function abrirModalCategorias() {
    setModalCategoriasAberto(true);
    setFormCat(DEFAULT_FORM_CAT);
    setCatEmEdicao(null);
    carregarCategoriasModal();
  }

  function fecharModalCategorias() {
    setModalCategoriasAberto(false);
    setFormCat(DEFAULT_FORM_CAT);
    setCatEmEdicao(null);
    carregarSelects();
  }

  function abrirModalContaFinanceira() {
    setFormContaFinanceira({
      nome: '',
      tipo: 'corrente',
      banco: '',
      codigo_banco: '',
      saldo_inicial: '',
    });
    setModalContaFinanceiraAberto(true);
  }

  function fecharModalContaFinanceira() {
    setModalContaFinanceiraAberto(false);
  }

  function handleContaFinanceiraChange(e) {
    const { name, value } = e.target;
    setFormContaFinanceira((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSalvarContaFinanceira(e) {
    e.preventDefault();
    setSalvandoContaFinanceira(true);
    try {
      await contasService.criar({
        nome: formContaFinanceira.nome.trim(),
        tipo: formContaFinanceira.tipo,
        banco: formContaFinanceira.banco.trim() || null,
        codigo_banco: formContaFinanceira.codigo_banco.trim() || null,
        saldo_inicial: formContaFinanceira.saldo_inicial
          ? parseFloat(formContaFinanceira.saldo_inicial)
          : 0,
      });
      toast.success('Conta financeira criada com sucesso!');
      fecharModalContaFinanceira();
      carregarSelects();
    } catch (err) {
      const msg =
        err?.response?.data?.message || 'Erro ao criar conta financeira.';
      toast.error(msg);
    } finally {
      setSalvandoContaFinanceira(false);
    }
  }

  async function handleSalvarCategoria(e) {
    e.preventDefault();
    if (!formCat.nome || !formCat.nome.trim()) {
      toast.error('O nome da categoria é obrigatório.');
      return;
    }
    setSalvandoCat(true);
    try {
      if (catEmEdicao) {
        await categoriasService.atualizar(catEmEdicao.id, {
          nome: formCat.nome.trim(),
          icone: formCat.icone.trim() || null,
          cor: formCat.cor || null,
          pai_id: formCat.pai_id || null,
        });
        toast.success('Categoria atualizada!');
      } else {
        await categoriasService.criar({
          nome: formCat.nome.trim(),
          tipo: TIPO_MODAL_CAT,
          icone: formCat.icone.trim() || null,
          cor: formCat.cor || null,
          pai_id: formCat.pai_id || null,
        });
        toast.success('Categoria criada!');
      }
      setFormCat(DEFAULT_FORM_CAT);
      setCatEmEdicao(null);
      carregarCategoriasModal();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar categoria.');
    } finally {
      setSalvandoCat(false);
    }
  }

  async function handleExcluirCategoria(cat) {
    if (!window.confirm(`Excluir a categoria "${cat.nome}"?`)) return;
    setExcluindoCatId(cat.id);
    try {
      await categoriasService.excluir(cat.id);
      toast.success('Categoria excluída!');
      carregarCategoriasModal();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir categoria.');
    } finally {
      setExcluindoCatId(null);
    }
  }

  function handleInputFocus(e) {
    e.currentTarget.style.outline = '2px solid rgb(37 99 235 / 45%)';
    e.currentTarget.style.outlineOffset = '0px';
  }
  function handleInputBlur(e) {
    e.currentTarget.style.outline = 'none';
  }

  return (
    <div style={s.pageWrapper}>
      <div style={s.page}>
        <AppSidebar
          sidebarOpen={sidebarOpen}
          isExpanded={sidebarExpanded}
          currentPath="/contas-receber"
          onHoverChange={setSidebarExpanded}
        />

        <div
          style={{
            ...s.mainArea,
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
          {/* Header */}
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
                <h1 style={s.pageTitle}>Contas a receber</h1>
              </div>
            </div>
            <div style={s.topBarRight}>
              <Button
                onClick={abrirModalNovo}
                disabled={!isOnline}
                title={!isOnline ? 'Disponível apenas online' : undefined}
              >
                + Nova conta
              </Button>
              <Button variant="outline" onClick={abrirModalContaFinanceira}>
                <FontAwesomeIcon icon={faBuilding} /> Nova conta financeira
              </Button>
              <Button variant="outline" onClick={abrirModalCategorias}>
                <FontAwesomeIcon icon={faTag} /> Categorias
              </Button>
              <Button
                variant={filtrosVisiveis ? 'primary' : 'outline'}
                onClick={() => setFiltrosVisiveis((v) => !v)}
              >
                <FontAwesomeIcon icon={faChevronDown} /> Filtros
              </Button>

              {/* Avatar / Dropdown */}
              <div ref={dropdownRef} style={{ position: 'relative' }}>
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
                    {/* User info */}
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

                    {/* Assinatura */}
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

                    {/* Perfil */}
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

                    {/* Sair */}
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
          </div>

          {/* Content */}
          <InadimplenteGuard>
            <div style={s.content}>
              {/* Cache notice when offline */}
              {!isOnline && cacheInfo && (
                <div style={{ marginBottom: '16px' }}>
                  <OfflineDataBadge savedAt={cacheInfo} />
                </div>
              )}
              {/* Summary Cards */}
              <div style={s.summaryRow}>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>
                    <FontAwesomeIcon icon={faHourglassHalf} />
                  </div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Pendentes</div>
                    <div style={s.summaryValue}>
                      {formatBRL(resumo.pendentes.valor)}
                    </div>
                    <div style={s.summaryCount}>
                      {resumo.pendentes.count} conta
                      {resumo.pendentes.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>
                    <FontAwesomeIcon icon={faShieldHalved} />
                  </div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Provisionadas</div>
                    <div style={s.summaryValue}>
                      {formatBRL(resumo.provisionadas.valor)}
                    </div>
                    <div style={s.summaryCount}>
                      {resumo.provisionadas.count} conta
                      {resumo.provisionadas.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>
                    <FontAwesomeIcon icon={faCalendarDays} />
                  </div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Agendadas</div>
                    <div style={s.summaryValue}>
                      {formatBRL(resumo.agendadas.valor)}
                    </div>
                    <div style={s.summaryCount}>
                      {resumo.agendadas.count} conta
                      {resumo.agendadas.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                  </div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Atrasadas</div>
                    <div style={{ ...s.summaryValue, color: '#dc2626' }}>
                      {formatBRL(resumo.atrasadas.valor)}
                    </div>
                    <div style={s.summaryCount}>
                      {resumo.atrasadas.count} conta
                      {resumo.atrasadas.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>
                    <FontAwesomeIcon icon={faCircleCheck} />
                  </div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Recebidas no mês</div>
                    <div style={s.summaryValue}>
                      {formatBRL(resumo.recebidasNoMes.valor)}
                    </div>
                    <div style={s.summaryCount}>
                      {resumo.recebidasNoMes.count} conta
                      {resumo.recebidasNoMes.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>
                    <FontAwesomeIcon icon={faClipboardList} />
                  </div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Total</div>
                    <div style={s.summaryValue}>
                      {formatBRL(resumo.total.valor)}
                    </div>
                    <div style={s.summaryCount}>
                      {resumo.total.count} registro
                      {resumo.total.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Filtros */}
              {filtrosVisiveis && (
                <div style={s.filterCard}>
                  <div style={s.filterCardHeader}>
                    <span style={s.filterCardTitle}>Filtros</span>
                    <span style={s.filterCardHint}>
                      Dica: use busca + período
                    </span>
                  </div>
                  <form onSubmit={handleFiltrar}>
                    <div style={s.filterRow}>
                      <div style={s.filterField}>
                        <label style={s.filterLabel}>Buscar</label>
                        <div style={s.filterInputWrapper}>
                          <span style={s.filterInputIcon}>🔍</span>
                          <input
                            type="text"
                            name="busca"
                            value={filtros.busca}
                            onChange={handleFiltroChange}
                            style={s.filterInput}
                            placeholder="Descrição ou observação"
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                          />
                        </div>
                      </div>
                      <div style={{ ...s.filterField, maxWidth: '140px' }}>
                        <label style={s.filterLabel}>Venc. de</label>
                        <input
                          type="date"
                          name="data_vencimento_de"
                          value={filtros.data_vencimento_de}
                          onChange={handleFiltroChange}
                          style={s.filterInputPlain}
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                        />
                      </div>
                      <div style={{ ...s.filterField, maxWidth: '140px' }}>
                        <label style={s.filterLabel}>até</label>
                        <input
                          type="date"
                          name="data_vencimento_ate"
                          value={filtros.data_vencimento_ate}
                          onChange={handleFiltroChange}
                          style={s.filterInputPlain}
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                        />
                      </div>
                      <div style={s.filterField}>
                        <label style={s.filterLabel}>Categoria</label>
                        <select
                          name="categoria_id"
                          value={filtros.categoria_id}
                          onChange={handleFiltroChange}
                          style={s.filterInputPlain}
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                        >
                          <option value="">Todas</option>
                          {categorias.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={s.filterField}>
                        <label style={s.filterLabel}>Status</label>
                        <select
                          name="status"
                          value={filtros.status}
                          onChange={handleFiltroChange}
                          style={s.filterInputPlain}
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                        >
                          <option value="">Todos</option>
                          <option value="pendente">Pendente</option>
                          <option value="recebido">Recebido</option>
                          <option value="cancelado">Cancelado</option>
                          <option value="estornado">Estornado</option>
                          <option value="falhou">Falhou</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ ...s.filterRow, alignItems: 'flex-end' }}>
                      <div style={{ ...s.filterField, maxWidth: '140px' }}>
                        <label style={s.filterLabel}>Valor mín.</label>
                        <input
                          type="number"
                          name="valor_min"
                          value={filtros.valor_min}
                          onChange={handleFiltroChange}
                          style={s.filterInputPlain}
                          placeholder="0,00"
                          min="0"
                          step="0.01"
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                        />
                      </div>
                      <div style={{ ...s.filterField, maxWidth: '140px' }}>
                        <label style={s.filterLabel}>Valor máx.</label>
                        <input
                          type="number"
                          name="valor_max"
                          value={filtros.valor_max}
                          onChange={handleFiltroChange}
                          style={s.filterInputPlain}
                          placeholder="0,00"
                          min="0"
                          step="0.01"
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                        />
                      </div>
                      <div style={s.filterField}>
                        <label style={s.filterLabel}>Conta financeira</label>
                        <select
                          name="conta_id"
                          value={filtros.conta_id}
                          onChange={handleFiltroChange}
                          style={s.filterInputPlain}
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                        >
                          <option value="">Todas</option>
                          {contas.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }} />
                      <Button type="submit">
                        <FontAwesomeIcon icon={faCheck} /> Aplicar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleLimpar}
                      >
                        Limpar
                      </Button>
                      <ExportButtons
                        onExportCSV={handleExportarCSV}
                        onExportPDF={handleExportarPDF}
                        loadingCSV={exportandoCSV}
                        loadingPDF={exportandoPDF}
                      />
                    </div>
                  </form>
                </div>
              )}

              {/* Lista de contas */}
              <div style={s.tableCard}>
                <div style={s.tableCardHeader}>
                  <span style={s.tableCardTitle}>Lista de contas</span>
                  <span style={s.tableCardCount}>
                    {total} item(ns) (máx. 500)
                  </span>
                </div>

                {loading ? (
                  <div style={s.centered}>Carregando...</div>
                ) : error ? (
                  <div style={s.errorBox}>{error}</div>
                ) : lista.length === 0 ? (
                  <div style={s.centered}>Nenhuma conta encontrada.</div>
                ) : isMobile ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '12px',
                    }}
                  >
                    {grupos.map(([, contas]) =>
                      contas.map((conta) => (
                        <ContaReceberMobileCard
                          key={conta.id}
                          conta={conta}
                          isOnline={isOnline}
                          hoje={hoje}
                          menuAbertoId={menuAbertoId}
                          setMenuAbertoId={setMenuAbertoId}
                          abrirModalEdicao={abrirModalEdicao}
                          abrirModalReceber={abrirModalReceber}
                          handleCancelar={handleCancelar}
                          handleExcluir={handleExcluir}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <div style={s.tableWrapper}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <SortableTh
                            field="data_vencimento"
                            label="Vencimento"
                            sortField={sortField}
                            sortDir={sortDir}
                            onSort={handleSort}
                            style={s.th}
                          />
                          <SortableTh
                            field="descricao"
                            label="Descrição"
                            sortField={sortField}
                            sortDir={sortDir}
                            onSort={handleSort}
                            style={s.th}
                          />
                          <SortableTh
                            field="valor"
                            label="Valor"
                            sortField={sortField}
                            sortDir={sortDir}
                            onSort={handleSort}
                            style={{ ...s.th, textAlign: 'right' }}
                          />
                          <th style={{ ...s.th, textAlign: 'right' }}>
                            A receber
                          </th>
                          <th style={s.th}>Conta</th>
                          <th style={s.th}>Categoria</th>
                          <SortableTh
                            field="status"
                            label="Status"
                            sortField={sortField}
                            sortDir={sortDir}
                            onSort={handleSort}
                            style={s.th}
                          />
                          <th style={{ ...s.th, textAlign: 'center' }}>
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupos.map(([grupoId, contas]) => {
                          const isGrupo = contas.length > 1;
                          if (!isGrupo) {
                            const conta = contas[0];
                            const venc = parseVencDate(conta.data_vencimento);
                            const isAtrasada =
                              conta.status === 'pendente' &&
                              venc &&
                              venc < hoje;
                            const diasAtraso = isAtrasada
                              ? Math.floor(
                                  (hoje - venc) / (1000 * 60 * 60 * 24)
                                )
                              : 0;
                            const rowBg = isAtrasada ? '#fff5f5' : undefined;
                            return (
                              <tr
                                key={conta.id}
                                style={{ ...s.tr, backgroundColor: rowBg }}
                              >
                                <td style={s.td}>
                                  <div>{formatDate(conta.data_vencimento)}</div>
                                  {isAtrasada && (
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        color: '#dc2626',
                                        fontWeight: 600,
                                      }}
                                    >
                                      vencida
                                    </div>
                                  )}
                                </td>
                                <td style={s.td}>
                                  <div style={{ fontWeight: 600 }}>
                                    {conta.descricao}
                                  </div>
                                  {conta.recorrencia && (
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        color: '#6b7280',
                                      }}
                                    >
                                      {conta.recorrencia === 'mensal'
                                        ? 'Fixa'
                                        : 'Variável'}
                                    </div>
                                  )}
                                </td>
                                <td
                                  style={{
                                    ...s.td,
                                    textAlign: 'right',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {formatBRL(conta.valor)}
                                </td>
                                <td
                                  style={{
                                    ...s.td,
                                    textAlign: 'right',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {formatBRL(
                                    conta.valor_a_receber ?? conta.valor
                                  )}
                                </td>
                                <td style={s.td}>{conta.conta?.nome || '-'}</td>
                                <td style={s.td}>
                                  {conta.categoria?.nome ? (
                                    <strong>{conta.categoria.nome}</strong>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td style={s.td}>
                                  {isAtrasada ? (
                                    <div>
                                      <span style={{ ...s.badgeAtrasado }}>
                                        <FontAwesomeIcon
                                          icon={faTriangleExclamation}
                                        />{' '}
                                        Atrasado
                                      </span>
                                      <div
                                        style={{
                                          fontSize: '11px',
                                          color: '#dc2626',
                                          fontWeight: 600,
                                          marginTop: '2px',
                                        }}
                                      >
                                        {diasAtraso}d
                                      </div>
                                    </div>
                                  ) : (
                                    <StatusBadge status={conta.status} />
                                  )}
                                </td>
                                <td
                                  style={{
                                    ...s.td,
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {conta.status === 'recebido' ? (
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <button
                                        style={s.iconBtn}
                                        title="Comprovante"
                                        onClick={() => abrirModalAnexo(conta)}
                                      >
                                        <FontAwesomeIcon icon={faPaperclip} />
                                      </button>
                                      <span
                                        style={{
                                          fontSize: '12px',
                                          color: '#6b7280',
                                        }}
                                      >
                                        Recebido em{' '}
                                        {formatDate(conta.data_recebimento)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <button
                                        style={s.iconBtn}
                                        onClick={() => abrirModalEdicao(conta)}
                                        title="Editar"
                                      >
                                        <FontAwesomeIcon icon={faPenToSquare} />
                                      </button>
                                      <button
                                        style={s.iconBtn}
                                        title="Comprovante"
                                        onClick={() => abrirModalAnexo(conta)}
                                      >
                                        <FontAwesomeIcon icon={faPaperclip} />
                                      </button>
                                      {conta.status === 'pendente' && (
                                        <button
                                          style={s.btnReceber}
                                          onClick={() =>
                                            abrirModalReceber(conta)
                                          }
                                          title={
                                            !isOnline
                                              ? 'Disponível apenas online'
                                              : 'Registrar recebimento'
                                          }
                                          disabled={!isOnline}
                                        >
                                          <FontAwesomeIcon icon={faCheck} />{' '}
                                          Receber
                                        </button>
                                      )}
                                      <div style={{ position: 'relative' }}>
                                        <button
                                          style={s.iconBtn}
                                          title="Mais opções"
                                          onClick={() =>
                                            setMenuAbertoId((id) =>
                                              id === conta.id ? null : conta.id
                                            )
                                          }
                                        >
                                          <FontAwesomeIcon icon={faEllipsis} />
                                        </button>
                                        {menuAbertoId === conta.id && (
                                          <div style={s.dropdownMenu}>
                                            <button
                                              style={s.dropdownItem}
                                              disabled={!isOnline}
                                              title={
                                                !isOnline
                                                  ? 'Disponível apenas online'
                                                  : undefined
                                              }
                                              onClick={() => {
                                                if (!isOnline) return;
                                                setMenuAbertoId(null);
                                                handleCancelar(conta);
                                              }}
                                            >
                                              Cancelar conta
                                            </button>
                                            <button
                                              style={{
                                                ...s.dropdownItem,
                                                color: '#dc2626',
                                              }}
                                              disabled={!isOnline}
                                              title={
                                                !isOnline
                                                  ? 'Disponível apenas online'
                                                  : undefined
                                              }
                                              onClick={() => {
                                                if (!isOnline) return;
                                                setMenuAbertoId(null);
                                                handleExcluir(conta);
                                              }}
                                            >
                                              Excluir
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          }

                          // Grupo parcelado
                          const expanded = gruposExpandidos.has(grupoId);
                          const totalValor = contas.reduce(
                            (sum, c) => sum + c.valor,
                            0
                          );
                          const proxPendente = contas.find(
                            (c) => c.status === 'pendente'
                          );
                          const recebidas = contas.filter(
                            (c) => c.status === 'recebido'
                          ).length;
                          const pendentes = contas.filter(
                            (c) => c.status === 'pendente'
                          ).length;
                          const temPendentes = pendentes > 0;
                          const descricaoGrupo = contas[0].descricao;
                          const totalParcelas =
                            contas[0].total_parcelas || contas.length;

                          return [
                            <tr
                              key={grupoId}
                              style={{
                                ...s.tr,
                                backgroundColor: '#f0f9ff',
                                cursor: 'pointer',
                              }}
                              role="button"
                              aria-expanded={expanded}
                              tabIndex={0}
                              onClick={() => toggleGrupo(grupoId)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleGrupo(grupoId);
                                }
                              }}
                            >
                              <td style={s.td}>
                                {proxPendente
                                  ? formatDate(proxPendente.data_vencimento)
                                  : '-'}
                              </td>
                              <td style={s.td}>
                                <span
                                  style={{
                                    marginRight: '6px',
                                    fontSize: '11px',
                                  }}
                                >
                                  {expanded ? '▼' : '▶'}
                                </span>
                                <strong>{descricaoGrupo}</strong>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    marginLeft: '6px',
                                  }}
                                >
                                  {contas.length}/{totalParcelas} parcelas
                                </span>
                              </td>
                              <td
                                style={{
                                  ...s.td,
                                  textAlign: 'right',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {formatBRL(totalValor)}
                              </td>
                              <td style={{ ...s.td, textAlign: 'right' }}>-</td>
                              <td style={s.td}>
                                {contas[0].conta?.nome || '-'}
                              </td>
                              <td style={s.td}>
                                {contas[0].categoria?.nome ? (
                                  <strong>{contas[0].categoria.nome}</strong>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td style={s.td}>
                                <span
                                  style={{ fontSize: '12px', color: '#374151' }}
                                >
                                  {recebidas > 0 && (
                                    <span style={{ color: '#166534' }}>
                                      {recebidas} recebida
                                      {recebidas !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {recebidas > 0 && pendentes > 0 && ' • '}
                                  {pendentes > 0 && (
                                    <span style={{ color: '#854d0e' }}>
                                      {pendentes} pendente
                                      {pendentes !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td
                                style={{
                                  ...s.td,
                                  textAlign: 'center',
                                  whiteSpace: 'nowrap',
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                {temPendentes && (
                                  <button
                                    style={{ ...s.btnLink, color: '#d97706' }}
                                    onClick={() =>
                                      handleCancelarGrupo(
                                        grupoId,
                                        descricaoGrupo
                                      )
                                    }
                                    title="Cancelar parcelas pendentes do grupo"
                                  >
                                    Cancelar grupo
                                  </button>
                                )}
                              </td>
                            </tr>,
                            ...(expanded
                              ? contas.map((conta) => {
                                  const venc = parseVencDate(
                                    conta.data_vencimento
                                  );
                                  const isAtrasada =
                                    conta.status === 'pendente' &&
                                    venc &&
                                    venc < hoje;
                                  const diasAtraso = isAtrasada
                                    ? Math.floor(
                                        (hoje - venc) / (1000 * 60 * 60 * 24)
                                      )
                                    : 0;
                                  const rowBg = isAtrasada
                                    ? '#fff5f5'
                                    : '#f8fafc';
                                  return (
                                    <tr
                                      key={conta.id}
                                      style={{
                                        ...s.tr,
                                        backgroundColor: rowBg,
                                      }}
                                    >
                                      <td
                                        style={{ ...s.td, paddingLeft: '32px' }}
                                      >
                                        <div>
                                          {formatDate(conta.data_vencimento)}
                                        </div>
                                        {isAtrasada && (
                                          <div
                                            style={{
                                              fontSize: '11px',
                                              color: '#dc2626',
                                              fontWeight: 600,
                                            }}
                                          >
                                            vencida
                                          </div>
                                        )}
                                      </td>
                                      <td
                                        style={{ ...s.td, paddingLeft: '32px' }}
                                      >
                                        <div style={{ fontWeight: 600 }}>
                                          {conta.descricao}
                                          <span
                                            style={{
                                              fontSize: '11px',
                                              color: '#6b7280',
                                              marginLeft: '6px',
                                            }}
                                          >
                                            {conta.parcela_atual}/
                                            {conta.total_parcelas}
                                          </span>
                                        </div>
                                      </td>
                                      <td
                                        style={{
                                          ...s.td,
                                          textAlign: 'right',
                                          fontVariantNumeric: 'tabular-nums',
                                        }}
                                      >
                                        {formatBRL(conta.valor)}
                                      </td>
                                      <td
                                        style={{
                                          ...s.td,
                                          textAlign: 'right',
                                          fontVariantNumeric: 'tabular-nums',
                                        }}
                                      >
                                        {formatBRL(
                                          conta.valor_a_receber ?? conta.valor
                                        )}
                                      </td>
                                      <td style={s.td}>
                                        {conta.conta?.nome || '-'}
                                      </td>
                                      <td style={s.td}>
                                        {conta.categoria?.nome ? (
                                          <strong>
                                            {conta.categoria.nome}
                                          </strong>
                                        ) : (
                                          '-'
                                        )}
                                      </td>
                                      <td style={s.td}>
                                        {isAtrasada ? (
                                          <div>
                                            <span style={s.badgeAtrasado}>
                                              <FontAwesomeIcon
                                                icon={faTriangleExclamation}
                                              />{' '}
                                              Atrasado
                                            </span>
                                            <div
                                              style={{
                                                fontSize: '11px',
                                                color: '#dc2626',
                                                fontWeight: 600,
                                                marginTop: '2px',
                                              }}
                                            >
                                              {diasAtraso}d
                                            </div>
                                          </div>
                                        ) : (
                                          <StatusBadge status={conta.status} />
                                        )}
                                      </td>
                                      <td
                                        style={{
                                          ...s.td,
                                          textAlign: 'center',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {conta.status === 'recebido' ? (
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                              justifyContent: 'center',
                                            }}
                                          >
                                            <button
                                              style={s.iconBtn}
                                              title="Comprovante"
                                              onClick={() =>
                                                abrirModalAnexo(conta)
                                              }
                                            >
                                              <FontAwesomeIcon
                                                icon={faPaperclip}
                                              />
                                            </button>
                                            <span
                                              style={{
                                                fontSize: '12px',
                                                color: '#6b7280',
                                              }}
                                            >
                                              Recebido em{' '}
                                              {formatDate(
                                                conta.data_recebimento
                                              )}
                                            </span>
                                          </div>
                                        ) : (
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                              justifyContent: 'center',
                                            }}
                                          >
                                            <button
                                              style={s.iconBtn}
                                              onClick={() =>
                                                abrirModalEdicao(conta)
                                              }
                                              title="Editar"
                                            >
                                              <FontAwesomeIcon
                                                icon={faPenToSquare}
                                              />
                                            </button>
                                            <button
                                              style={s.iconBtn}
                                              title="Comprovante"
                                              onClick={() =>
                                                abrirModalAnexo(conta)
                                              }
                                            >
                                              <FontAwesomeIcon
                                                icon={faPaperclip}
                                              />
                                            </button>
                                            {conta.status === 'pendente' && (
                                              <button
                                                style={s.btnReceber}
                                                onClick={() =>
                                                  abrirModalReceber(conta)
                                                }
                                                title={
                                                  !isOnline
                                                    ? 'Disponível apenas online'
                                                    : 'Registrar recebimento'
                                                }
                                                disabled={!isOnline}
                                              >
                                                <FontAwesomeIcon
                                                  icon={faCheck}
                                                />{' '}
                                                Receber
                                              </button>
                                            )}
                                            <div
                                              style={{ position: 'relative' }}
                                            >
                                              <button
                                                style={s.iconBtn}
                                                title="Mais opções"
                                                onClick={() =>
                                                  setMenuAbertoId((id) =>
                                                    id === conta.id
                                                      ? null
                                                      : conta.id
                                                  )
                                                }
                                              >
                                                <FontAwesomeIcon
                                                  icon={faEllipsis}
                                                />
                                              </button>
                                              {menuAbertoId === conta.id && (
                                                <div style={s.dropdownMenu}>
                                                  <button
                                                    style={s.dropdownItem}
                                                    disabled={!isOnline}
                                                    title={
                                                      !isOnline
                                                        ? 'Disponível apenas online'
                                                        : undefined
                                                    }
                                                    onClick={() => {
                                                      if (!isOnline) return;
                                                      setMenuAbertoId(null);
                                                      handleCancelar(conta);
                                                    }}
                                                  >
                                                    Cancelar conta
                                                  </button>
                                                  <button
                                                    style={{
                                                      ...s.dropdownItem,
                                                      color: '#dc2626',
                                                    }}
                                                    disabled={!isOnline}
                                                    title={
                                                      !isOnline
                                                        ? 'Disponível apenas online'
                                                        : undefined
                                                    }
                                                    onClick={() => {
                                                      if (!isOnline) return;
                                                      setMenuAbertoId(null);
                                                      handleExcluir(conta);
                                                    }}
                                                  >
                                                    Excluir
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              : []),
                          ];
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Paginação */}
                {!loading && !error && totalPages > 1 && (
                  <div style={s.pagination}>
                    <Button
                      variant="secondary"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Anterior
                    </Button>
                    <span style={s.pageInfo}>
                      Página {page} de {totalPages} · {total} registro
                      {total !== 1 ? 's' : ''}
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page >= totalPages}
                    >
                      Próximo
                    </Button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={s.footer}>
                Finlly • painel financeiro pessoal — {new Date().getFullYear()}
              </div>
            </div>
          </InadimplenteGuard>
        </div>
      </div>

      {/* Modal criar/editar */}
      <Modal
        open={modalAberto}
        onClose={fecharModal}
        title={
          contaEmEdicao ? 'Editar conta a receber' : 'Nova conta a receber'
        }
        maxWidth="520px"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <form onSubmit={handleSalvar}>
          {/* 1. Descrição */}
          <div style={s.formGroup}>
            <label style={s.label}>Descrição *</label>
            <input
              name="descricao"
              value={form.descricao}
              onChange={handleFormChange}
              style={s.input}
              required
              placeholder="Descrição"
              maxLength={255}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          {/* 2. Valor + Vencimento */}
          <div style={s.formRow}>
            <div style={{ ...s.formGroup, flex: 1 }}>
              <label style={s.label}>Valor (R$) *</label>
              <input
                name="valor"
                type="number"
                step="0.01"
                min="0.01"
                value={form.valor}
                onChange={handleFormChange}
                style={s.input}
                required
                placeholder="0,00"
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div style={{ ...s.formGroup, flex: 1 }}>
              <label style={s.label}>Vencimento *</label>
              <input
                name="data_vencimento"
                type="date"
                value={form.data_vencimento}
                onChange={handleFormChange}
                style={s.input}
                required
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
          </div>

          {/* 3. Tipo + Parcelas */}
          <div style={s.formRow}>
            <div style={{ ...s.formGroup, flex: 1 }}>
              <label style={s.label}>Tipo</label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={handleFormChange}
                style={s.input}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              >
                <option value="variavel">Variável</option>
                <option value="fixo">Fixo</option>
              </select>
            </div>
            <div style={{ ...s.formGroup, flex: 1 }}>
              <label style={s.label}>Parcelas</label>
              <input
                name="parcelas"
                type="number"
                min="1"
                value={form.parcelas}
                onChange={handleFormChange}
                style={s.input}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
          </div>

          {/* 4. Conta de recebimento */}
          <div style={s.formGroup}>
            <label style={s.label}>Conta de recebimento</label>
            <select
              name="conta_id"
              value={form.conta_id}
              onChange={handleFormChange}
              style={s.input}
              disabled={loadingSelects}
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
          </div>

          {/* 5. Categoria + Subcategoria */}
          <div style={s.formRow}>
            <div style={{ ...s.formGroup, flex: 1 }}>
              <label style={s.label}>Categoria</label>
              <select
                name="categoria_id"
                value={form.categoria_id}
                onChange={handleFormChange}
                style={s.input}
                disabled={loadingSelects}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              >
                <option value="">Selecione...</option>
                {categorias
                  .filter((c) => !c.pai_id && c.nome && c.nome.trim() !== '')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ ...s.formGroup, flex: 1 }}>
              <label style={s.label}>Subcategoria</label>
              <select
                name="subcategoria_id"
                value={form.subcategoria_id}
                onChange={handleFormChange}
                style={s.input}
                disabled={loadingSelects || !form.categoria_id}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              >
                <option value="">Selecione...</option>
                {categorias
                  .filter(
                    (c) =>
                      (c.pai_id === form.categoria_id ||
                        c.pai_id === Number(form.categoria_id)) &&
                      c.nome &&
                      c.nome.trim() !== ''
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* 6. Multa % + Juros %/mês + Multa fixa */}
          <div style={s.formRow}>
            <div style={{ ...s.formGroup, flex: 1 }}>
              <label style={s.label}>Multa (%)</label>
              <input
                name="multa_percentual"
                type="number"
                step="0.01"
                min="0"
                value={form.multa_percentual}
                onChange={handleFormChange}
                style={s.input}
                placeholder="0,00"
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div style={{ ...s.formGroup, flex: 1 }}>
              <label style={s.label}>Juros (%/mês)</label>
              <input
                name="juros_mensal"
                type="number"
                step="0.01"
                min="0"
                value={form.juros_mensal}
                onChange={handleFormChange}
                style={s.input}
                placeholder="0,00"
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div style={{ ...s.formGroup, flex: 1 }}>
              <label style={s.label}>Multa (fixa)</label>
              <input
                name="multa_fixa"
                type="number"
                step="0.01"
                min="0"
                value={form.multa_fixa}
                onChange={handleFormChange}
                style={s.input}
                placeholder="0,00"
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
          </div>
          <p
            style={{
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '-8px',
              marginBottom: '16px',
            }}
          >
            Se a conta atrasar, o sistema calcula o &quot;A receber&quot;
            automaticamente.
          </p>

          {/* 7. Checkboxes: Provisionado + Débito automático */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                name="provisionado"
                checked={form.provisionado}
                onChange={handleFormChange}
              />
              Provisionado (já separei o dinheiro)
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                name="debito_automatico"
                checked={form.debito_automatico}
                onChange={handleFormChange}
              />
              Débito automático (agendar)
            </label>
          </div>

          {/* 8. Recorrência */}
          <div style={s.formGroup}>
            <label style={s.label}>Recorrência</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select
                name="recorrencia"
                value={form.recorrencia}
                onChange={handleFormChange}
                style={{ ...s.input, flex: 2 }}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              >
                <option value="nenhuma">Nenhuma</option>
                <option value="diario">Diário</option>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
                <option value="bimestral">Bimestral</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
              <input
                name="recorrencia_quantidade"
                type="number"
                min="1"
                value={form.recorrencia_quantidade}
                onChange={handleFormChange}
                style={{ ...s.input, flex: 1 }}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <p
              style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}
            >
              Ex.: a cada 2 meses, a cada 1 semana...
            </p>
          </div>

          {/* 9. Observações */}
          <div style={s.formGroup}>
            <label style={s.label}>Observações</label>
            <textarea
              name="observacoes"
              value={form.observacoes}
              onChange={handleFormChange}
              style={{ ...s.input, minHeight: '80px', resize: 'vertical' }}
              maxLength={1000}
            />
          </div>

          {/* Botões */}
          <div style={s.modalActions}>
            <Button
              type="button"
              variant="ghost"
              onClick={fecharModal}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de anexos */}
      <Modal
        open={modalAnexoAberto}
        onClose={fecharModalAnexo}
        title="Anexar comprovante"
        maxWidth="480px"
      >
        <AnexoUploader
          onSuccess={handleAnexoSuccess}
          onError={(msg) => toast.error(msg)}
        />
      </Modal>

      <Modal
        open={modalReceberAberto}
        onClose={fecharModalReceber}
        title="Registrar Recebimento"
        maxWidth="420px"
      >
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#374151' }}>
          {contaParaReceber?.descricao}
        </p>
        <form onSubmit={handleConfirmarRecebimento}>
          <div style={s.formGroup}>
            <label style={s.label}>Data do recebimento *</label>
            <input
              type="date"
              value={dataRecebimento}
              onChange={(e) => setDataRecebimento(e.target.value)}
              style={s.input}
              required
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Conta bancária de crédito</label>
            <select
              value={contaIdRecebimento}
              onChange={(e) => setContaIdRecebimento(e.target.value)}
              style={s.input}
              disabled={loadingSelects}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            >
              <option value="">Selecione uma conta (opcional)</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Observações do recebimento</label>
            <textarea
              value={observacoesRecebimento}
              onChange={(e) => setObservacoesRecebimento(e.target.value)}
              style={{ ...s.input, resize: 'vertical', minHeight: '72px' }}
              maxLength={500}
              placeholder="Opcional"
            />
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Comprovante (opcional)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && file.size > 5 * 1024 * 1024) {
                  toast.error('Comprovante deve ter no máximo 5MB.');
                  e.target.value = '';
                  setComprovante(null);
                } else {
                  setComprovante(file || null);
                }
              }}
              style={{ fontSize: '14px' }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div style={s.modalActions}>
            <Button
              type="button"
              variant="ghost"
              onClick={fecharModalReceber}
              disabled={recebendo}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={recebendo}
              style={{ background: colors.success }}
            >
              {recebendo ? 'Registrando...' : 'Confirmar Recebimento'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Categorias inline */}
      <Modal
        open={modalCategoriasAberto}
        onClose={fecharModalCategorias}
        title="Categorias e Subcategorias — Entrada"
        maxWidth="600px"
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
      >
        <form
          onSubmit={handleSalvarCategoria}
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 2, minWidth: '140px' }}>
            <label
              style={{
                fontSize: '12px',
                color: '#64748b',
                fontWeight: 500,
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Nome *
            </label>
            <input
              type="text"
              value={formCat.nome}
              onChange={(e) =>
                setFormCat((prev) => ({ ...prev, nome: e.target.value }))
              }
              required
              placeholder="Ex: Salário"
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '14px',
                width: '100%',
                boxSizing: 'border-box',
              }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label
              style={{
                fontSize: '12px',
                color: '#64748b',
                fontWeight: 500,
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Categoria pai
            </label>
            <select
              value={formCat.pai_id}
              onChange={(e) =>
                setFormCat((prev) => ({ ...prev, pai_id: e.target.value }))
              }
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '14px',
                width: '100%',
                boxSizing: 'border-box',
              }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            >
              <option value="">Nenhuma (categoria principal)</option>
              {listaCategoriasModal
                .filter(
                  (c) =>
                    !c.pai_id &&
                    c.nome &&
                    c.nome.trim() !== '' &&
                    (!catEmEdicao || c.id !== catEmEdicao.id)
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={salvandoCat}
            style={{
              background: '#33528a',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {salvandoCat
              ? 'Salvando...'
              : catEmEdicao
                ? 'Salvar'
                : '+ Adicionar'}
          </button>
          {catEmEdicao && (
            <button
              type="button"
              onClick={() => {
                setCatEmEdicao(null);
                setFormCat(DEFAULT_FORM_CAT);
              }}
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          )}
        </form>

        {loadingCategoriasModal ? (
          <div
            style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}
          >
            Carregando...
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                  }}
                >
                  Categoria
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                  }}
                >
                  Tipo
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                  }}
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {listaCategoriasModal
                .filter((c) => !c.pai_id && c.nome && c.nome.trim() !== '')
                .map((cat) => (
                  <React.Fragment key={cat.id}>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontWeight: 600,
                          color: '#1e293b',
                        }}
                      >
                        {cat.nome}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#dcfce7',
                            color: '#166534',
                          }}
                        >
                          Principal
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {!cat.is_sistema && (
                          <>
                            <button
                              onClick={() => {
                                setCatEmEdicao(cat);
                                setFormCat({
                                  nome: cat.nome,
                                  icone: cat.icone || '',
                                  cor: cat.cor || '#33528a',
                                  pai_id: cat.pai_id || '',
                                });
                              }}
                              style={{
                                background: '#e0f2fe',
                                color: '#0369a1',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginRight: '6px',
                              }}
                            >
                              <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                            <button
                              onClick={() => handleExcluirCategoria(cat)}
                              disabled={excluindoCatId === cat.id}
                              style={{
                                background: '#fee2e2',
                                color: '#991b1b',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {(cat.filhos ?? [])
                      .filter((filho) => filho.nome && filho.nome.trim() !== '')
                      .map((filho) => (
                        <tr
                          key={filho.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: '#fafbfc',
                          }}
                        >
                          <td
                            style={{
                              padding: '10px 12px 10px 28px',
                              color: '#334155',
                            }}
                          >
                            ↳ {filho.nome}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: '#e2e8f0',
                                color: '#64748b',
                              }}
                            >
                              Subcategoria
                            </span>
                          </td>
                          <td
                            style={{ padding: '10px 12px', textAlign: 'right' }}
                          >
                            {!filho.is_sistema && (
                              <>
                                <button
                                  onClick={() => {
                                    setCatEmEdicao(filho);
                                    setFormCat({
                                      nome: filho.nome,
                                      icone: filho.icone || '',
                                      cor: filho.cor || '#33528a',
                                      pai_id: filho.pai_id || '',
                                    });
                                  }}
                                  style={{
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px 10px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    marginRight: '6px',
                                  }}
                                >
                                  <FontAwesomeIcon icon={faPenToSquare} />
                                </button>
                                <button
                                  onClick={() => handleExcluirCategoria(filho)}
                                  disabled={excluindoCatId === filho.id}
                                  style={{
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px 10px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
              {listaCategoriasModal.filter(
                (c) => !c.pai_id && c.nome && c.nome.trim() !== ''
              ).length === 0 && (
                <tr key="empty">
                  <td
                    colSpan={3}
                    style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}
                  >
                    Nenhuma categoria cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '20px',
          }}
        >
          <Button variant="secondary" onClick={fecharModalCategorias}>
            Fechar
          </Button>
        </div>
      </Modal>

      {/* Modal Nova conta financeira */}
      <Modal
        open={modalContaFinanceiraAberto}
        onClose={fecharModalContaFinanceira}
        title="Nova conta financeira"
        maxWidth="520px"
      >
        <form onSubmit={handleSalvarContaFinanceira}>
          <div style={s.formGroup}>
            <label style={s.label}>Nome da conta *</label>
            <input
              name="nome"
              value={formContaFinanceira.nome}
              onChange={handleContaFinanceiraChange}
              style={s.input}
              required
              placeholder="Ex: Nubank, Itaú, Carteira"
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Tipo</label>
            <select
              name="tipo"
              value={formContaFinanceira.tipo}
              onChange={handleContaFinanceiraChange}
              style={s.input}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            >
              <option value="corrente">Conta corrente</option>
              <option value="poupanca">Poupança</option>
              <option value="dinheiro">Carteira</option>
              <option value="investimento">Corretora</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Banco / Instituição (opcional)</label>
            <input
              name="banco"
              value={formContaFinanceira.banco}
              onChange={handleContaFinanceiraChange}
              style={s.input}
              placeholder="Ex: Nubank"
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Código do banco (opcional)</label>
            <input
              name="codigo_banco"
              value={formContaFinanceira.codigo_banco}
              onChange={handleContaFinanceiraChange}
              style={s.input}
              placeholder="Ex: 260, 341"
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Saldo inicial (R$)</label>
            <input
              name="saldo_inicial"
              type="number"
              step="0.01"
              min="0"
              value={formContaFinanceira.saldo_inicial}
              onChange={handleContaFinanceiraChange}
              style={s.input}
              placeholder="0,00"
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div
            style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              marginTop: '24px',
            }}
          >
            <Button
              type="button"
              variant="secondary"
              onClick={fecharModalContaFinanceira}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={salvandoContaFinanceira}>
              {salvandoContaFinanceira ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const s = {
  pageWrapper: {
    minHeight: '100vh',
    background: colors.bg,
    display: 'flex',
    flexDirection: 'column',
  },
  page: {
    display: 'flex',
    flex: 1,
    minHeight: '100vh',
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 28px',
    background: colors.white,
    borderBottom: `1px solid ${colors.border}`,
    gap: '16px',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  hamburger: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: colors.neutral600,
    padding: '4px 8px',
    borderRadius: radius.sm,
  },
  pageTitle: {
    margin: 0,
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral900,
  },
  content: {
    padding: '20px 28px',
    flex: 1,
  },
  summaryRow: {
    display: 'flex',
    gap: '14px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  summaryCard: {
    flex: '1 1 140px',
    background: colors.white,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.md,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    minWidth: '130px',
  },
  summaryIcon: {
    fontSize: '22px',
    lineHeight: 1,
    marginTop: '2px',
  },
  summaryInfo: {
    flex: 1,
    minWidth: 0,
  },
  summaryLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral500,
    fontWeight: typography.weights.medium,
    marginBottom: '2px',
    whiteSpace: 'nowrap',
  },
  summaryValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral900,
    whiteSpace: 'nowrap',
  },
  summaryCount: {
    fontSize: typography.sizes.xs,
    color: colors.neutral400,
    marginTop: '2px',
  },
  filterCard: {
    background: colors.white,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.md,
    padding: '16px 20px',
    marginBottom: '20px',
  },
  filterCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  filterCardTitle: {
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.lg,
    color: colors.neutral900,
  },
  filterCardHint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral400,
  },
  filterRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  filterField: {
    flex: '1 1 150px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  filterLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral500,
  },
  filterInputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  filterInputIcon: {
    position: 'absolute',
    left: '8px',
    fontSize: '14px',
    pointerEvents: 'none',
  },
  filterInput: {
    width: '100%',
    padding: '8px 10px 8px 30px',
    border: `1px solid ${colors.neutral300}`,
    borderRadius: radius.md,
    fontSize: typography.sizes.base,
    color: colors.neutral700,
    background: colors.white,
    boxSizing: 'border-box',
    outline: 'none',
  },
  filterInputPlain: {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${colors.neutral300}`,
    borderRadius: radius.md,
    fontSize: typography.sizes.base,
    color: colors.neutral700,
    background: colors.white,
    boxSizing: 'border-box',
    outline: 'none',
  },
  tableCard: {
    background: colors.white,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.md,
    overflow: 'hidden',
  },
  tableCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: `1px solid ${colors.border}`,
    background: colors.neutral50,
  },
  tableCardTitle: {
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.lg,
    color: colors.neutral900,
  },
  tableCardCount: {
    fontSize: typography.sizes.base,
    color: colors.neutral500,
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: typography.sizes.md,
    color: colors.neutral900,
  },
  th: {
    padding: '11px 14px',
    fontWeight: typography.weights.semibold,
    color: colors.neutral700,
    fontSize: typography.sizes.sm,
    borderBottom: `1px solid ${colors.border}`,
    textAlign: 'left',
    background: colors.neutral50,
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: `1px solid ${colors.neutral100}`,
  },
  td: {
    padding: '11px 14px',
    color: colors.neutral700,
    fontSize: typography.sizes.base,
    verticalAlign: 'middle',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '16px',
    borderTop: `1px solid ${colors.neutral100}`,
  },
  pageInfo: {
    fontSize: typography.sizes.md,
    color: colors.neutral500,
  },
  centered: {
    textAlign: 'center',
    padding: '48px',
    color: colors.neutral500,
    fontSize: typography.sizes.lg,
  },
  errorBox: {
    background: colors.errorBg,
    color: colors.errorText,
    padding: '16px 20px',
    fontSize: typography.sizes.md,
    border: `1px solid ${colors.errorBorder}`,
  },
  badgeAtrasado: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: radius.full,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    background: colors.errorBg,
    color: colors.errorText,
  },
  btnLink: {
    background: 'none',
    border: 'none',
    color: colors.primaryLight,
    fontSize: typography.sizes.base,
    cursor: 'pointer',
    padding: '2px 4px',
    textDecoration: 'underline',
  },
  btnReceber: {
    padding: '5px 12px',
    background: colors.success,
    color: colors.white,
    border: 'none',
    borderRadius: radius.md,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    fontSize: '15px',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: radius.sm,
    lineHeight: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: '4px',
    background: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    boxShadow: shadows.lg,
    zIndex: 100,
    minWidth: '140px',
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    padding: '9px 14px',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    fontSize: typography.sizes.base,
    cursor: 'pointer',
    color: colors.neutral700,
  },
  select: {
    padding: '8px 12px',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    fontSize: typography.sizes.md,
    color: colors.neutral700,
    background: colors.white,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    fontSize: typography.sizes.md,
    color: colors.neutral700,
    background: colors.white,
    boxSizing: 'border-box',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral700,
  },
  formGroup: {
    marginBottom: '16px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '0',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },
  footer: {
    marginTop: '50px',
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
    borderRadius: radius.lg,
  },
};
