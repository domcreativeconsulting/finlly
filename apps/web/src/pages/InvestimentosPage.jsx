import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { investimentosService } from '../services/investimentos.service.js';
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
} from '@fortawesome/free-solid-svg-icons';
import { Button, Badge, Modal } from '../design-system/index.js';
import { colors, typography, radius, shadows } from '../design-system/tokens.js';

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
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

const TIPO_EVENTO_LABELS = {
  aporte: 'Aporte',
  resgate: 'Resgate',
  rendimento: 'Rendimento',
  taxa: 'Taxa',
  dividendo: 'Dividendo',
};

const STATUS_LABELS = {
  ativa: 'Ativa',
  inativa: 'Inativa',
  arquivada: 'Arquivada',
};

const EMPTY_FORM = {
  nome: '',
  tipoId: '',
  valorInicial: '0',
  dataInicio: todayISO(),
  dataVencimento: '',
  observacoes: '',
  status: 'ativa',
};

function StatusBadge({ status }) {
  const variantMap = { ativa: 'success', inativa: 'neutral', arquivada: 'warning' };
  return (
    <Badge variant={variantMap[status] || 'neutral'}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const [investimentos, setInvestimentos] = useState([]);
  const [tipos, setTipos] = useState([]);
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
  const [formEvento, setFormEvento] = useState({ tipo: 'aporte', valor: '', data: todayISO(), descricao: '' });
  const [savingEvento, setSavingEvento] = useState(false);

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
      setError(err?.response?.data?.message || 'Erro ao carregar investimentos.');
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

  useEffect(() => {
    carregarInvestimentos();
  }, [carregarInvestimentos]);

  useEffect(() => {
    carregarTipos();
  }, [carregarTipos]);

  function abrirModal(investimento = null) {
    setInvestimentoEmEdicao(investimento);
    if (investimento) {
      setForm({
        nome: investimento.nome || '',
        tipoId: investimento.tipoId || '',
        valorInicial: String(investimento.valorInicial ?? 0),
        dataInicio: investimento.dataInicio || todayISO(),
        dataVencimento: investimento.dataVencimento || '',
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
        nome: form.nome,
        tipoId: form.tipoId,
        valorInicial: parseFloat(form.valorInicial) || 0,
        dataInicio: form.dataInicio,
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
      toast.error(err?.response?.data?.message || 'Erro ao salvar investimento.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(id) {
    if (!window.confirm('Deseja excluir este investimento? Esta ação não pode ser desfeita.')) return;
    try {
      await investimentosService.excluir(id);
      toast.success('Investimento excluído.');
      carregarInvestimentos();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir investimento.');
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
    setFormEvento({ tipo: 'aporte', valor: '', data: todayISO(), descricao: '' });
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
      setFormEvento({ tipo: 'aporte', valor: '', data: todayISO(), descricao: '' });
      await carregarEventos(investimentoSelecionado.id);
      const result = await investimentosService.getPosicao(investimentoSelecionado.id);
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
      await investimentosService.excluirEvento(investimentoSelecionado.id, eventoId);
      toast.success('Evento excluído.');
      await carregarEventos(investimentoSelecionado.id);
      const result = await investimentosService.getPosicao(investimentoSelecionado.id);
      setPosicao(result.posicao);
      carregarInvestimentos();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir evento.');
    }
  }

  const saldoColor = (val) => {
    if (val > 0) return colors.success?.[600] ?? '#16a34a';
    if (val < 0) return colors.danger?.[600] ?? '#dc2626';
    return colors.neutral?.[600] ?? '#6b7280';
  };

  return (
    <InadimplenteGuard>
      <div style={{ display: 'flex', minHeight: '100vh', background: colors.neutral?.[50] ?? '#f9fafb' }}>
        <AppSidebar
          sidebarOpen={sidebarOpen}
          currentPath="/investimentos"
          isExpanded={sidebarExpanded}
          onHoverChange={setSidebarExpanded}
        />
        <main
          style={{
            flex: 1,
            marginLeft: !sidebarOpen ? '0px' : sidebarExpanded ? '236px' : '108px',
            transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: '32px 24px',
            fontFamily: typography.fontFamily,
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FontAwesomeIcon icon={faChartLine} style={{ fontSize: 22, color: colors.primary?.[600] ?? '#2563eb' }} />
              <h1 style={{ margin: 0, fontSize: typography.fontSize?.['2xl'] ?? 24, fontWeight: 700 }}>
                Investimentos
              </h1>
              <Badge variant="info">Portfólio</Badge>
            </div>
            <Button variant="primary" onClick={() => abrirModal()}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
              Novo investimento
            </Button>
          </div>

          {/* Loading / Error / Empty */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 48, color: colors.neutral?.[500] ?? '#6b7280' }}>
              Carregando...
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: 48, color: colors.danger?.[600] ?? '#dc2626' }}>
              {error}
            </div>
          )}

          {!loading && !error && investimentos.length === 0 && (
            <div style={{ textAlign: 'center', padding: 64, color: colors.neutral?.[400] ?? '#9ca3af' }}>
              <FontAwesomeIcon icon={faInbox} style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
              <p style={{ margin: 0 }}>Nenhum investimento encontrado. Crie o primeiro!</p>
            </div>
          )}

          {/* Table */}
          {!loading && !error && investimentos.length > 0 && (
            <div
              style={{
                background: '#fff',
                borderRadius: radius.lg ?? 12,
                boxShadow: shadows.sm,
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: colors.neutral?.[100] ?? '#f3f4f6' }}>
                    {['Nome', 'Tipo', 'Status', 'Valor Inicial', 'Data Início', 'Saldo Atual', 'Ações'].map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: colors.neutral?.[700] ?? '#374151',
                          borderBottom: `1px solid ${colors.neutral?.[200] ?? '#e5e7eb'}`,
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {investimentos.map((inv, idx) => (
                    <tr
                      key={inv.id}
                      style={{
                        background: idx % 2 === 0 ? '#fff' : colors.neutral?.[50] ?? '#f9fafb',
                        borderBottom: `1px solid ${colors.neutral?.[100] ?? '#f3f4f6'}`,
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{inv.nome}</td>
                      <td style={{ padding: '10px 14px', color: colors.neutral?.[600] ?? '#4b5563' }}>
                        {inv.tipoNome || '-'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <StatusBadge status={inv.status} />
                      </td>
                      <td style={{ padding: '10px 14px' }}>{formatBRL(inv.valorInicial)}</td>
                      <td style={{ padding: '10px 14px' }}>{formatDate(inv.dataInicio)}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                        {posicoes[inv.id] !== undefined
                          ? <span style={{ color: saldoColor(posicoes[inv.id].saldoAtual) }}>{formatBRL(posicoes[inv.id].saldoAtual)}</span>
                          : '-'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            title="Ver eventos / posição"
                            onClick={() => abrirEventos(inv)}
                            style={iconBtn}
                          >
                            <FontAwesomeIcon icon={faBars} />
                          </button>
                          <button
                            title="Editar"
                            onClick={() => abrirModal(inv)}
                            style={iconBtn}
                          >
                            <FontAwesomeIcon icon={faPenToSquare} />
                          </button>
                          <button
                            title="Excluir"
                            onClick={() => handleExcluir(inv.id)}
                            style={{ ...iconBtn, color: colors.danger?.[600] ?? '#dc2626' }}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                Anterior
              </Button>
              <span style={{ alignSelf: 'center', fontSize: 14, color: colors.neutral?.[600] ?? '#4b5563' }}>
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
        </main>
      </div>

      {/* Modal criar/editar investimento */}
      <Modal open={modalAberto} onClose={fecharModal} title={investimentoEmEdicao ? 'Editar Investimento' : 'Novo Investimento'}>
        <form onSubmit={handleSalvar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Nome *</label>
            <input
              style={inputStyle}
              type="text"
              required
              maxLength={255}
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Tipo *</label>
            <select
              style={inputStyle}
              required
              value={form.tipoId}
              onChange={(e) => setForm((f) => ({ ...f, tipoId: e.target.value }))}
            >
              <option value="">Selecione um tipo...</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Valor Inicial</label>
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              value={form.valorInicial}
              onChange={(e) => setForm((f) => ({ ...f, valorInicial: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Data de Início *</label>
            <input
              style={inputStyle}
              type="date"
              required
              value={form.dataInicio}
              onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Data de Vencimento</label>
            <input
              style={inputStyle}
              type="date"
              value={form.dataVencimento}
              onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              maxLength={1000}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
          {investimentoEmEdicao && (
            <div>
              <label style={labelStyle}>Status</label>
              <select
                style={inputStyle}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
                <option value="arquivada">Arquivada</option>
              </select>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <Button type="button" variant="secondary" onClick={fecharModal} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}> 
              {saving ? 'Salvando...' : 'Confirmar'}
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
                background: colors.neutral?.[50] ?? '#f9fafb',
                borderRadius: radius.md ?? 8,
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px 16px',
              }}
            >
              <PosicaoItem label="Total Aportado" valor={posicao.totalAportado} icon={faArrowTrendUp} positive />
              <PosicaoItem label="Total Resgatado" valor={posicao.totalResgatado} icon={faArrowTrendDown} negative />
              <PosicaoItem label="Total Rendimentos" valor={posicao.totalRendimentos} icon={faArrowTrendUp} positive />
              <PosicaoItem label="Total Taxas" valor={posicao.totalTaxas} icon={faArrowTrendDown} negative />
              <PosicaoItem label="Total Dividendos" valor={posicao.totalDividendos} icon={faMoneyBillWave} positive />
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0 0',
                  borderTop: `1px solid ${colors.neutral?.[200] ?? '#e5e7eb'}`,
                  marginTop: 4,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 15 }}>Saldo Atual</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: saldoColor(posicao.saldoAtual) }}>
                  {formatBRL(posicao.saldoAtual)}
                </span>
              </div>
            </div>
          )}

          {/* Header eventos */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                background: colors.neutral?.[100] ?? '#f3f4f6',
                borderRadius: radius.md ?? 8,
                padding: 16,
              }}
            >
              <form onSubmit={handleCriarEvento} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Tipo *</label>
                    <select
                      style={inputStyle}
                      required
                      value={formEvento.tipo}
                      onChange={(e) => setFormEvento((f) => ({ ...f, tipo: e.target.value }))}
                    >
                      {Object.entries(TIPO_EVENTO_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
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
                      onChange={(e) => setFormEvento((f) => ({ ...f, valor: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Data *</label>
                    <input
                      style={inputStyle}
                      type="date"
                      required
                      value={formEvento.data}
                      onChange={(e) => setFormEvento((f) => ({ ...f, data: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Descrição</label>
                    <input
                      style={inputStyle}
                      type="text"
                      maxLength={500}
                      value={formEvento.descricao}
                      onChange={(e) => setFormEvento((f) => ({ ...f, descricao: e.target.value }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button type="button" variant="secondary" onClick={() => setModalCriarEvento(false)} disabled={savingEvento}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" disabled={savingEvento}>
                    {savingEvento ? 'Salvando...' : 'Registrar'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Tabela eventos */}
          {loadingEventos && (
            <div style={{ textAlign: 'center', padding: 24, color: colors.neutral?.[500] ?? '#6b7280' }}>
              Carregando eventos...
            </div>
          )}
          {!loadingEventos && eventos.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: colors.neutral?.[400] ?? '#9ca3af' }}>
              <FontAwesomeIcon icon={faInbox} style={{ marginRight: 8 }} />
              Nenhum evento registrado.
            </div>
          )}
          {!loadingEventos && eventos.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: colors.neutral?.[100] ?? '#f3f4f6' }}>
                  {['Data', 'Tipo', 'Valor', 'Descrição', ''].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: colors.neutral?.[700] ?? '#374151',
                        borderBottom: `1px solid ${colors.neutral?.[200] ?? '#e5e7eb'}`,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr
                    key={ev.id}
                    style={{ borderBottom: `1px solid ${colors.neutral?.[100] ?? '#f3f4f6'}` }}
                  >
                    <td style={{ padding: '8px 12px' }}>{formatDate(ev.data)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <TipoEventoBadge tipo={ev.tipo} />
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{formatBRL(ev.valor)}</td>
                    <td style={{ padding: '8px 12px', color: colors.neutral?.[600] ?? '#4b5563' }}>
                      {ev.descricao || '-'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        title="Excluir evento"
                        onClick={() => handleExcluirEvento(ev.id)}
                        style={{ ...iconBtn, color: colors.danger?.[600] ?? '#dc2626' }}
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
            <Button variant="secondary" onClick={fecharEventos}>Fechar</Button>
          </div>
        </div>
      </Modal>
    </InadimplenteGuard>
}

function PosicaoItem({ label, valor, icon, positive, negative }) {
  const color = positive
    ? colors.success?.[600] ?? '#16a34a'
    : negative
    ? colors.danger?.[600] ?? '#dc2626'
    : colors.neutral?.[700] ?? '#374151';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: colors.neutral?.[500] ?? '#6b7280', fontWeight: 500 }}>
        <FontAwesomeIcon icon={icon} style={{ marginRight: 4 }} />
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color }}>{formatBRL(valor)}</span>
    </div>
  );
}

const iconBtn = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 6px',
  borderRadius: 4,
  color: colors.neutral?.[600] ?? '#4b5563',
  fontSize: 14,
};

const labelStyle = {
  display: 'block',
  marginBottom: 4,
  fontSize: 13,
  fontWeight: 500,
  color: colors.neutral?.[700] ?? '#374151',
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${colors.neutral?.[300] ?? '#d1d5db'}`,
  fontSize: 14,
  boxSizing: 'border-box',
};