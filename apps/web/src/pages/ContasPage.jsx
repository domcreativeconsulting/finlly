import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { contasService } from '../services/contas.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { useOfflineCache } from '../hooks/useOfflineCache.js';
import { useRequireOnline } from '../hooks/useRequireOnline.js';
import { OfflineDataBadge } from '../components/OfflineDataBadge.jsx';
import { OfflineFallback } from '../components/OfflineFallback.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCreditCard, faCheck, faCircleUser, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import { Button, Input, Select, Modal, Badge, Card } from '../design-system/index.js';
import { colors, typography, radius } from '../design-system/tokens.js';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
}

function StatusBadge({ status }) {
  const variantMap = { ativa: 'success', inativa: 'neutral' };
  return (
    <Badge variant={variantMap[status] || 'neutral'}>
      {STATUS_LABELS[status] || status}
    </Badge>
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
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { saveCache, readCache } = useOfflineCache(usuario?.id);
  const { requireOnline } = useRequireOnline();
  const [sidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);

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
      const data = Array.isArray(result) ? result : [];
      setLista(data);
      saveCache('contas', data);
      setCacheInfo(null);
    } catch (err) {
      if (!isOnline) {
        const cached = readCache('contas');
        if (cached) {
          setLista(cached.data);
          setCacheInfo(cached.savedAt);
          return;
        }
      }
      const msg = err?.response?.data?.message || 'Erro ao carregar carteiras.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, isOnline, saveCache, readCache]);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

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

  const handleSalvar = requireOnline(async function handleSalvar(e) {
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
  });

  function abrirModalExcluir(conta) {
    setContaParaExcluir(conta);
    setModalExcluirAberto(true);
  }

  function fecharModalExcluir() {
    setModalExcluirAberto(false);
    setContaParaExcluir(null);
  }

  const handleExcluir = requireOnline(async function handleExcluir() {
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
  });

  const saldoTotal = lista
    .filter((c) => c.incluir_total && c.status === 'ativa')
    .reduce((acc, c) => acc + (c.saldo ?? 0), 0);

  const shouldShowOfflineFallback = !isOnline && !cacheInfo && lista.length === 0 && !loading;

  const contentMarginLeft = sidebarExpanded ? '236px' : '108px';

  return (
    <InadimplenteGuard>
      <div style={{ display: 'flex', minHeight: '100vh', background: colors.bg }}>
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
              <h1 style={{ margin: 0, fontSize: typography.sizes['5xl'], fontWeight: typography.weights.bold, color: colors.neutral800 }}>
                Carteiras
              </h1>
              <p style={{ margin: '4px 0 0', color: colors.neutral500, fontSize: typography.sizes.md }}>
                Gerencie suas contas financeiras
              </p>
            </div>
            <Button onClick={abrirModalNovo} disabled={!isOnline} title={!isOnline ? 'Disponível apenas online' : undefined}>+ Nova Carteira</Button>

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

          {/* Saldo total card */}
          <div
            style={{
              background: colors.primary,
              borderRadius: radius.lg,
              padding: '20px 24px',
              marginBottom: '20px',
              color: colors.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: typography.sizes.base, opacity: 0.8 }}>Saldo Total (contas ativas)</p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: typography.sizes['6xl'],
                  fontWeight: typography.weights.bold,
                  color: saldoTotal >= 0 ? '#86efac' : '#fca5a5',
                }}
              >
                {formatBRL(saldoTotal)}
              </p>
            </div>
            <div style={{ opacity: 0.7, fontSize: typography.sizes.base }}>
              {lista.filter((c) => c.status === 'ativa').length} conta(s) ativa(s)
            </div>
          </div>

          {/* Filtro de status */}
          <Card padding="16px 20px" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: typography.sizes.sm, color: colors.neutral500, fontWeight: typography.weights.medium }}>Status</label>
                <Select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  style={{ width: '160px' }}
                >
                  <option value="">Todos</option>
                  <option value="ativa">Ativa</option>
                  <option value="inativa">Inativa</option>
                </Select>
              </div>
            </div>
          </Card>

          {/* Content */}
          {/* Cache notice when offline */}
          {!isOnline && cacheInfo && (
            <div style={{ marginBottom: '16px' }}>
              <OfflineDataBadge savedAt={cacheInfo} />
            </div>
          )}
          {loading ? (
            <Card>
              <div style={{ padding: '24px', textAlign: 'center', color: colors.neutral500 }}>Carregando...</div>
            </Card>
          ) : shouldShowOfflineFallback ? (
            <Card>
              <OfflineFallback message="A lista de carteiras não está disponível offline. Conecte-se à internet para acessar seus dados." />
            </Card>
          ) : error ? (
            <Card>
              <div style={{ padding: '24px', textAlign: 'center', color: colors.errorText }}>{error}</div>
            </Card>
          ) : lista.length === 0 ? (
            <Card>
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><FontAwesomeIcon icon={faCreditCard} /></div>
                <p style={{ color: colors.neutral800, fontWeight: typography.weights.semibold, fontSize: typography.sizes.xl, margin: '0 0 8px' }}>
                  Nenhuma carteira encontrada
                </p>
                <p style={{ color: colors.neutral500, fontSize: typography.sizes.md, margin: '0 0 24px' }}>
                  Crie sua primeira carteira para controlar seu saldo.
                </p>
                <Button onClick={abrirModalNovo} disabled={!isOnline} title={!isOnline ? 'Disponível apenas online' : undefined}>+ Criar primeira carteira</Button>
              </div>
            </Card>
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
                    background: colors.white,
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
                          color: colors.white,
                        }}
                      >
                        {conta.icone ? conta.icone : <FontAwesomeIcon icon={faCreditCard} />}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontWeight: typography.weights.bold,
                            fontSize: typography.sizes.lg,
                            color: colors.neutral800,
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
                      <Badge variant="primary" style={{ fontSize: typography.sizes.xs }}>
                        {TIPO_CONTA_LABELS[conta.tipo] || conta.tipo}
                      </Badge>
                      <StatusBadge status={conta.status} />
                      {conta.incluir_total && (
                        <Badge variant="success" style={{ fontSize: typography.sizes.xs }}>
                          <FontAwesomeIcon icon={faCheck} /> No total
                        </Badge>
                      )}
                    </div>

                    {/* Balance */}
                    <p
                      style={{
                        margin: 0,
                        fontSize: typography.sizes['4xl'],
                        fontWeight: typography.weights.bold,
                        color: (conta.saldo ?? 0) >= 0 ? colors.successText : colors.errorText,
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
                      borderTop: `1px solid ${colors.border}`,
                      background: colors.neutral50,
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirModalEdicao(conta)}
                      disabled={!isOnline}
                      title={!isOnline ? 'Disponível apenas online' : undefined}
                      style={{ flex: 1, background: '#e0f2fe', color: '#0369a1' }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirModalExcluir(conta)}
                      disabled={!isOnline}
                      title={!isOnline ? 'Disponível apenas online' : undefined}
                      style={{ flex: 1, background: colors.errorBg, color: colors.errorText }}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Modal criar/editar */}
        <Modal
          open={modalAberto}
          onClose={fecharModal}
          title={contaEmEdicao ? 'Editar Carteira' : 'Nova Carteira'}
          maxWidth="520px"
        >
          <form onSubmit={handleSalvar}>
            <div style={formGroup}>
              <label style={labelStyle}>Nome *</label>
              <Input
                type="text"
                name="nome"
                value={form.nome}
                onChange={handleFormChange}
                required
                placeholder="Ex: Conta Corrente Itaú"
              />
            </div>
            <div style={formGroup}>
              <label style={labelStyle}>Tipo *</label>
              <Select name="tipo" value={form.tipo} onChange={handleFormChange} required>
                {TIPO_CONTA_OPCOES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div style={formGroup}>
              <label style={labelStyle}>Cor (opcional)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  name="cor"
                  value={form.cor || DEFAULT_COLOR}
                  onChange={handleFormChange}
                  style={{ width: '40px', height: '40px', padding: '2px', border: `1px solid ${colors.border}`, borderRadius: radius.md, cursor: 'pointer' }}
                />
                <Input
                  type="text"
                  name="cor"
                  value={form.cor || ''}
                  onChange={handleFormChange}
                  placeholder="#33528a"
                  maxLength={7}
                />
              </div>
            </div>
            <div style={formGroup}>
              <label style={labelStyle}>Ícone (opcional)</label>
              <Input
                type="text"
                name="icone"
                value={form.icone}
                onChange={handleFormChange}
                placeholder="Ex: ��"
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
                <Select name="status" value={form.status} onChange={handleFormChange}>
                  <option value="ativa">Ativa</option>
                  <option value="inativa">Inativa</option>
                </Select>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <Button type="button" variant="secondary" onClick={fecharModal}>Cancelar</Button>
              <Button type="submit" loading={salvando}>
                {salvando ? 'Salvando...' : contaEmEdicao ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal excluir */}
        <Modal
          open={modalExcluirAberto && !!contaParaExcluir}
          onClose={fecharModalExcluir}
          title="Excluir Carteira"
          maxWidth="420px"
        >
          <p style={{ color: colors.secondaryText, marginBottom: '8px' }}>
            Tem certeza que deseja excluir a carteira{' '}
            <strong>{contaParaExcluir?.nome}</strong>?
          </p>
          <p style={{ color: colors.neutral500, fontSize: typography.sizes.base, marginBottom: '24px' }}>
            Caso a carteira possua movimentações, não será possível excluí-la. Inative-a em vez disso.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={fecharModalExcluir}>Cancelar</Button>
            <Button variant="danger" loading={excluindo} onClick={handleExcluir}>
              {excluindo ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </Modal>
      </div>
    </InadimplenteGuard>
  );
}

const formGroup = { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' };
const labelStyle = { fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.secondaryText };
