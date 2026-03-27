import { useState, useEffect, useCallback, useMemo, Fragment, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { categoriasService } from '../services/categorias.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCreditCard, faCircleUser, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import { Button, Input, Select, Modal, Badge, Card } from '../design-system/index.js';
import { colors, typography, radius } from '../design-system/tokens.js';
import { Table, Thead, Th, Tbody, Tr, Td } from '../design-system/components/Table.jsx';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const TIPO_LABELS = {
  entrada: 'Entrada',
  saida: 'Saída',
};

const DEFAULT_COLOR = '#33528a';

const TIPO_OPCOES = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
];

const EMPTY_FORM = {
  nome: '',
  tipo: 'saida',
  icone: '',
  cor: DEFAULT_COLOR,
  pai_id: '',
};

function TipoBadge({ tipo }) {
  const variantMap = { entrada: 'success', saida: 'error' };
  return (
    <Badge variant={variantMap[tipo] || 'neutral'}>
      {TIPO_LABELS[tipo] || tipo}
    </Badge>
  );
}

export default function CategoriasPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filtros, setFiltros] = useState({ busca: '', tipo: '' });
  const [filtrosAtivos, setFiltrosAtivos] = useState({});

  const [modalAberto, setModalAberto] = useState(false);
  const [categoriaEmEdicao, setCategoriaEmEdicao] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [salvando, setSalvando] = useState(false);

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [categoriaParaExcluir, setCategoriaParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const [paisExpandidos, setPaisExpandidos] = useState(new Set());

  const carregarLista = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { include_sistema: true, ...filtrosAtivos };
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] === null || params[k] === undefined) delete params[k];
      });
      const result = await categoriasService.listar(params);
      setLista(Array.isArray(result) ? result : []);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao carregar categorias.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filtrosAtivos]);

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

  function handleFiltroChange(e) {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
  }

  function handleFiltrar(e) {
    e.preventDefault();
    setFiltrosAtivos({ ...filtros });
  }

  function handleLimpar() {
    setFiltros({ busca: '', tipo: '' });
    setFiltrosAtivos({});
  }

  function abrirModalNovo() {
    setCategoriaEmEdicao(null);
    setForm(EMPTY_FORM);
    setModalAberto(true);
  }

  function abrirModalEdicao(categoria) {
    setCategoriaEmEdicao(categoria);
    setForm({
      nome: categoria.nome || '',
      tipo: categoria.tipo || 'saida',
      icone: categoria.icone || '',
      cor: categoria.cor || DEFAULT_COLOR,
      pai_id: categoria.pai_id || '',
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setCategoriaEmEdicao(null);
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
      const payload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        icone: form.icone.trim() || null,
        cor: form.cor || null,
        pai_id: form.pai_id || null,
      };

      if (categoriaEmEdicao) {
        const updatePayload = {};
        if (payload.nome) updatePayload.nome = payload.nome;
        if (payload.icone !== undefined) updatePayload.icone = payload.icone;
        if (payload.cor !== undefined) updatePayload.cor = payload.cor;
        if (payload.pai_id !== undefined) updatePayload.pai_id = payload.pai_id;
        await categoriasService.atualizar(categoriaEmEdicao.id, updatePayload);
        toast.success('Categoria atualizada com sucesso!');
      } else {
        await categoriasService.criar(payload);
        toast.success('Categoria criada com sucesso!');
      }

      fecharModal();
      if (form.pai_id) {
        setPaisExpandidos((prev) => new Set([...prev, form.pai_id]));
      }
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao salvar categoria.';
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  function abrirModalExcluir(categoria) {
    setCategoriaParaExcluir(categoria);
    setModalExcluirAberto(true);
  }

  function fecharModalExcluir() {
    setModalExcluirAberto(false);
    setCategoriaParaExcluir(null);
  }

  async function handleExcluir() {
    if (!categoriaParaExcluir) return;
    setExcluindo(true);
    try {
      await categoriasService.excluir(categoriaParaExcluir.id);
      toast.success('Categoria excluída com sucesso!');
      fecharModalExcluir();
      carregarLista();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao excluir categoria.';
      toast.error(msg);
    } finally {
      setExcluindo(false);
    }
  }

  function togglePai(id) {
    setPaisExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function abrirModalNovoFilho(pai) {
    setCategoriaEmEdicao(null);
    setForm({ ...EMPTY_FORM, pai_id: pai.id, tipo: pai.tipo });
    setModalAberto(true);
  }

  const categoriasPaiDisponiveis = lista.filter((c) => !c.pai_id);

  const { pais, filhosPorPai } = useMemo(() => {
    const pais = lista.filter((c) => !c.pai_id);
    const filhosPorPai = new Map();
    lista.forEach((c) => {
      if (c.pai_id) {
        if (!filhosPorPai.has(c.pai_id)) filhosPorPai.set(c.pai_id, []);
        filhosPorPai.get(c.pai_id).push(c);
      }
    });
    return { pais, filhosPorPai };
  }, [lista]);

  const contentMarginLeft = sidebarExpanded ? '236px' : '108px';

  return (
    <InadimplenteGuard>
      <div style={{ display: 'flex', minHeight: '100vh', background: colors.bg }}>
        <AppSidebar
          sidebarOpen={sidebarOpen}
          currentPath="/categorias"
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
                Categorias
              </h1>
              <p style={{ margin: '4px 0 0', color: colors.neutral500, fontSize: typography.sizes.md }}>
                Gerencie as categorias de entradas e saídas
              </p>
            </div>
            <Button onClick={abrirModalNovo}>+ Nova Categoria</Button>

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

          {/* Filtros */}
          <Card padding="16px 20px" style={{ marginBottom: '20px' }}>
            <form
              onSubmit={handleFiltrar}
              style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: typography.sizes.sm, color: colors.neutral500, fontWeight: typography.weights.medium }}>Busca</label>
                <Input
                  type="text"
                  name="busca"
                  value={filtros.busca}
                  onChange={handleFiltroChange}
                  placeholder="Nome da categoria..."
                  style={{ width: '220px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: typography.sizes.sm, color: colors.neutral500, fontWeight: typography.weights.medium }}>Tipo</label>
                <Select name="tipo" value={filtros.tipo} onChange={handleFiltroChange} style={{ width: '160px' }}>
                  <option value="">Todos</option>
                  {TIPO_OPCOES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
              <Button type="submit" size="sm">Filtrar</Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleLimpar}>Limpar</Button>
            </form>
          </Card>

          {/* Content */}
          <Card padding="0">
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: colors.neutral500 }}>
                Carregando...
              </div>
            ) : error ? (
              <div style={{ padding: '40px', textAlign: 'center', color: colors.errorText }}>{error}</div>
            ) : lista.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: colors.neutral500 }}>
                Nenhuma categoria encontrada.
              </div>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Nome</Th>
                    <Th>Tipo</Th>
                    <Th>Ícone</Th>
                    <Th>Cor</Th>
                    <Th>Sistema</Th>
                    <Th style={{ textAlign: 'right' }}>Ações</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pais.map((cat) => {
                    const filhos = filhosPorPai.get(cat.id) ?? [];
                    const expandido = paisExpandidos.has(cat.id);
                    return (
                      <Fragment key={cat.id}>
                        <Tr style={{ background: colors.neutral50 }}>
                          <Td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {filhos.length > 0 && (
                                <button
                                  onClick={() => togglePai(cat.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: typography.sizes.sm, color: colors.neutral500, lineHeight: 1 }}
                                >
                                  {expandido ? '▼' : '▶'}
                                </button>
                              )}
                              <span style={{ fontWeight: typography.weights.bold, color: colors.neutral800 }}>{cat.nome}</span>
                              {filhos.length > 0 && (
                                <Badge variant="neutral" style={{ fontSize: typography.sizes.xs }}>
                                  {filhos.length} subcat{filhos.length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </span>
                          </Td>
                          <Td><TipoBadge tipo={cat.tipo} /></Td>
                          <Td>{cat.icone || '-'}</Td>
                          <Td>
                            {cat.cor ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '16px', height: '16px', borderRadius: radius.sm, background: cat.cor, border: `1px solid ${colors.border}`, display: 'inline-block' }} />
                                {cat.cor}
                              </span>
                            ) : '-'}
                          </Td>
                          <Td>
                            {cat.is_sistema ? (
                              <Badge variant="primary" style={{ fontSize: typography.sizes.xs }}>Sistema</Badge>
                            ) : (
                              <span style={{ color: colors.neutral400, fontSize: typography.sizes.sm }}>Personalizada</span>
                            )}
                          </Td>
                          <Td style={{ textAlign: 'right' }}>
                            <span style={{ display: 'inline-flex', gap: '8px' }}>
                              <Button variant="ghost" size="sm" onClick={() => abrirModalNovoFilho(cat)}
                                style={{ background: colors.successBg, color: colors.successText }}>+ Sub</Button>
                              {!cat.is_sistema && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => abrirModalEdicao(cat)}
                                    style={{ background: '#e0f2fe', color: '#0369a1' }}>Editar</Button>
                                  <Button variant="ghost" size="sm" onClick={() => abrirModalExcluir(cat)}
                                    style={{ background: colors.errorBg, color: colors.errorText }}>Excluir</Button>
                                </>
                              )}
                            </span>
                          </Td>
                        </Tr>
                        {expandido && filhos.map((filho) => (
                          <Tr key={filho.id} style={{ background: colors.white }}>
                            <Td style={{ paddingLeft: '36px' }}>
                              <span style={{ color: colors.neutral400, marginRight: '6px' }}>└</span>
                              <span style={{ color: colors.neutral800 }}>{filho.nome}</span>
                            </Td>
                            <Td><TipoBadge tipo={filho.tipo} /></Td>
                            <Td>{filho.icone || '-'}</Td>
                            <Td>
                              {filho.cor ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '16px', height: '16px', borderRadius: radius.sm, background: filho.cor, border: `1px solid ${colors.border}`, display: 'inline-block' }} />
                                  {filho.cor}
                                </span>
                              ) : '-'}
                            </Td>
                            <Td>
                              {filho.is_sistema ? (
                                <Badge variant="primary" style={{ fontSize: typography.sizes.xs }}>Sistema</Badge>
                              ) : (
                                <span style={{ color: colors.neutral400, fontSize: typography.sizes.sm }}>Personalizada</span>
                              )}
                            </Td>
                            <Td style={{ textAlign: 'right' }}>
                              {!filho.is_sistema && (
                                <span style={{ display: 'inline-flex', gap: '8px' }}>
                                  <Button variant="ghost" size="sm" onClick={() => abrirModalEdicao(filho)}
                                    style={{ background: '#e0f2fe', color: '#0369a1' }}>Editar</Button>
                                  <Button variant="ghost" size="sm" onClick={() => abrirModalExcluir(filho)}
                                    style={{ background: colors.errorBg, color: colors.errorText }}>Excluir</Button>
                                </span>
                              )}
                            </Td>
                          </Tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </Tbody>
              </Table>
            )}
          </Card>
        </main>

        {/* Modal criar/editar */}
        <Modal
          open={modalAberto}
          onClose={fecharModal}
          title={categoriaEmEdicao ? 'Editar Categoria' : 'Nova Categoria'}
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
                placeholder="Ex: Alimentação"
              />
            </div>
            {!categoriaEmEdicao && (
              <div style={formGroup}>
                <label style={labelStyle}>Tipo *</label>
                <Select name="tipo" value={form.tipo} onChange={handleFormChange} required>
                  {TIPO_OPCOES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
            )}
            <div style={formGroup}>
              <label style={labelStyle}>Ícone (opcional)</label>
              <Input
                type="text"
                name="icone"
                value={form.icone}
                onChange={handleFormChange}
                placeholder="Ex: 🍔 ou home"
                maxLength={50}
              />
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
              <label style={labelStyle}>Categoria Pai (opcional)</label>
              <Select name="pai_id" value={form.pai_id} onChange={handleFormChange}>
                <option value="">Nenhuma</option>
                {categoriasPaiDisponiveis
                  .filter((c) => !categoriaEmEdicao || c.id !== categoriaEmEdicao.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({TIPO_LABELS[c.tipo] || c.tipo})
                    </option>
                  ))}
              </Select>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <Button type="button" variant="secondary" onClick={fecharModal}>Cancelar</Button>
              <Button type="submit" loading={salvando}>
                {salvando ? 'Salvando...' : categoriaEmEdicao ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal excluir */}
        <Modal
          open={modalExcluirAberto && !!categoriaParaExcluir}
          onClose={fecharModalExcluir}
          title="Excluir Categoria"
          maxWidth="420px"
        >
          <p style={{ color: colors.secondaryText, marginBottom: '24px' }}>
            Tem certeza que deseja excluir a categoria{' '}
            <strong>{categoriaParaExcluir?.nome}</strong>? Esta ação não pode ser desfeita.
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
