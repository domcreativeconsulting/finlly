import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { extratoService } from '../services/extrato.service.js';
import { contasService } from '../services/contas.service.js';
import { cashMovementsService } from '../services/cashMovements.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faInbox,
  faArrowTrendUp,
  faArrowTrendDown,
  faScaleBalanced,
  faCreditCard,
  faCircleUser,
  faDoorOpen,
  faFileExport,
  faFilePdf,
} from '@fortawesome/free-solid-svg-icons';
import { Button, Badge } from '../design-system/index.js';
import { colors, typography, radius, shadows } from '../design-system/tokens.js';
import { downloadBlob } from '../utils/downloadBlob.js';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const datePart = String(dateStr).substring(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return '-';
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}

function firstDayOfMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayISO() {
  return new Date().toISOString().substring(0, 10);
}

const ORIGIN_LABELS = {
  ACCOUNTS_PAYABLE: 'Conta a pagar',
  ACCOUNTS_RECEIVABLE: 'Conta a receber',
  MANUAL: 'Manual',
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

export default function ExtratoPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState({ totalIn: 0, totalOut: 0, balanceDelta: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [accountId, setAccountId] = useState('');

  const [contas, setContas] = useState([]);

  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: firstDayOfMonth(),
    dateTo: todayISO(),
    accountId: '',
  });

  const [showModalManual, setShowModalManual] = useState(false);
  const [formManual, setFormManual] = useState({ type: 'IN', accountId: '', amount: '', date: todayISO(), description: '', notes: '' });
  const [savingManual, setSavingManual] = useState(false);
  const [exportandoCSV, setExportandoCSV] = useState(false);
  const [exportandoPDF, setExportandoPDF] = useState(false);

  useEffect(() => {
    contasService
      .listar()
      .then((data) => {
        setContas(Array.isArray(data) ? data : (data?.data ?? []));
      })
      .catch(() => {});
  }, []);

  const carregarExtrato = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        perPage: 20,
        sortBy: sortField,
        sortOrder: sortDir,
        ...(appliedFilters.dateFrom && { dateFrom: appliedFilters.dateFrom }),
        ...(appliedFilters.dateTo && { dateTo: appliedFilters.dateTo }),
        ...(appliedFilters.accountId && { accountId: appliedFilters.accountId }),
      };
      const result = await extratoService.listar(params);
      setItems(result.items ?? []);
      setTotals(result.totals ?? { totalIn: 0, totalOut: 0, balanceDelta: 0 });
      setPage(result.page ?? 1);
      setTotalPages(result.totalPages ?? 1);
      setTotal(result.total ?? 0);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erro ao carregar extrato.');
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortDir, appliedFilters]);

  useEffect(() => {
    carregarExtrato();
  }, [carregarExtrato]);

  async function handleSubmitManual(e) {
    e.preventDefault();
    setSavingManual(true);
    try {
      await cashMovementsService.criarManual({
        accountId: formManual.accountId,
        type: formManual.type,
        amount: parseFloat(formManual.amount),
        date: formManual.date,
        description: formManual.description,
        ...(formManual.notes ? { notes: formManual.notes } : {}),
      });
      setShowModalManual(false);
      setFormManual({ type: 'IN', accountId: '', amount: '', date: todayISO(), description: '', notes: '' });
      toast.success('Lançamento registrado com sucesso!');
      carregarExtrato();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao criar lançamento.');
    } finally {
      setSavingManual(false);
    }
  }

  function handleFiltrar() {
    setPage(1);
    setAppliedFilters({ dateFrom, dateTo, accountId });
  }

  async function handleExportarCSV() {
    setExportandoCSV(true);
    try {
      const params = { format: 'csv' };
      if (appliedFilters.dateFrom) params.dateFrom = appliedFilters.dateFrom;
      if (appliedFilters.dateTo) params.dateTo = appliedFilters.dateTo;
      if (appliedFilters.accountId) params.accountId = appliedFilters.accountId;
      const blob = await extratoService.exportar(params);
      const from = appliedFilters.dateFrom || new Date().toISOString().substring(0, 10);
      const to = appliedFilters.dateTo || new Date().toISOString().substring(0, 10);
      downloadBlob(blob, `extrato-${from}_a_${to}.csv`);
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
      const params = { format: 'pdf' };
      if (appliedFilters.dateFrom) params.dateFrom = appliedFilters.dateFrom;
      if (appliedFilters.dateTo) params.dateTo = appliedFilters.dateTo;
      if (appliedFilters.accountId) params.accountId = appliedFilters.accountId;
      const blob = await extratoService.exportar(params);
      const from = appliedFilters.dateFrom || new Date().toISOString().substring(0, 10);
      const to = appliedFilters.dateTo || new Date().toISOString().substring(0, 10);
      downloadBlob(blob, `extrato-${from}_a_${to}.pdf`);
      toast.success('Exportação PDF concluída!');
    } catch {
      toast.error('Erro ao exportar PDF');
    } finally {
      setExportandoPDF(false);
    }
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

  const balanceDeltaColor =
    totals.balanceDelta > 0
      ? colors.successText
      : totals.balanceDelta < 0
        ? colors.errorText
        : colors.neutral700;

  return (
    <div style={s.pageWrapper}>
      <div style={s.page}>
        <AppSidebar
          sidebarOpen={sidebarOpen}
          isExpanded={sidebarExpanded}
          currentPath="/extrato"
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
                <FontAwesomeIcon icon={faBars} />
              </button>
              <div>
                <h1 style={s.pageTitle}>Extrato</h1>
              </div>
              <span style={s.badge}>Movimentações do período</span>
            </div>
            <Button onClick={() => setShowModalManual(true)} style={{ marginLeft: 'auto' }}>
              + Novo lançamento
            </Button>

            {/* Avatar / Dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative', marginLeft: '12px' }}>
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

          {/* Modal lançamento manual */}
          {showModalManual && (
            <div style={s.modalOverlay}>
              <div style={s.modalCard}>
                <h2 style={s.modalTitle}>Novo lançamento manual</h2>
                <form onSubmit={handleSubmitManual}>
                  <div style={s.modalField}>
                    <label style={s.modalLabel}>Tipo *</label>
                    <select
                      style={s.filterInputPlain}
                      value={formManual.type}
                      onChange={(e) => setFormManual((f) => ({ ...f, type: e.target.value }))}
                      required
                    >
                      <option value="IN">Entrada</option>
                      <option value="OUT">Saída</option>
                    </select>
                  </div>
                  <div style={s.modalField}>
                    <label style={s.modalLabel}>Conta *</label>
                    <select
                      style={s.filterInputPlain}
                      value={formManual.accountId}
                      onChange={(e) => setFormManual((f) => ({ ...f, accountId: e.target.value }))}
                      required
                    >
                      <option value="">Selecione uma conta</option>
                      {contas.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div style={s.modalField}>
                    <label style={s.modalLabel}>Valor *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      style={s.filterInputPlain}
                      value={formManual.amount}
                      onChange={(e) => setFormManual((f) => ({ ...f, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div style={s.modalField}>
                    <label style={s.modalLabel}>Data *</label>
                    <input
                      type="date"
                      style={s.filterInputPlain}
                      value={formManual.date}
                      onChange={(e) => setFormManual((f) => ({ ...f, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div style={s.modalField}>
                    <label style={s.modalLabel}>Descrição *</label>
                    <input
                      type="text"
                      style={s.filterInputPlain}
                      value={formManual.description}
                      onChange={(e) => setFormManual((f) => ({ ...f, description: e.target.value }))}
                      required
                    />
                  </div>
                  <div style={s.modalField}>
                    <label style={s.modalLabel}>Observações</label>
                    <textarea
                      style={{ ...s.filterInputPlain, resize: 'vertical', minHeight: '64px' }}
                      value={formManual.notes}
                      onChange={(e) => setFormManual((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                  <div style={s.modalActions}>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowModalManual(false)}
                      disabled={savingManual}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={savingManual}>
                      {savingManual ? 'Salvando...' : 'Confirmar'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Content */}
          <InadimplenteGuard>
            <div style={s.content}>

              {/* Filtros */}
              <div style={s.filterCard}>
                <div style={s.filterRow}>
                  <div style={s.filterField}>
                    <label style={s.filterLabel}>Data inicial</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      style={s.filterInputPlain}
                    />
                  </div>
                  <div style={s.filterField}>
                    <label style={s.filterLabel}>Data final</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      style={s.filterInputPlain}
                    />
                  </div>
                  <div style={s.filterField}>
                    <label style={s.filterLabel}>Conta financeira</label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      style={s.filterInputPlain}
                    >
                      <option value="">Todas as contas</option>
                      {contas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={s.filterField}>
                    <label style={s.filterLabel}>&nbsp;</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button onClick={handleFiltrar}>Filtrar</Button>
                      <Button variant="outline" onClick={handleExportarCSV} disabled={exportandoCSV} title="Exportar CSV">
                        <FontAwesomeIcon icon={faFileExport} style={{ marginRight: '6px' }} />
                        {exportandoCSV ? 'Exportando...' : 'CSV'}
                      </Button>
                      <Button variant="outline" onClick={handleExportarPDF} disabled={exportandoPDF} title="Exportar PDF">
                        <FontAwesomeIcon icon={faFilePdf} style={{ marginRight: '6px' }} />
                        {exportandoPDF ? 'Exportando...' : 'PDF'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Totalizadores */}
              <div style={s.summaryRow}>
                <div style={{ ...s.summaryCard, background: colors.successBg, borderColor: colors.successText + '33' }}>
                  <div style={{ ...s.summaryIcon, color: colors.successText }}>
                    <FontAwesomeIcon icon={faArrowTrendUp} />
                  </div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Total Entradas</div>
                    <div style={{ ...s.summaryValue, color: colors.successText }}>{formatBRL(totals.totalIn)}</div>
                  </div>
                </div>
                <div style={{ ...s.summaryCard, background: colors.errorBg, borderColor: colors.errorText + '33' }}>
                  <div style={{ ...s.summaryIcon, color: colors.errorText }}>
                    <FontAwesomeIcon icon={faArrowTrendDown} />
                  </div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Total Saídas</div>
                    <div style={{ ...s.summaryValue, color: colors.errorText }}>{formatBRL(totals.totalOut)}</div>
                  </div>
                </div>
                <div style={s.summaryCard}>
                  <div style={{ ...s.summaryIcon, color: balanceDeltaColor }}>
                    <FontAwesomeIcon icon={faScaleBalanced} />
                  </div>
                  <div style={s.summaryInfo}>
                    <div style={s.summaryLabel}>Resultado Líquido</div>
                    <div style={{ ...s.summaryValue, color: balanceDeltaColor }}>{formatBRL(totals.balanceDelta)}</div>
                  </div>
                </div>
              </div>

              {/* Tabela */}
              <div style={s.tableCard}>
                <div style={s.tableCardHeader}>
                  <span style={s.tableCardTitle}>Movimentações</span>
                  <span style={s.tableCardCount}>{total} registro{total !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                  <div style={s.centered}>Carregando...</div>
                ) : error ? (
                  <div style={s.errorBox}>{error}</div>
                ) : items.length === 0 ? (
                  <div style={s.centered}>
                    <FontAwesomeIcon icon={faInbox} style={{ fontSize: '32px', display: 'block', margin: '0 auto 12px' }} />
                    Nenhuma movimentação encontrada no período.
                  </div>
                ) : (
                  <div style={s.tableWrapper}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <SortableTh field="date" label="Data" sortField={sortField} sortDir={sortDir} onSort={handleSort} style={s.th} />
                          <SortableTh field="description" label="Descrição" sortField={sortField} sortDir={sortDir} onSort={handleSort} style={s.th} />
                          <th style={s.th}>Conta</th>
                          <th style={s.th}>Origem</th>
                          <th style={s.th}>Tipo</th>
                          <SortableTh field="amount" label="Valor" sortField={sortField} sortDir={sortDir} onSort={handleSort} style={{ ...s.th, textAlign: 'right' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} style={s.tr}>
                            <td style={s.td}>{formatDate(item.date)}</td>
                            <td style={s.td}>{item.description}</td>
                            <td style={s.td}>{item.accountName || '-'}</td>
                            <td style={s.td}>{ORIGIN_LABELS[item.originType] || item.originType || '-'}</td>
                            <td style={s.td}>
                              <Badge variant={item.type === 'IN' ? 'success' : 'error'}>
                                {item.type === 'IN' ? 'Entrada' : 'Saída'}
                              </Badge>
                            </td>
                            <td
                              style={{
                                ...s.td,
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                color: item.type === 'IN' ? colors.successText : colors.errorText,
                                fontWeight: typography.weights.semibold,
                              }}
                            >
                              {formatBRL(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Paginação */}
                    <div style={s.pagination}>
                      <Button
                        variant="secondary"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        Anterior
                      </Button>
                      <span style={s.pageInfo}>
                        Página {page} de {totalPages} · {total} registro{total !== 1 ? 's' : ''}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        Próximo
                      </Button>
                    </div>
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
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: radius.full,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    background: colors.primaryBg,
    color: colors.primary,
  },
  content: {
    padding: '20px 28px',
    flex: 1,
  },
  filterCard: {
    background: colors.white,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.md,
    padding: '16px 20px',
    marginBottom: '20px',
  },
  filterRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
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
    marginBottom: '4px',
    whiteSpace: 'nowrap',
  },
  summaryValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral900,
    whiteSpace: 'nowrap',
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
  footer: {
    background: colors.neutral800,
    color: colors.neutral400,
    textAlign: 'center',
    padding: '14px',
    fontSize: typography.sizes.base,
    letterSpacing: '0.01em',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    background: colors.white,
    borderRadius: radius.lg,
    boxShadow: shadows.md,
    padding: '28px 32px',
    width: '100%',
    maxWidth: '440px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  modalTitle: {
    margin: '0 0 16px',
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral900,
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '12px',
  },
  modalLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral500,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '8px',
  },
};
