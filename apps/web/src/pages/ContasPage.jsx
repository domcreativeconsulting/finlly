import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { contasService } from '../services/contas.service.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCreditCard, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';

const DEFAULT_COLOR = '#33528a';

const TIPO_CONTA_LABELS = {
  corrente: 'Corrente',
  poupanca: 'Poupança',
  investimento: 'Investimento',
  cartao_credito: 'Cartão de Crédito',
  dinheiro: 'Dinheiro',
  outro: 'Outro',
};

const TIPO_CONTA_OPCOES = Object.entries(TIPO_CONTA_LABELS).map(([value, label]) => ({ value, label }));

const STATUS_LABELS = {
  ativa: 'Ativa',
  inativa: 'Inativa',
};

const STATUS_COLORS = {
  ativa: { background: '#dcfce7', color: '#166534' },
  inativa: { background: '#f3f4f6', color: '#6b7280' },
};

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
}

function StatusBadge({ status }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.inativa;
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
  nome: '',
  tipo: 'corrente',
  cor: DEFAULT_COLOR,
  icone: '',
  incluir_total: true,
  status: 'ativa',
};

export default function ContasPage() {
  const [sidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filtroStatus, setFiltroStatus] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [contaEmEdicao, setContaEmEdicao] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [salvando, setSalvando] = useState(false);

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [contaParaExcluir, setContaParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregarLista = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filtroStatus) params.status = filtroStatus;
      const result = await contasService.listar(params);
      setLista(Array.isArray(result) ? result : []);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao carregar carteiras.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  function abrirModalNovo() {
    setContaEmEdicao(null);
    setForm(EMPTY_FORM);
    setModalAberto(true);
  }

  function abrirModalEdicao(conta) {
    setContaEmEdicao(conta);
    setForm({
      nome: conta.nome || '',
      tipo: conta.tipo || 'corrente',
      cor: conta.cor || DEFAULT_COLOR,
      icone: conta.icone || '',
      incluir_total: conta.incluir_total !== false,
      status: conta.status || 'ativa',
    });
    setModalAberto(true);
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
      const payload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        cor: form.cor || null,
        icone: form.icone.trim() || null,
        incluir_total: form.incluir_total,
      };

      if (contaEmEdicao) {
        const updatePayload = { ...payload, status: form.status };
        await contasService.atualizar(contaEmEdicao.id, updatePayload);
        toast.success('Carteira atualizada com sucesso!');
      } else {
        await contasService.criar(payload);
        toast.success('Carteira criada com sucesso!');
      }

      fecharModal();
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao salvar carteira.';
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  function abrirModalExcluir(conta) {
    setContaParaExcluir(conta);
    setModalExcluirAberto(true);
  }

  function fecharModalExcluir() {
    setModalExcluirAberto(false);
    setContaParaExcluir(null);
  }

  async function handleExcluir() {
    if (!contaParaExcluir) return;
    setExcluindo(true);
    try {
      await contasService.excluir(contaParaExcluir.id);
      toast.success('Carteira excluída com sucesso!');
      fecharModalExcluir();
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao excluir carteira.';
      toast.error(msg);
    } finally {
      setExcluindo(false);
    }
  }

  const saldoTotal = lista
    .filter((c) => c.incluir_total && c.status === 'ativa')
    .reduce((acc, c) => acc + (c.saldo ?? 0), 0);

  const contentMarginLeft = sidebarExpanded ? '236px' : '108px';

  return (
    <InadimplenteGuard>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f4f8' }}>
        <AppSidebar
          sidebarOpen={sidebarOpen}
          currentPath="/contas"
          isExpanded={sidebarExpanded}
          onHoverChange={setSidebarExpanded}
        />

        <main
          style={{
            flex: 1,
            marginLeft: contentMarginLeft,
            transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: '32px 32px 32px 24px',
            minHeight: '100vh',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
                Carteiras
              </h1>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
                Gerencie suas contas financeiras
              </p>
            </div>
            <button
              onClick={abrirModalNovo}
              style={{
                background: '#33528a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Nova Carteira
            </button>
          </div>

          {/* Saldo total card */}
          <div
            style={{
              background: '#33528a',
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '20px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: '13px', opacity: 0.8 }}>Saldo Total (contas ativas)</p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: saldoTotal >= 0 ? '#86efac' : '#fca5a5',
                }}
              >
                {formatBRL(saldoTotal)}
              </p>
            </div>
            <div style={{ opacity: 0.7, fontSize: '13px' }}>
              {lista.filter((c) => c.status === 'ativa').length} conta(s) ativa(s)
            </div>
          </div>

          {/* Filtro de status */}
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                style={inputStyle}
              >
                <option value="">Todos</option>
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
              </select>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div
              style={{
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                padding: '40px',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              Carregando...
            </div>
          ) : error ? (
            <div
              style={{
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                padding: '40px',
                textAlign: 'center',
                color: '#991b1b',
              }}
            >
              {error}
            </div>
          ) : lista.length === 0 ? (
            <div
              style={{
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                padding: '60px 40px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}><FontAwesomeIcon icon={faCreditCard} /></div>
              <p style={{ color: '#1e293b', fontWeight: 600, fontSize: '16px', margin: '0 0 8px' }}>
                Nenhuma carteira encontrada
              </p>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px' }}>
                Crie sua primeira carteira para controlar seu saldo.
              </p>
              <button onClick={abrirModalNovo} style={btnPrimary}>
                + Criar primeira carteira
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              {lista.map((conta) => (
                <div
                  key={conta.id}
                  style={{
                    background: '#fff',
                    borderRadius: '14px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    borderTop: `4px solid ${conta.cor || DEFAULT_COLOR}`,
                  }}
                >
                  {/* Card header */}
                  <div style={{ padding: '16px 16px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: conta.cor || DEFAULT_COLOR,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          flexShrink: 0,
                          color: '#fff',
                        }}
                      >
                        {conta.icone ? conta.icone : <FontAwesomeIcon icon={faCreditCard} />}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            fontSize: '15px',
                            color: '#1e293b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {conta.nome}
                        </p>
                      </div>
                    </div>

                    {/* Type badge + status badge row */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: '#e0f2fe',
                          color: '#0369a1',
                        }}
                      >
                        {TIPO_CONTA_LABELS[conta.tipo] || conta.tipo}
                      </span>
                      <StatusBadge status={conta.status} />
                      {conta.incluir_total && (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#f0fdf4',
                            color: '#166534',
                          }}
                        >
                          <FontAwesomeIcon icon={faCheck} /> No total
                        </span>
                      )}
                    </div>

                    {/* Balance */}
                    <p
                      style={{
                        margin: 0,
                        fontSize: '22px',
                        fontWeight: 700,
                        color: (conta.saldo ?? 0) >= 0 ? '#166534' : '#991b1b',
                      }}
                    >
                      {formatBRL(conta.saldo)}
                    </p>
                  </div>

                  {/* Card footer with actions */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      padding: '10px 16px',
                      borderTop: '1px solid #f1f5f9',
                      background: '#f8fafc',
                    }}
                  >
                    <button
                      onClick={() => abrirModalEdicao(conta)}
                      style={{ ...btnActionEdit, flex: 1 }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => abrirModalExcluir(conta)}
                      style={{ ...btnActionDelete, flex: 1 }}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Modal criar/editar */}
        {modalAberto && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                }}
              >
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                  {contaEmEdicao ? 'Editar Carteira' : 'Nova Carteira'}
                </h2>
                <button onClick={fecharModal} style={btnClose}>
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
              <form onSubmit={handleSalvar}>
                <div style={formGroup}>
                  <label style={labelStyle}>Nome *</label>
                  <input
                    type="text"
                    name="nome"
                    value={form.nome}
                    onChange={handleFormChange}
                    required
                    style={inputStyle}
                    placeholder="Ex: Conta Corrente Itaú"
                  />
                </div>
                <div style={formGroup}>
                  <label style={labelStyle}>Tipo *</label>
                  <select
                    name="tipo"
                    value={form.tipo}
                    onChange={handleFormChange}
                    required
                    style={inputStyle}
                  >
                    {TIPO_CONTA_OPCOES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={formGroup}>
                  <label style={labelStyle}>Cor (opcional)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      name="cor"
                      value={form.cor || DEFAULT_COLOR}
                      onChange={handleFormChange}
                      style={{ width: '40px', height: '36px', padding: '2px', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      name="cor"
                      value={form.cor || ''}
                      onChange={handleFormChange}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="#33528a"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div style={formGroup}>
                  <label style={labelStyle}>Ícone (opcional)</label>
                  <input
                    type="text"
                    name="icone"
                    value={form.icone}
                    onChange={handleFormChange}
                    style={inputStyle}
                    placeholder="Ex: 🏦"
                    maxLength={50}
                  />
                </div>
                <div style={{ ...formGroup, flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="incluir_total"
                    name="incluir_total"
                    checked={form.incluir_total}
                    onChange={handleFormChange}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="incluir_total" style={{ ...labelStyle, cursor: 'pointer' }}>
                    Incluir no saldo total
                  </label>
                </div>
                {contaEmEdicao && (
                  <div style={formGroup}>
                    <label style={labelStyle}>Status</label>
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleFormChange}
                      style={inputStyle}
                    >
                      <option value="ativa">Ativa</option>
                      <option value="inativa">Inativa</option>
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button type="button" onClick={fecharModal} style={btnSecondary}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={salvando} style={btnPrimary}>
                    {salvando ? 'Salvando...' : contaEmEdicao ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal excluir */}
        {modalExcluirAberto && contaParaExcluir && (
          <div style={overlayStyle}>
            <div style={{ ...modalStyle, maxWidth: '420px' }}>
              <h2 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Excluir Carteira
              </h2>
              <p style={{ color: '#475569', marginBottom: '8px' }}>
                Tem certeza que deseja excluir a carteira{' '}
                <strong>{contaParaExcluir.nome}</strong>?
              </p>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
                Caso a carteira possua movimentações, não será possível excluí-la. Inative-a em vez disso.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={fecharModalExcluir} style={btnSecondary}>
                  Cancelar
                </button>
                <button
                  onClick={handleExcluir}
                  disabled={excluindo}
                  style={{ ...btnPrimary, background: '#dc2626' }}
                >
                  {excluindo ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </InadimplenteGuard>
  );
}

const inputStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '14px',
  color: '#1e293b',
  background: '#fff',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};


const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
};

const modalStyle = {
  background: '#fff',
  borderRadius: '16px',
  padding: '28px',
  width: '100%',
  maxWidth: '520px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};

const formGroup = { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' };
const labelStyle = { fontSize: '13px', fontWeight: 600, color: '#475569' };

const btnPrimary = {
  background: '#33528a',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSecondary = {
  background: '#f1f5f9',
  color: '#475569',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnClose = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '18px',
  color: '#94a3b8',
  padding: '4px',
};

const btnActionEdit = {
  background: '#e0f2fe',
  color: '#0369a1',
  border: 'none',
  borderRadius: '6px',
  padding: '5px 12px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnActionDelete = {
  background: '#fee2e2',
  color: '#991b1b',
  border: 'none',
  borderRadius: '6px',
  padding: '5px 12px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
