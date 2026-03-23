import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FileText } from 'lucide-react';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { contasPagarService } from '../services/contasPagar.service.js';

const STATUS_LABELS = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
  estornado: 'Estornado',
  falhou: 'Falhou',
};

const STATUS_COLORS = {
  pendente: { background: '#fef9c3', color: '#854d0e' },
  pago: { background: '#dcfce7', color: '#166534' },
  cancelado: { background: '#f3f4f6', color: '#6b7280' },
  estornado: { background: '#ffedd5', color: '#9a3412' },
  falhou: { background: '#fee2e2', color: '#991b1b' },
};

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

const EMPTY_FORM = {
  descricao: '',
  valor: '',
  data_vencimento: '',
  categoria_id: '',
  conta_id: '',
  observacoes: '',
};

export default function ContasPagarPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filtros, setFiltros] = useState({
    status: '',
    data_vencimento_de: '',
    data_vencimento_ate: '',
  });
  const [filtrosAtivos, setFiltrosAtivos] = useState({});

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalAberto, setModalAberto] = useState(false);
  const [contaEmEdicao, setContaEmEdicao] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [salvando, setSalvando] = useState(false);

  const carregarLista = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20, ...filtrosAtivos };
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] === null || params[k] === undefined) delete params[k];
      });
      const result = await contasPagarService.listar(params);
      setLista(result.data);
      setTotalPages(result.totalPages);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao carregar contas a pagar.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, filtrosAtivos]);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

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
    setFiltros({ status: '', data_vencimento_de: '', data_vencimento_ate: '' });
    setFiltrosAtivos({});
    setPage(1);
  }

  function abrirModalNovo() {
    setContaEmEdicao(null);
    setForm(EMPTY_FORM);
    setModalAberto(true);
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
      categoria_id: conta.categoria_id || '',
      conta_id: conta.conta_id || '',
      observacoes: conta.observacoes || '',
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setContaEmEdicao(null);
    setForm(EMPTY_FORM);
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
        conta_id: form.conta_id || null,
        observacoes: form.observacoes || null,
      };

      if (contaEmEdicao) {
        await contasPagarService.atualizar(contaEmEdicao.id, payload);
        toast.success('Conta atualizada com sucesso!');
      } else {
        await contasPagarService.criar(payload);
        toast.success('Conta criada com sucesso!');
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
      await contasPagarService.excluir(conta.id);
      toast.success('Conta excluída com sucesso!');
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao excluir conta.';
      toast.error(msg);
    }
  }

  return (
    <div style={s.pageWrapper}>
      <div style={s.page}>
        <AppSidebar
          sidebarOpen={sidebarOpen}
          isExpanded={sidebarExpanded}
          currentPath="/contas-pagar"
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
              <div style={s.pageTitleIcon} aria-hidden="true">
                <FileText size={32} color="#4b5563" strokeWidth={1.5} />
              </div>
              <div>
                <div style={s.pageTitleRow}>
                  <h1 style={s.pageTitle}>Contas a Pagar</h1>
                </div>
                <p style={s.pageSubtitle}>Gerencie suas contas a pagar</p>
              </div>
            </div>
            <div style={s.topBarRight}>
              <button style={s.btnPrimary} onClick={abrirModalNovo}>
                + Nova Conta
              </button>
            </div>
          </div>

          {/* Content */}
          <InadimplenteGuard>
            <div style={s.content}>
              {/* Filtros */}
              <form style={s.filtersBar} onSubmit={handleFiltrar}>
                <select
                  name="status"
                  value={filtros.status}
                  onChange={handleFiltroChange}
                  style={s.select}
                >
                  <option value="">Todos os status</option>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="estornado">Estornado</option>
                  <option value="falhou">Falhou</option>
                </select>
                <input
                  type="date"
                  name="data_vencimento_de"
                  value={filtros.data_vencimento_de}
                  onChange={handleFiltroChange}
                  style={s.input}
                  placeholder="Vencimento de"
                />
                <input
                  type="date"
                  name="data_vencimento_ate"
                  value={filtros.data_vencimento_ate}
                  onChange={handleFiltroChange}
                  style={s.input}
                  placeholder="Vencimento até"
                />
                <button type="submit" style={s.btnSecondary}>
                  Filtrar
                </button>
                <button type="button" style={s.btnGhost} onClick={handleLimpar}>
                  Limpar
                </button>
              </form>

              {/* Tabela */}
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
                        <th style={s.th}>Descrição</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Valor</th>
                        <th style={s.th}>Vencimento</th>
                        <th style={s.th}>Status</th>
                        <th style={s.th}>Categoria</th>
                        <th style={{ ...s.th, textAlign: 'center' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((conta) => (
                        <tr key={conta.id} style={s.tr}>
                          <td style={s.td}>{conta.descricao}</td>
                          <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatBRL(conta.valor)}
                          </td>
                          <td style={s.td}>{formatDate(conta.data_vencimento)}</td>
                          <td style={s.td}>
                            <StatusBadge status={conta.status} />
                          </td>
                          <td style={s.td}>{conta.categoria?.nome || '-'}</td>
                          <td style={{ ...s.td, textAlign: 'center' }}>
                            <button
                              style={s.btnLink}
                              onClick={() => abrirModalEdicao(conta)}
                              disabled={conta.status === 'pago'}
                              title={conta.status === 'pago' ? 'Conta paga não pode ser editada' : 'Editar'}
                            >
                              Editar
                            </button>
                            {' | '}
                            <button
                              style={{ ...s.btnLink, color: '#dc2626' }}
                              onClick={() => handleExcluir(conta)}
                              disabled={conta.status === 'pago'}
                              title={conta.status === 'pago' ? 'Conta paga não pode ser excluída' : 'Excluir'}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
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
                    Página {page} de {totalPages}
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
          </InadimplenteGuard>
        </div>
      </div>

      {/* Modal */}
      {modalAberto && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true" aria-label="Formulário de conta a pagar">
          <div style={s.modalBox}>
            <h2 style={s.modalTitle}>
              {contaEmEdicao ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
            </h2>
            <form onSubmit={handleSalvar}>
              <div style={s.formGroup}>
                <label style={s.label}>Descrição *</label>
                <input
                  name="descricao"
                  value={form.descricao}
                  onChange={handleFormChange}
                  style={s.input}
                  maxLength={255}
                  required
                  placeholder="Ex: Aluguel escritório"
                />
              </div>
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
                  />
                </div>
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Observações</label>
                <textarea
                  name="observacoes"
                  value={form.observacoes}
                  onChange={handleFormChange}
                  style={{ ...s.input, height: '80px', resize: 'vertical' }}
                  maxLength={1000}
                  placeholder="Observações opcionais..."
                />
              </div>
              <div style={s.modalActions}>
                <button type="button" style={s.btnGhost} onClick={fecharModal} disabled={salvando}>
                  Cancelar
                </button>
                <button type="submit" style={s.btnPrimary} disabled={salvando}>
                  {salvando ? 'Salvando...' : contaEmEdicao ? 'Salvar Alterações' : 'Criar Conta'}
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
  },
  page: {
    display: 'flex',
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
    padding: '20px 32px',
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
    gap: '12px',
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
  pageTitleIcon: {
    display: 'flex',
    alignItems: 'center',
  },
  pageTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pageTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
  },
  pageSubtitle: {
    margin: '2px 0 0 0',
    fontSize: '14px',
    color: '#6b7280',
  },
  content: {
    padding: '24px 32px',
    flex: 1,
  },
  filtersBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap',
    background: '#ffffff',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  tableWrapper: {
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    color: '#111827',
  },
  th: {
    padding: '12px 16px',
    fontWeight: 600,
    color: '#374151',
    fontSize: '13px',
    borderBottom: '1px solid #e5e7eb',
    textAlign: 'left',
    background: '#f9fafb',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '12px 16px',
    color: '#374151',
    fontSize: '14px',
    verticalAlign: 'middle',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '24px',
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
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  errorBox: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '14px',
    border: '1px solid #fecaca',
  },
  // Buttons
  btnPrimary: {
    padding: '10px 20px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
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
};
