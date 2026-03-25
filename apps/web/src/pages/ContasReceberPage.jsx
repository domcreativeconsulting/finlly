import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { contasReceberService } from '../services/contasReceber.service.js';
import api from '../services/api.js';

const STATUS_LABELS = {
  pendente: 'Pendente',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
  estornado: 'Estornado',
  falhou: 'Falhou',
};

const STATUS_COLORS = {
  pendente: { background: '#fef9c3', color: '#854d0e' },
  recebido: { background: '#dcfce7', color: '#166534' },
  cancelado: { background: '#f3f4f6', color: '#6b7280' },
  estornado: { background: '#ffedd5', color: '#9a3412' },
  falhou: { background: '#fee2e2', color: '#991b1b' },
};

const RECORRENCIA_OPCOES = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatDate(data_vencimento) {
  if (!data_vencimento) return '-';
  const datePart = String(data_vencimento).substring(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return '-';
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}

function StatusBadge({ status }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.pendente;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 600,
        ...style,
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
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

export default function ContasReceberPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [menuAbertoId, setMenuAbertoId] = useState(null);

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

  const carregarLista = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20, order_by: sortField, order_dir: sortDir, ...filtrosAtivos };
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] === null || params[k] === undefined) delete params[k];
      });
      const result = await contasReceberService.listar(params);
      setLista(result.data);
      setTotalPages(result.totalPages);
      setTotal(result.total ?? 0);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao carregar contas a receber.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, filtrosAtivos, sortField, sortDir]);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    carregarSelects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setFiltros({ status: '', data_vencimento_de: '', data_vencimento_ate: '', busca: '', categoria_id: '', valor_min: '', valor_max: '' });
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
      multa_percentual: conta.multa_percentual ? String(conta.multa_percentual) : '',
      juros_mensal: conta.juros_mensal ? String(conta.juros_mensal) : '',
      multa_fixa: conta.multa_fixa ? String(conta.multa_fixa) : '',
      provisionado: conta.provisionado || false,
      debito_automatico: conta.debito_automatico || false,
      recorrencia: conta.recorrencia || 'nenhuma',
      recorrencia_quantidade: conta.recorrencia_quantidade ? String(conta.recorrencia_quantidade) : '1',
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
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSalvar(e) {
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
        multa_percentual: form.multa_percentual ? parseFloat(form.multa_percentual) : null,
        juros_mensal: form.juros_mensal ? parseFloat(form.juros_mensal) : null,
        multa_fixa: form.multa_fixa ? parseFloat(form.multa_fixa) : null,
        provisionado: form.provisionado || false,
        debito_automatico: form.debito_automatico || false,
        recorrencia: form.recorrencia !== 'nenhuma' ? form.recorrencia : null,
        recorrente: form.recorrencia !== 'nenhuma',
        recorrencia_quantidade: form.recorrencia_quantidade ? parseInt(form.recorrencia_quantidade, 10) : 1,
      };

      if (contaEmEdicao) {
        await contasReceberService.atualizar(contaEmEdicao.id, payload);
        toast.success('Conta atualizada com sucesso!');
      } else {
        const res = await contasReceberService.criar(payload);
        toast.success('Conta criada com sucesso!');
        if (res?.grupo_recorrencia_id) {
          setGruposExpandidos((prev) => new Set([...prev, res.grupo_recorrencia_id]));
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
  }

  async function handleExcluir(conta) {
    if (!window.confirm(`Excluir a conta "${conta.descricao}"?`)) return;
    try {
      await contasReceberService.excluir(conta.id);
      toast.success('Conta excluída com sucesso!');
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao excluir conta.';
      toast.error(msg);
    }
  }

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

  async function handleConfirmarRecebimento(e) {
    e.preventDefault();
    if (!contaParaReceber) return;
    setRecebendo(true);
    try {
      const payload = { data_recebimento: dataRecebimento };
      if (contaIdRecebimento) payload.conta_id = contaIdRecebimento;
      if (observacoesRecebimento) payload.observacoes = observacoesRecebimento;

      await contasReceberService.receber(contaParaReceber.id, payload);

      if (comprovante) {
        toast.success(`Conta marcada como recebida! Comprovante "${comprovante.name}" salvo localmente.`);
      } else {
        toast.success('Conta marcada como recebida!');
      }
      fecharModalReceber();
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao registrar recebimento.';
      toast.error(msg);
    } finally {
      setRecebendo(false);
    }
  }

  async function handleCancelar(conta) {
    if (!window.confirm(`Cancelar a conta "${conta.descricao}"?`)) return;
    try {
      await contasReceberService.cancelar(conta.id);
      toast.success('Conta cancelada!');
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao cancelar conta.';
      toast.error(msg);
    }
  }

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
        const dataReceb = c.data_recebimento ? new Date(c.data_recebimento) : null;
        if (dataReceb && dataReceb.getMonth() === mesAtual && dataReceb.getFullYear() === anoAtual) {
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

    return { pendentes, provisionadas, agendadas, atrasadas, recebidasNoMes, total: { count: total, valor: lista.reduce((s, c) => s + Number(c.valor || 0), 0) } };
  }, [lista, hoje, total]);

  async function handleCancelarGrupo(grupoId, descricao) {
    if (!window.confirm(`Cancelar todas as parcelas pendentes de "${descricao}"?`)) return;
    try {
      const result = await contasReceberService.cancelarGrupo(grupoId);
      toast.success(`${result.canceladas} parcela(s) cancelada(s)!`);
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao cancelar grupo.';
      toast.error(msg);
    }
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
            marginLeft: !sidebarOpen
              ? '0px'
              : sidebarExpanded
                ? '236px'
                : '108px',
            transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
                ☰
              </button>
              <div>
                <h1 style={s.pageTitle}>Contas a receber</h1>
              </div>
            </div>
            <div style={s.topBarRight}>
              <button style={s.btnPrimary} onClick={abrirModalNovo}>
                + Nova conta
              </button>
              <button style={s.btnOutline}>
                🏦 Nova conta financeira
              </button>
              <button style={s.btnOutline} onClick={() => navigate('/categorias')}>
                🏷️ Categorias
              </button>
              <button
                style={{ ...s.btnOutline, ...(filtrosVisiveis ? s.btnOutlineActive : {}) }}
                onClick={() => setFiltrosVisiveis((v) => !v)}
              >
                🔽 Filtros
              </button>
            </div>
          </div>

          {/* Content */}
          <InadimplenteGuard>
            <div style={s.content}>

              {/* Summary Cards */}
              <div style={s.summaryRow}>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>⏳</div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Pendentes</div>
                    <div style={s.summaryValue}>{formatBRL(resumo.pendentes.valor)}</div>
                    <div style={s.summaryCount}>{resumo.pendentes.count} conta{resumo.pendentes.count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>🛡️</div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Provisionadas</div>
                    <div style={s.summaryValue}>{formatBRL(resumo.provisionadas.valor)}</div>
                    <div style={s.summaryCount}>{resumo.provisionadas.count} conta{resumo.provisionadas.count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>📅</div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Agendadas</div>
                    <div style={s.summaryValue}>{formatBRL(resumo.agendadas.valor)}</div>
                    <div style={s.summaryCount}>{resumo.agendadas.count} conta{resumo.agendadas.count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>⚠️</div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Atrasadas</div>
                    <div style={{ ...s.summaryValue, color: '#dc2626' }}>{formatBRL(resumo.atrasadas.valor)}</div>
                    <div style={s.summaryCount}>{resumo.atrasadas.count} conta{resumo.atrasadas.count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>✅</div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Recebidas no mês</div>
                    <div style={s.summaryValue}>{formatBRL(resumo.recebidasNoMes.valor)}</div>
                    <div style={s.summaryCount}>{resumo.recebidasNoMes.count} conta{resumo.recebidasNoMes.count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={s.summaryIcon}>📋</div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Total</div>
                    <div style={s.summaryValue}>{formatBRL(resumo.total.valor)}</div>
                    <div style={s.summaryCount}>{resumo.total.count} registro{resumo.total.count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              </div>

              {/* Filtros */}
              {filtrosVisiveis && (
                <div style={s.filterCard}>
                  <div style={s.filterCardHeader}>
                    <span style={s.filterCardTitle}>Filtros</span>
                    <span style={s.filterCardHint}>Dica: use busca + período</span>
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
                        />
                      </div>
                      <div style={s.filterField}>
                        <label style={s.filterLabel}>Categoria</label>
                        <select
                          name="categoria_id"
                          value={filtros.categoria_id}
                          onChange={handleFiltroChange}
                          style={s.filterInputPlain}
                        >
                          <option value="">Todas</option>
                          {categorias.map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
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
                        />
                      </div>
                      <div style={{ flex: 1 }} />
                      <button type="submit" style={s.btnPrimary}>
                        ✓ Aplicar
                      </button>
                      <button type="button" style={s.btnOutline} onClick={handleLimpar}>
                        Limpar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Lista de contas */}
              <div style={s.tableCard}>
                <div style={s.tableCardHeader}>
                  <span style={s.tableCardTitle}>Lista de contas</span>
                  <span style={s.tableCardCount}>{total} item(ns) (máx. 500)</span>
                </div>

                {loading ? (
                  <div style={s.centered}>Carregando...</div>
                ) : error ? (
                  <div style={s.errorBox}>{error}</div>
                ) : lista.length === 0 ? (
                  <div style={s.centered}>Nenhuma conta encontrada.</div>
                ) : (
                  <div style={s.tableWrapper}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <SortableTh field="data_vencimento" label="Vencimento" sortField={sortField} sortDir={sortDir} onSort={handleSort} style={s.th} />
                          <SortableTh field="descricao" label="Descrição" sortField={sortField} sortDir={sortDir} onSort={handleSort} style={s.th} />
                          <SortableTh field="valor" label="Valor" sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ ...s.th, textAlign: 'right' }} />
                          <th style={{ ...s.th, textAlign: 'right' }}>A receber</th>
                          <th style={s.th}>Conta</th>
                          <th style={s.th}>Categoria</th>
                          <SortableTh field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={handleSort} style={s.th} />
                          <th style={{ ...s.th, textAlign: 'center' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupos.map(([grupoId, contas]) => {
                          const isGrupo = contas.length > 1;
                          if (!isGrupo) {
                            const conta = contas[0];
                            const venc = parseVencDate(conta.data_vencimento);
                            const isAtrasada = conta.status === 'pendente' && venc && venc < hoje;
                            const diasAtraso = isAtrasada ? Math.floor((hoje - venc) / (1000 * 60 * 60 * 24)) : 0;
                            const rowBg = isAtrasada ? '#fff5f5' : undefined;
                            return (
                              <tr key={conta.id} style={{ ...s.tr, backgroundColor: rowBg }}>
                                <td style={s.td}>
                                  <div>{formatDate(conta.data_vencimento)}</div>
                                  {isAtrasada && <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>vencida</div>}
                                </td>
                                <td style={s.td}>
                                  <div style={{ fontWeight: 600 }}>{conta.descricao}</div>
                                  {conta.recorrencia && <div style={{ fontSize: '11px', color: '#6b7280' }}>{conta.recorrencia === 'mensal' ? 'Fixa' : 'Variável'}</div>}
                                </td>
                                <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatBRL(conta.valor)}
                                </td>
                                <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatBRL(conta.valor_a_receber ?? conta.valor)}
                                </td>
                                <td style={s.td}>{conta.conta?.nome || '-'}</td>
                                <td style={s.td}>
                                  {conta.categoria?.nome
                                    ? <strong>{conta.categoria.nome}</strong>
                                    : '-'}
                                </td>
                                <td style={s.td}>
                                  {isAtrasada ? (
                                    <div>
                                      <span style={{ ...s.badgeAtrasado }}>⚠️ Atrasado</span>
                                      <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, marginTop: '2px' }}>{diasAtraso}d</div>
                                    </div>
                                  ) : (
                                    <StatusBadge status={conta.status} />
                                  )}
                                </td>
                                <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {conta.status === 'recebido' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                      <span title="Comprovante" style={{ cursor: 'pointer', fontSize: '16px' }}>📎</span>
                                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                        Recebido em {formatDate(conta.data_recebimento)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                      <button
                                        style={s.iconBtn}
                                        onClick={() => abrirModalEdicao(conta)}
                                        title="Editar"
                                      >
                                        ✏️
                                      </button>
                                      <span title="Comprovante" style={{ cursor: 'pointer', fontSize: '16px' }}>📎</span>
                                      {(conta.status === 'pendente') && (
                                        <button
                                          style={s.btnReceber}
                                          onClick={() => abrirModalReceber(conta)}
                                          title="Registrar recebimento"
                                        >
                                          ✓ Receber
                                        </button>
                                      )}
                                      <div style={{ position: 'relative' }}>
                                        <button
                                          style={s.iconBtn}
                                          title="Mais opções"
                                          onClick={() => setMenuAbertoId((id) => id === conta.id ? null : conta.id)}
                                        >
                                          ···
                                        </button>
                                        {menuAbertoId === conta.id && (
                                          <div style={s.dropdownMenu}>
                                            <button style={s.dropdownItem} onClick={() => { setMenuAbertoId(null); handleCancelar(conta); }}>
                                              Cancelar conta
                                            </button>
                                            <button style={{ ...s.dropdownItem, color: '#dc2626' }} onClick={() => { setMenuAbertoId(null); handleExcluir(conta); }}>
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
                          const totalValor = contas.reduce((sum, c) => sum + c.valor, 0);
                          const proxPendente = contas.find((c) => c.status === 'pendente');
                          const recebidas = contas.filter((c) => c.status === 'recebido').length;
                          const pendentes = contas.filter((c) => c.status === 'pendente').length;
                          const temPendentes = pendentes > 0;
                          const descricaoGrupo = contas[0].descricao;
                          const totalParcelas = contas[0].total_parcelas || contas.length;

                          return [
                            <tr
                              key={grupoId}
                              style={{ ...s.tr, backgroundColor: '#f0f9ff', cursor: 'pointer' }}
                              role="button"
                              aria-expanded={expanded}
                              tabIndex={0}
                              onClick={() => toggleGrupo(grupoId)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGrupo(grupoId); } }}
                            >
                              <td style={s.td}>{proxPendente ? formatDate(proxPendente.data_vencimento) : '-'}</td>
                              <td style={s.td}>
                                <span style={{ marginRight: '6px', fontSize: '11px' }}>{expanded ? '▼' : '▶'}</span>
                                <strong>{descricaoGrupo}</strong>
                                <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '6px' }}>
                                  {contas.length}/{totalParcelas} parcelas
                                </span>
                              </td>
                              <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {formatBRL(totalValor)}
                              </td>
                              <td style={{ ...s.td, textAlign: 'right' }}>-</td>
                              <td style={s.td}>{contas[0].conta?.nome || '-'}</td>
                              <td style={s.td}>{contas[0].categoria?.nome ? <strong>{contas[0].categoria.nome}</strong> : '-'}</td>
                              <td style={s.td}>
                                <span style={{ fontSize: '12px', color: '#374151' }}>
                                  {recebidas > 0 && <span style={{ color: '#166534' }}>{recebidas} recebida{recebidas !== 1 ? 's' : ''}</span>}
                                  {recebidas > 0 && pendentes > 0 && ' • '}
                                  {pendentes > 0 && <span style={{ color: '#854d0e' }}>{pendentes} pendente{pendentes !== 1 ? 's' : ''}</span>}
                                </span>
                              </td>
                              <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                {temPendentes && (
                                  <button
                                    style={{ ...s.btnLink, color: '#d97706' }}
                                    onClick={() => handleCancelarGrupo(grupoId, descricaoGrupo)}
                                    title="Cancelar parcelas pendentes do grupo"
                                  >
                                    Cancelar grupo
                                  </button>
                                )}
                              </td>
                            </tr>,
                            ...(expanded ? contas.map((conta) => {
                              const venc = parseVencDate(conta.data_vencimento);
                              const isAtrasada = conta.status === 'pendente' && venc && venc < hoje;
                              const diasAtraso = isAtrasada ? Math.floor((hoje - venc) / (1000 * 60 * 60 * 24)) : 0;
                              const rowBg = isAtrasada ? '#fff5f5' : '#f8fafc';
                              return (
                                <tr key={conta.id} style={{ ...s.tr, backgroundColor: rowBg }}>
                                  <td style={{ ...s.td, paddingLeft: '32px' }}>
                                    <div>{formatDate(conta.data_vencimento)}</div>
                                    {isAtrasada && <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>vencida</div>}
                                  </td>
                                  <td style={{ ...s.td, paddingLeft: '32px' }}>
                                    <div style={{ fontWeight: 600 }}>
                                      {conta.descricao}
                                      <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '6px' }}>
                                        {conta.parcela_atual}/{conta.total_parcelas}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatBRL(conta.valor)}
                                  </td>
                                  <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatBRL(conta.valor_a_receber ?? conta.valor)}
                                  </td>
                                  <td style={s.td}>{conta.conta?.nome || '-'}</td>
                                  <td style={s.td}>
                                    {conta.categoria?.nome ? <strong>{conta.categoria.nome}</strong> : '-'}
                                  </td>
                                  <td style={s.td}>
                                    {isAtrasada ? (
                                      <div>
                                        <span style={s.badgeAtrasado}>⚠️ Atrasado</span>
                                        <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, marginTop: '2px' }}>{diasAtraso}d</div>
                                      </div>
                                    ) : (
                                      <StatusBadge status={conta.status} />
                                    )}
                                  </td>
                                  <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {conta.status === 'recebido' ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                        <span title="Comprovante" style={{ cursor: 'pointer', fontSize: '16px' }}>📎</span>
                                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                          Recebido em {formatDate(conta.data_recebimento)}
                                        </span>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                        <button style={s.iconBtn} onClick={() => abrirModalEdicao(conta)} title="Editar">✏️</button>
                                        <span title="Comprovante" style={{ cursor: 'pointer', fontSize: '16px' }}>📎</span>
                                        {conta.status === 'pendente' && (
                                          <button style={s.btnReceber} onClick={() => abrirModalReceber(conta)} title="Registrar recebimento">
                                            ✓ Receber
                                          </button>
                                        )}
                                        <div style={{ position: 'relative' }}>
                                          <button
                                            style={s.iconBtn}
                                            title="Mais opções"
                                            onClick={() => setMenuAbertoId((id) => id === conta.id ? null : conta.id)}
                                          >
                                            ···
                                          </button>
                                          {menuAbertoId === conta.id && (
                                            <div style={s.dropdownMenu}>
                                              <button style={s.dropdownItem} onClick={() => { setMenuAbertoId(null); handleCancelar(conta); }}>
                                                Cancelar conta
                                              </button>
                                              <button style={{ ...s.dropdownItem, color: '#dc2626' }} onClick={() => { setMenuAbertoId(null); handleExcluir(conta); }}>
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
                            }) : []),
                          ];
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Paginação */}
                {!loading && !error && totalPages > 1 && (
                  <div style={s.pagination}>
                    <button
                      style={s.btnSecondary}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Anterior
                    </button>
                    <span style={s.pageInfo}>
                      Página {page} de {totalPages} · {total} registro{total !== 1 ? 's' : ''}
                    </span>
                    <button
                      style={s.btnSecondary}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Próximo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </InadimplenteGuard>

          {/* Footer */}
          <div style={s.footer}>
            Finlly • painel financeiro pessoal — 2026
          </div>
        </div>
      </div>

      {/* Modal criar/editar */}
      {modalAberto && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true" aria-label="Formulário de conta a receber">
          <div style={{ ...s.modalBox, maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Cabeçalho com botão X */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ ...s.modalTitle, margin: 0 }}>
                {contaEmEdicao ? 'Editar conta a receber' : 'Nova conta a receber'}
              </h2>
              <button onClick={fecharModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#6b7280' }}>✕</button>
            </div>
            <form onSubmit={handleSalvar}>
              {/* 1. Descrição */}
              <div style={s.formGroup}>
                <label style={s.label}>Descrição *</label>
                <input name="descricao" value={form.descricao} onChange={handleFormChange} style={s.input} required placeholder="Descrição" maxLength={255} />
              </div>

              {/* 2. Valor + Vencimento */}
              <div style={s.formRow}>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Valor (R$) *</label>
                  <input name="valor" type="number" step="0.01" min="0.01" value={form.valor} onChange={handleFormChange} style={s.input} required placeholder="0,00" />
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Vencimento *</label>
                  <input name="data_vencimento" type="date" value={form.data_vencimento} onChange={handleFormChange} style={s.input} required />
                </div>
              </div>

              {/* 3. Tipo + Parcelas */}
              <div style={s.formRow}>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Tipo</label>
                  <select name="tipo" value={form.tipo} onChange={handleFormChange} style={s.input}>
                    <option value="variavel">Variável</option>
                    <option value="fixo">Fixo</option>
                  </select>
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Parcelas</label>
                  <input name="parcelas" type="number" min="1" value={form.parcelas} onChange={handleFormChange} style={s.input} />
                </div>
              </div>

              {/* 4. Conta de recebimento */}
              <div style={s.formGroup}>
                <label style={s.label}>Conta de recebimento</label>
                <select name="conta_id" value={form.conta_id} onChange={handleFormChange} style={s.input} disabled={loadingSelects}>
                  <option value="">Selecione...</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {/* 5. Categoria + Subcategoria */}
              <div style={s.formRow}>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Categoria</label>
                  <select name="categoria_id" value={form.categoria_id} onChange={handleFormChange} style={s.input} disabled={loadingSelects}>
                    <option value="">Selecione...</option>
                    {categorias.filter(c => !c.pai_id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Subcategoria</label>
                  <select name="subcategoria_id" value={form.subcategoria_id} onChange={handleFormChange} style={s.input} disabled={loadingSelects || !form.categoria_id}>
                    <option value="">Selecione...</option>
                    {categorias.filter(c => c.pai_id === form.categoria_id || c.pai_id === Number(form.categoria_id)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* 6. Multa % + Juros %/mês + Multa fixa */}
              <div style={s.formRow}>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Multa (%)</label>
                  <input name="multa_percentual" type="number" step="0.01" min="0" value={form.multa_percentual} onChange={handleFormChange} style={s.input} placeholder="0,00" />
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Juros (%/mês)</label>
                  <input name="juros_mensal" type="number" step="0.01" min="0" value={form.juros_mensal} onChange={handleFormChange} style={s.input} placeholder="0,00" />
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Multa (fixa)</label>
                  <input name="multa_fixa" type="number" step="0.01" min="0" value={form.multa_fixa} onChange={handleFormChange} style={s.input} placeholder="0,00" />
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '-8px', marginBottom: '16px' }}>
                Se a conta atrasar, o sistema calcula o &quot;A receber&quot; automaticamente.
              </p>

              {/* 7. Checkboxes: Provisionado + Débito automático */}
              <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" name="provisionado" checked={form.provisionado} onChange={handleFormChange} />
                  Provisionado (já separei o dinheiro)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" name="debito_automatico" checked={form.debito_automatico} onChange={handleFormChange} />
                  Débito automático (agendar)
                </label>
              </div>

              {/* 8. Recorrência */}
              <div style={s.formGroup}>
                <label style={s.label}>Recorrência</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <select name="recorrencia" value={form.recorrencia} onChange={handleFormChange} style={{ ...s.input, flex: 2 }}>
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
                  <input name="recorrencia_quantidade" type="number" min="1" value={form.recorrencia_quantidade} onChange={handleFormChange} style={{ ...s.input, flex: 1 }} />
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                  Ex.: a cada 2 meses, a cada 1 semana...
                </p>
              </div>

              {/* 9. Observações */}
              <div style={s.formGroup}>
                <label style={s.label}>Observações</label>
                <textarea name="observacoes" value={form.observacoes} onChange={handleFormChange} style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} maxLength={1000} />
              </div>

              {/* Botões */}
              <div style={s.modalActions}>
                <button type="button" style={s.btnGhost} onClick={fecharModal} disabled={salvando}>Cancelar</button>
                <button type="submit" style={s.btnPrimary} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal receber */}
      {modalReceberAberto && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true" aria-label="Registrar recebimento">
          <div style={{ ...s.modalBox, maxWidth: '420px' }}>
            <h2 style={s.modalTitle}>Registrar Recebimento</h2>
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
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Conta bancária de crédito</label>
                <select
                  value={contaIdRecebimento}
                  onChange={(e) => setContaIdRecebimento(e.target.value)}
                  style={s.input}
                  disabled={loadingSelects}
                >
                  <option value="">Selecione uma conta (opcional)</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
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
                />
              </div>
              <div style={s.modalActions}>
                <button type="button" style={s.btnGhost} onClick={fecharModalReceber} disabled={recebendo}>
                  Cancelar
                </button>
                <button type="submit" style={{ ...s.btnPrimary, background: '#16a34a' }} disabled={recebendo}>
                  {recebendo ? 'Registrando...' : 'Confirmar Recebimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  pageWrapper: {
    minHeight: '100vh',
    background: '#f3f4f6',
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
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
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
    color: '#4b5563',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  pageTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 700,
    color: '#111827',
  },
  content: {
    padding: '20px 28px',
    flex: 1,
  },
  // Summary Cards
  summaryRow: {
    display: 'flex',
    gap: '14px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  summaryCard: {
    flex: '1 1 140px',
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
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
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: 500,
    marginBottom: '2px',
    whiteSpace: 'nowrap',
  },
  summaryValue: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
    whiteSpace: 'nowrap',
  },
  summaryCount: {
    fontSize: '11px',
    color: '#9ca3af',
    marginTop: '2px',
  },
  // Filter Card
  filterCard: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
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
    fontWeight: 700,
    fontSize: '15px',
    color: '#111827',
  },
  filterCardHint: {
    fontSize: '12px',
    color: '#9ca3af',
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
    fontSize: '12px',
    fontWeight: 500,
    color: '#6b7280',
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
    border: '1px solid #d1d5db',
    borderRadius: '7px',
    fontSize: '13px',
    color: '#374151',
    background: '#ffffff',
    boxSizing: 'border-box',
    outline: 'none',
  },
  filterInputPlain: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '7px',
    fontSize: '13px',
    color: '#374151',
    background: '#ffffff',
    boxSizing: 'border-box',
    outline: 'none',
  },
  // Table Card
  tableCard: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  tableCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
  },
  tableCardTitle: {
    fontWeight: 700,
    fontSize: '15px',
    color: '#111827',
  },
  tableCardCount: {
    fontSize: '13px',
    color: '#6b7280',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    color: '#111827',
  },
  th: {
    padding: '11px 14px',
    fontWeight: 600,
    color: '#374151',
    fontSize: '12px',
    borderBottom: '1px solid #e5e7eb',
    textAlign: 'left',
    background: '#f9fafb',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '11px 14px',
    color: '#374151',
    fontSize: '13px',
    verticalAlign: 'middle',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '16px',
    borderTop: '1px solid #f3f4f6',
  },
  pageInfo: {
    fontSize: '14px',
    color: '#6b7280',
  },
  centered: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280',
    fontSize: '15px',
  },
  errorBox: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '16px 20px',
    fontSize: '14px',
    border: '1px solid #fecaca',
  },
  badgeAtrasado: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
    background: '#fee2e2',
    color: '#991b1b',
  },
  // Buttons
  btnPrimary: {
    padding: '9px 18px',
    background: '#1e3a5f',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnOutline: {
    padding: '8px 14px',
    background: 'transparent',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnOutlineActive: {
    background: '#eff6ff',
    borderColor: '#2563eb',
    color: '#2563eb',
  },
  btnSecondary: {
    padding: '8px 16px',
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '8px 16px',
    background: 'transparent',
    color: '#6b7280',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnLink: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '2px 4px',
    textDecoration: 'underline',
  },
  btnReceber: {
    padding: '5px 12px',
    background: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    fontSize: '15px',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: '4px',
    lineHeight: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: '4px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
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
    fontSize: '13px',
    cursor: 'pointer',
    color: '#374151',
  },
  // Form inputs
  select: {
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#374151',
    background: '#ffffff',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#374151',
    background: '#ffffff',
    boxSizing: 'border-box',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
  },
  formGroup: {
    marginBottom: '16px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '0',
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalBox: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    width: '100%',
    maxWidth: '520px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  modalTitle: {
    margin: '0 0 24px 0',
    fontSize: '20px',
    fontWeight: 700,
    color: '#111827',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },
  // Footer
  footer: {
    background: '#1e293b',
    color: '#94a3b8',
    textAlign: 'center',
    padding: '14px',
    fontSize: '13px',
    letterSpacing: '0.01em',
  },
};
