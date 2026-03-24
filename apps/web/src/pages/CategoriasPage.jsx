import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { categoriasService } from '../services/categorias.service.js';

const TIPO_LABELS = {
  entrada: 'Entrada',
  saida: 'Saída',
};

const DEFAULT_COLOR = '#33528a';

const TIPO_COLORS = {
  entrada: { background: '#dcfce7', color: '#166534' },
  saida: { background: '#fee2e2', color: '#991b1b' },
};

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
  const style = TIPO_COLORS[tipo] || {};
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
      {TIPO_LABELS[tipo] || tipo}
    </span>
  );
}

export default function CategoriasPage() {
  const [sidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

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
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f4f8' }}>
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
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
                Categorias
              </h1>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
                Gerencie as categorias de entradas e saídas
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
              + Nova Categoria
            </button>
          </div>

          {/* Filtros */}
          <form
            onSubmit={handleFiltrar}
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
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Busca</label>
              <input
                type="text"
                name="busca"
                value={filtros.busca}
                onChange={handleFiltroChange}
                placeholder="Nome da categoria..."
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Tipo</label>
              <select name="tipo" value={filtros.tipo} onChange={handleFiltroChange} style={inputStyle}>
                <option value="">Todos</option>
                {TIPO_OPCOES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" style={btnPrimarySmall}>
              Filtrar
            </button>
            <button type="button" onClick={handleLimpar} style={btnSecondarySmall}>
              Limpar
            </button>
          </form>

          {/* Content */}
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                Carregando...
              </div>
            ) : error ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#991b1b' }}>{error}</div>
            ) : lista.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                Nenhuma categoria encontrada.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={thStyle}>Nome</th>
                      <th style={thStyle}>Tipo</th>
                      <th style={thStyle}>Ícone</th>
                      <th style={thStyle}>Cor</th>
                      <th style={thStyle}>Sistema</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pais.map((cat) => {
                      const filhos = filhosPorPai.get(cat.id) ?? [];
                      const expandido = paisExpandidos.has(cat.id);
                      return (
                        <Fragment key={cat.id}>
                          <tr key={cat.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                            <td style={tdStyle}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {filhos.length > 0 && (
                                  <button
                                    onClick={() => togglePai(cat.id)}
                                    style={btnToggleExpand}
                                  >
                                    {expandido ? '▼' : '▶'}
                                  </button>
                                )}
                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{cat.nome}</span>
                                {filhos.length > 0 && (
                                  <span style={subcatBadge}>
                                    {filhos.length} subcat{filhos.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td style={tdStyle}><TipoBadge tipo={cat.tipo} /></td>
                            <td style={tdStyle}>{cat.icone || '-'}</td>
                            <td style={tdStyle}>
                              {cat.cor ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: cat.cor, border: '1px solid #e2e8f0', display: 'inline-block' }} />
                                  {cat.cor}
                                </span>
                              ) : '-'}
                            </td>
                            <td style={tdStyle}>
                              {cat.is_sistema ? (
                                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: '#e0f2fe', color: '#0369a1' }}>Sistema</span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '12px' }}>Personalizada</span>
                              )}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <span style={{ display: 'inline-flex', gap: '8px' }}>
                                <button onClick={() => abrirModalNovoFilho(cat)} style={btnActionSub}>+ Sub</button>
                                {!cat.is_sistema && (
                                  <>
                                    <button onClick={() => abrirModalEdicao(cat)} style={btnActionEdit}>Editar</button>
                                    <button onClick={() => abrirModalExcluir(cat)} style={btnActionDelete}>Excluir</button>
                                  </>
                                )}
                              </span>
                            </td>
                          </tr>
                          {expandido && filhos.map((filho) => (
                            <tr key={filho.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
                              <td style={{ ...tdStyle, paddingLeft: '36px' }}>
                                <span style={{ color: '#94a3b8', marginRight: '6px' }}>└</span>
                                <span style={{ color: '#1e293b' }}>{filho.nome}</span>
                              </td>
                              <td style={tdStyle}><TipoBadge tipo={filho.tipo} /></td>
                              <td style={tdStyle}>{filho.icone || '-'}</td>
                              <td style={tdStyle}>
                                {filho.cor ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: filho.cor, border: '1px solid #e2e8f0', display: 'inline-block' }} />
                                    {filho.cor}
                                  </span>
                                ) : '-'}
                              </td>
                              <td style={tdStyle}>
                                {filho.is_sistema ? (
                                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: '#e0f2fe', color: '#0369a1' }}>Sistema</span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Personalizada</span>
                                )}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                {!filho.is_sistema && (
                                  <span style={{ display: 'inline-flex', gap: '8px' }}>
                                    <button onClick={() => abrirModalEdicao(filho)} style={btnActionEdit}>Editar</button>
                                    <button onClick={() => abrirModalExcluir(filho)} style={btnActionDelete}>Excluir</button>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
                  {categoriaEmEdicao ? 'Editar Categoria' : 'Nova Categoria'}
                </h2>
                <button onClick={fecharModal} style={btnClose}>
                  ✕
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
                    placeholder="Ex: Alimentação"
                  />
                </div>
                {!categoriaEmEdicao && (
                  <div style={formGroup}>
                    <label style={labelStyle}>Tipo *</label>
                    <select
                      name="tipo"
                      value={form.tipo}
                      onChange={handleFormChange}
                      required
                      style={inputStyle}
                    >
                      {TIPO_OPCOES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={formGroup}>
                  <label style={labelStyle}>Ícone (opcional)</label>
                  <input
                    type="text"
                    name="icone"
                    value={form.icone}
                    onChange={handleFormChange}
                    style={inputStyle}
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
                  <label style={labelStyle}>Categoria Pai (opcional)</label>
                  <select
                    name="pai_id"
                    value={form.pai_id}
                    onChange={handleFormChange}
                    style={inputStyle}
                  >
                    <option value="">Nenhuma</option>
                    {categoriasPaiDisponiveis
                      .filter((c) => !categoriaEmEdicao || c.id !== categoriaEmEdicao.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} ({TIPO_LABELS[c.tipo] || c.tipo})
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button type="button" onClick={fecharModal} style={btnSecondary}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={salvando} style={btnPrimary}>
                    {salvando ? 'Salvando...' : categoriaEmEdicao ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal excluir */}
        {modalExcluirAberto && categoriaParaExcluir && (
          <div style={overlayStyle}>
            <div style={{ ...modalStyle, maxWidth: '420px' }}>
              <h2 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Excluir Categoria
              </h2>
              <p style={{ color: '#475569', marginBottom: '24px' }}>
                Tem certeza que deseja excluir a categoria{' '}
                <strong>{categoriaParaExcluir.nome}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={fecharModalExcluir} style={btnSecondary}>
                  Cancelar
                </button>
                <button
                  onClick={handleExcluir}
                  disabled={excluindo}
                  style={{
                    ...btnPrimary,
                    background: '#dc2626',
                  }}
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

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle = {
  padding: '12px 16px',
  fontSize: '14px',
  color: '#334155',
  verticalAlign: 'middle',
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

const btnPrimarySmall = {
  ...btnPrimary,
  padding: '8px 16px',
  fontSize: '13px',
};

const btnSecondarySmall = {
  ...btnSecondary,
  padding: '8px 16px',
  fontSize: '13px',
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

const btnActionSub = {
  background: '#f0fdf4',
  color: '#166534',
  border: 'none',
  borderRadius: '6px',
  padding: '5px 10px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnToggleExpand = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0 2px',
  fontSize: '12px',
  color: '#64748b',
  lineHeight: 1,
};

const subcatBadge = {
  fontSize: '11px',
  color: '#94a3b8',
  background: '#e2e8f0',
  borderRadius: '999px',
  padding: '1px 7px',
};
