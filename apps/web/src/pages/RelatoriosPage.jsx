import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { dashboardService } from '../services/dashboard.service.js';
import { categoriasService } from '../services/categorias.service.js';
import { contasService } from '../services/contas.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faCircleUser,
  faDoorOpen,
  faFileExport,
  faFilter,
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '../design-system/index.js';
import { colors, typography, radius, shadows } from '../design-system/tokens.js';
import api from '../services/api.js';

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

function lastDayOfMonth() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

const TIPO_LABELS = { entrada: 'Entrada', saida: 'Saída', transferencia: 'Transferência' };
const TIPO_COLORS = {
  entrada: { bg: colors.successBg, color: colors.successText },
  saida: { bg: colors.errorBg, color: colors.errorText },
  transferencia: { bg: '#e0f2fe', color: '#0369a1' },
};

export default function RelatoriosPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const [dataInicio, setDataInicio] = useState(firstDayOfMonth());
  const [dataFim, setDataFim] = useState(lastDayOfMonth());
  const [categoriaId, setCategoriaId] = useState('');
  const [contaId, setContaId] = useState('');
  const [tipo, setTipo] = useState('');

  const [categorias, setCategorias] = useState([]);
  const [contas, setContas] = useState([]);

  const [relatorio, setRelatorio] = useState({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [page, setPage] = useState(1);

  const contentMarginLeft = !sidebarOpen ? '0px' : sidebarExpanded ? '236px' : '108px';

  // Load selects
  useEffect(() => {
    async function loadSelects() {
      try {
        const [cats, conts] = await Promise.all([
          categoriasService.listar(),
          contasService.listar(),
        ]);
        setCategorias(Array.isArray(cats) ? cats : (cats.data ?? []));
        setContas(Array.isArray(conts) ? conts : (conts.data ?? []));
      } catch {
        // non-critical
      }
    }
    loadSelects();
  }, []);

  const buscar = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      try {
        const params = { page: pageNum, limit: 50 };
        if (dataInicio) params.dataInicio = dataInicio;
        if (dataFim) params.dataFim = dataFim;
        if (categoriaId) params.categoriaId = categoriaId;
        if (contaId) params.contaId = contaId;
        if (tipo) params.tipo = tipo;

        const result = await dashboardService.getRelatorio(params);
        setRelatorio(result);
        setPage(pageNum);
      } catch {
        toast.error('Erro ao buscar relatório');
      } finally {
        setLoading(false);
      }
    },
    [dataInicio, dataFim, categoriaId, contaId, tipo],
  );

  useEffect(() => {
    buscar(1);
  }, [buscar]);

  async function handleExportar() {
    setExportando(true);
    try {
      const params = {};
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      if (categoriaId) params.categoriaId = categoriaId;
      if (contaId) params.contaId = contaId;
      if (tipo) params.tipo = tipo;

      const response = await api.get('/relatorios/exportar', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Relatório exportado com sucesso!');
    } catch {
      toast.error('Erro ao exportar relatório');
    } finally {
      setExportando(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: colors.bg }}>
      <AppSidebar
        sidebarOpen={sidebarOpen}
        currentPath="/relatorios"
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
                Relatórios
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        <InadimplenteGuard>
          <main style={{ flex: 1, padding: '28px 28px 40px' }}>

            {/* Filters */}
            <div
              style={{
                background: colors.white,
                borderRadius: radius.lg,
                boxShadow: shadows.sm,
                padding: '20px 24px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: typography.sizes.xs, color: colors.neutral500, fontWeight: typography.weights.medium }}>Data início</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: radius.md, border: `1px solid ${colors.border}`, fontSize: typography.sizes.sm, color: colors.neutral700 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: typography.sizes.xs, color: colors.neutral500, fontWeight: typography.weights.medium }}>Data fim</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: radius.md, border: `1px solid ${colors.border}`, fontSize: typography.sizes.sm, color: colors.neutral700 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: typography.sizes.xs, color: colors.neutral500, fontWeight: typography.weights.medium }}>Categoria</label>
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: radius.md, border: `1px solid ${colors.border}`, fontSize: typography.sizes.sm, color: colors.neutral700, minWidth: '160px', background: colors.white }}
                  >
                    <option value="">Todas as categorias</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: typography.sizes.xs, color: colors.neutral500, fontWeight: typography.weights.medium }}>Conta</label>
                  <select
                    value={contaId}
                    onChange={(e) => setContaId(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: radius.md, border: `1px solid ${colors.border}`, fontSize: typography.sizes.sm, color: colors.neutral700, minWidth: '140px', background: colors.white }}
                  >
                    <option value="">Todas as contas</option>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: typography.sizes.xs, color: colors.neutral500, fontWeight: typography.weights.medium }}>Tipo</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: radius.md, border: `1px solid ${colors.border}`, fontSize: typography.sizes.sm, color: colors.neutral700, minWidth: '120px', background: colors.white }}
                  >
                    <option value="">Todos</option>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
                  <Button size="sm" onClick={() => buscar(1)} disabled={loading}>
                    <FontAwesomeIcon icon={faFilter} style={{ marginRight: '6px' }} />
                    Filtrar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportar} disabled={exportando || loading}>
                    <FontAwesomeIcon icon={faFileExport} style={{ marginRight: '6px' }} />
                    {exportando ? 'Exportando...' : 'Exportar CSV'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div
              style={{
                background: colors.white,
                borderRadius: radius.lg,
                boxShadow: shadows.sm,
                overflow: 'hidden',
              }}
            >
              {/* Table header info */}
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: typography.sizes.sm, color: colors.neutral600, fontWeight: typography.weights.medium }}>
                  {relatorio.total} registro{relatorio.total !== 1 ? 's' : ''} encontrado{relatorio.total !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: typography.sizes.xs, color: colors.neutral400 }}>
                  Página {relatorio.page} de {relatorio.totalPages || 1}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: colors.neutral50 }}>
                      {['Data', 'Tipo', 'Valor', 'Descrição', 'Categoria', 'Conta'].map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: '10px 16px',
                            textAlign: 'left',
                            fontSize: typography.sizes.xs,
                            fontWeight: typography.weights.semibold,
                            color: colors.neutral500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
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
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 6 }).map((__, j) => (
                            <td key={j} style={{ padding: '12px 16px' }}>
                              <div style={{ height: '16px', background: colors.neutral100, borderRadius: radius.sm }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : relatorio.data.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: colors.neutral400, fontSize: typography.sizes.sm }}>
                          Nenhum registro encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      relatorio.data.map((mov) => {
                        const tipoStyle = TIPO_COLORS[mov.tipo] ?? { bg: colors.neutral100, color: colors.neutral600 };
                        return (
                          <tr
                            key={mov.id}
                            style={{ borderBottom: `1px solid ${colors.neutral100}` }}
                          >
                            <td style={{ padding: '12px 16px', fontSize: typography.sizes.sm, color: colors.neutral700, whiteSpace: 'nowrap' }}>
                              {formatDate(mov.data)}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: radius.full,
                                  fontSize: typography.sizes.xs,
                                  fontWeight: typography.weights.semibold,
                                  background: tipoStyle.bg,
                                  color: tipoStyle.color,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {TIPO_LABELS[mov.tipo] ?? mov.tipo}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: mov.tipo === 'entrada' ? colors.success : mov.tipo === 'saida' ? colors.error : colors.neutral700, whiteSpace: 'nowrap' }}>
                              {formatBRL(mov.valor)}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: typography.sizes.sm, color: colors.neutral700, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {mov.descricao || '-'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: typography.sizes.sm, color: colors.neutral600 }}>
                              {mov.categoria?.nome || '-'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: typography.sizes.sm, color: colors.neutral600 }}>
                              {mov.conta?.nome || '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {relatorio.totalPages > 1 && (
                <div
                  style={{
                    padding: '12px 20px',
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <button
                    onClick={() => buscar(page - 1)}
                    disabled={page <= 1 || loading}
                    style={{
                      padding: '6px 14px',
                      borderRadius: radius.md,
                      border: `1px solid ${colors.border}`,
                      background: page <= 1 ? colors.neutral100 : colors.white,
                      color: page <= 1 ? colors.neutral400 : colors.neutral700,
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    ← Anterior
                  </button>
                  <span style={{ fontSize: typography.sizes.sm, color: colors.neutral500 }}>
                    {page} / {relatorio.totalPages}
                  </span>
                  <button
                    onClick={() => buscar(page + 1)}
                    disabled={page >= relatorio.totalPages || loading}
                    style={{
                      padding: '6px 14px',
                      borderRadius: radius.md,
                      border: `1px solid ${colors.border}`,
                      background: page >= relatorio.totalPages ? colors.neutral100 : colors.white,
                      color: page >= relatorio.totalPages ? colors.neutral400 : colors.neutral700,
                      cursor: page >= relatorio.totalPages ? 'not-allowed' : 'pointer',
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    Próximo →
                  </button>
                </div>
              )}
            </div>

          </main>
        </InadimplenteGuard>
      </div>
    </div>
  );
}
