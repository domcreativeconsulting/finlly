import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import AnexoUploader from '../components/AnexoUploader.jsx';
import { anexosService } from '../services/anexos.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPaperclip,
  faBars,
  faTrash,
  faInbox,
  faCreditCard,
  faCircleUser,
  faDoorOpen,
  faChevronLeft,
  faChevronRight,
  faEye,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Modal } from '../design-system/index.js';
import {
  colors,
  typography,
  radius,
  shadows,
} from '../design-system/tokens.js';

const OCR_STATUS_LABELS = {
  UPLOADED: 'Pendente',
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  PROCESSED: 'Processado',
  FAILED: 'Falhou',
};

const OCR_STATUS_COLORS = {
  UPLOADED: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
  PENDING: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
  PROCESSING: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  PROCESSED: { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' },
  FAILED: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

const MIME_ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/webp': '🖼️',
};

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatBRL(valor) {
  if (valor == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function OcrStatusBadge({ status }) {
  const s = status || 'PENDING';
  const scheme = OCR_STATUS_COLORS[s] || OCR_STATUS_COLORS.PENDING;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: radius.full,
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: scheme.bg,
        color: scheme.text,
        border: `1px solid ${scheme.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {OCR_STATUS_LABELS[s] || s}
    </span>
  );
}

export default function AnexosPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [anexos, setAnexos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [ocrModal, setOcrModal] = useState(null);
  const [loadingOcr, setLoadingOcr] = useState(false);

  const [showUploader, setShowUploader] = useState(false);

  const carregarAnexos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await anexosService.listar({ page, limit: 15 });
      setAnexos(result.items ?? result.data ?? []);
      setTotal(result.total ?? 0);
      setTotalPages(result.totalPages ?? result.pages ?? 1);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erro ao carregar anexos.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    carregarAnexos();
  }, [carregarAnexos]);

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

  async function handleExcluir(id) {
    setDeleting(true);
    try {
      await anexosService.excluir(id);
      toast.success('Anexo excluído com sucesso.');
      setConfirmDelete(null);
      carregarAnexos();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao excluir anexo.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleVerOcr(anexo) {
    setLoadingOcr(true);
    setOcrModal({ anexo, resultado: null });
    try {
      const resultado = await anexosService.buscarOcr(anexo.id);
      setOcrModal({ anexo, resultado });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Erro ao buscar resultado OCR.');
      setOcrModal(null);
    } finally {
      setLoadingOcr(false);
    }
  }

  function handleUploadSuccess() {
    setShowUploader(false);
    carregarAnexos();
    toast.success('Arquivo enviado com sucesso!');
  }

  const initials = getInitials(usuario?.nome);

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
        <AppSidebar
          sidebarOpen={sidebarOpen}
          currentPath="/anexos"
          isExpanded={sidebarExpanded}
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
          {/* Top Bar */}
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
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 18,
                    color: '#111827',
                    lineHeight: 1.2,
                  }}
                >
                  Finlly
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                  Gestão financeira pessoal
                </div>
              </div>
            </div>

            {/* Avatar / Dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
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

          {/* Main Content */}
          <InadimplenteGuard>
            <div style={s.content}>
              {/* Page heading */}
              <div
                style={{
                  marginBottom: 24,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: 28,
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    Anexos
                  </h2>
                  <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
                    Faça upload de documentos e acompanhe o processamento OCR.
                  </p>
                </div>
                <button
                  onClick={() => setShowUploader((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: radius.md,
                    backgroundColor: colors.primaryLight,
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: shadows.sm,
                    flexShrink: 0,
                  }}
                >
                  <FontAwesomeIcon icon={faPaperclip} />
                  Enviar arquivo
                </button>
              </div>

              {/* Upload area */}
              {showUploader && (
                <div
                  style={{
                    marginBottom: 24,
                    padding: '20px',
                    backgroundColor: colors.white,
                    borderRadius: radius.lg,
                    boxShadow: shadows.sm,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: '#111827',
                      }}
                    >
                      Novo anexo
                    </h3>
                    <button
                      onClick={() => setShowUploader(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: colors.neutral500,
                        fontSize: '18px',
                        padding: '2px 6px',
                        lineHeight: 1,
                      }}
                      aria-label="Fechar upload"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>
                  <AnexoUploader
                    onSuccess={handleUploadSuccess}
                    onError={(msg) => toast.error(msg)}
                  />
                </div>
              )}

              {/* Error state */}
              {error && (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: colors.errorBg,
                    border: `1px solid ${colors.errorBorder}`,
                    borderRadius: radius.md,
                    color: colors.errorText,
                    fontSize: 14,
                    marginBottom: 20,
                  }}
                >
                  {error}
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '60px 0',
                    color: colors.neutral500,
                    fontSize: 15,
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 20,
                      height: 20,
                      border: `3px solid ${colors.neutral200}`,
                      borderTop: `3px solid ${colors.primaryLight}`,
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }}
                  />
                  Carregando anexos…
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && anexos.length === 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '80px 24px',
                    textAlign: 'center',
                  }}
                >
                  <FontAwesomeIcon
                    icon={faInbox}
                    style={{
                      fontSize: 48,
                      color: colors.neutral300,
                      marginBottom: 16,
                    }}
                  />
                  <p
                    style={{
                      margin: '0 0 8px',
                      fontSize: 16,
                      fontWeight: 600,
                      color: colors.neutral600,
                    }}
                  >
                    Nenhum anexo encontrado
                  </p>
                  <p style={{ margin: 0, fontSize: 14, color: colors.neutral500 }}>
                    Clique em "Enviar arquivo" para adicionar seu primeiro documento.
                  </p>
                </div>
              )}

              {/* Attachments list */}
              {!loading && !error && anexos.length > 0 && (
                <div
                  style={{
                    backgroundColor: colors.white,
                    borderRadius: radius.lg,
                    boxShadow: shadows.sm,
                    border: `1px solid ${colors.border}`,
                    overflow: 'hidden',
                  }}
                >
                  {/* Table header */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 90px 130px 110px 80px',
                      padding: '10px 16px',
                      backgroundColor: colors.neutral50,
                      borderBottom: `1px solid ${colors.border}`,
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.neutral500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      gap: 8,
                    }}
                  >
                    <span>Arquivo</span>
                    <span>Tipo</span>
                    <span>Tamanho</span>
                    <span>Upload</span>
                    <span>Status OCR</span>
                    <span style={{ textAlign: 'right' }}>Ações</span>
                  </div>

                  {/* Rows */}
                  {anexos.map((anexo, idx) => {
                    const ocrStatus =
                      anexo.ocr_resultado?.status ||
                      anexo.ocrResultado?.status ||
                      'PENDING';
                    const isProcessed = ocrStatus === 'PROCESSED';
                    const isLastRow = idx === anexos.length - 1;

                    return (
                      <div
                        key={anexo.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 120px 90px 130px 110px 80px',
                          padding: '12px 16px',
                          borderBottom: isLastRow
                            ? 'none'
                            : `1px solid ${colors.neutral100}`,
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 14,
                          color: colors.neutral800,
                        }}
                      >
                        {/* Name */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <span style={{ fontSize: 20, flexShrink: 0 }}>
                            {MIME_ICONS[anexo.mime_type] || '📎'}
                          </span>
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: 500,
                            }}
                            title={anexo.nome_original || anexo.nomeOriginal}
                          >
                            {anexo.nome_original || anexo.nomeOriginal || '—'}
                          </span>
                        </div>

                        {/* Mime type */}
                        <span
                          style={{
                            fontSize: 12,
                            color: colors.neutral500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={anexo.mime_type}
                        >
                          {anexo.mime_type || '—'}
                        </span>

                        {/* Size */}
                        <span style={{ fontSize: 13, color: colors.neutral600 }}>
                          {formatBytes(
                            anexo.tamanho_bytes ?? anexo.tamanhoBytes,
                          )}
                        </span>

                        {/* Upload date */}
                        <span style={{ fontSize: 13, color: colors.neutral600 }}>
                          {formatDate(anexo.created_at || anexo.createdAt)}
                        </span>

                        {/* OCR status badge */}
                        <div>
                          <OcrStatusBadge status={ocrStatus} />
                        </div>

                        {/* Actions */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            justifyContent: 'flex-end',
                          }}
                        >
                          {isProcessed && (
                            <button
                              onClick={() => handleVerOcr(anexo)}
                              style={{
                                background: 'none',
                                border: `1px solid ${colors.neutral200}`,
                                cursor: 'pointer',
                                color: colors.primaryLight,
                                fontSize: '13px',
                                padding: '4px 8px',
                                borderRadius: radius.sm,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title="Ver resultado OCR"
                            >
                              <FontAwesomeIcon icon={faEye} />
                            </button>
                          )}

                          {confirmDelete === anexo.id ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <button
                                onClick={() => handleExcluir(anexo.id)}
                                disabled={deleting}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  backgroundColor: colors.error,
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: radius.sm,
                                  cursor: deleting ? 'not-allowed' : 'pointer',
                                  opacity: deleting ? 0.7 : 1,
                                }}
                              >
                                Sim
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  backgroundColor: colors.neutral200,
                                  color: colors.neutral700,
                                  border: 'none',
                                  borderRadius: radius.sm,
                                  cursor: 'pointer',
                                }}
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(anexo.id)}
                              style={{
                                background: 'none',
                                border: `1px solid ${colors.neutral200}`,
                                cursor: 'pointer',
                                color: colors.error,
                                fontSize: '13px',
                                padding: '4px 8px',
                                borderRadius: radius.sm,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title="Excluir anexo"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {!loading && totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 20,
                    fontSize: 13,
                    color: colors.neutral600,
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <span>
                    {total} anexo{total !== 1 ? 's' : ''} · página {page} de {totalPages}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      style={{
                        padding: '6px 12px',
                        borderRadius: radius.sm,
                        border: `1px solid ${colors.neutral200}`,
                        background: page <= 1 ? colors.neutral100 : '#fff',
                        color: page <= 1 ? colors.neutral400 : colors.neutral700,
                        cursor: page <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      style={{
                        padding: '6px 12px',
                        borderRadius: radius.sm,
                        border: `1px solid ${colors.neutral200}`,
                        background: page >= totalPages ? colors.neutral100 : '#fff',
                        color:
                          page >= totalPages ? colors.neutral400 : colors.neutral700,
                        cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      Próximo
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </InadimplenteGuard>
        </div>
      </div>

      {/* OCR Result Modal */}
      {ocrModal && (
        <Modal
          isOpen={!!ocrModal}
          onClose={() => setOcrModal(null)}
          title={`Resultado OCR — ${ocrModal.anexo?.nome_original || ocrModal.anexo?.nomeOriginal || 'Arquivo'}`}
        >
          {loadingOcr ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '40px 0',
                color: colors.neutral500,
                gap: 10,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 18,
                  border: `3px solid ${colors.neutral200}`,
                  borderTop: `3px solid ${colors.primaryLight}`,
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              Carregando resultado OCR…
            </div>
          ) : ocrModal.resultado ? (
            <div style={{ fontSize: 14, color: colors.neutral700 }}>
              <OcrField
                label="Valor extraído"
                value={formatBRL(
                  ocrModal.resultado.extracted_amount ??
                    ocrModal.resultado.extractedAmount,
                )}
              />
              <OcrField
                label="Data extraída"
                value={formatDate(
                  ocrModal.resultado.extracted_date ??
                    ocrModal.resultado.extractedDate,
                )}
              />
              <OcrField
                label="Descrição extraída"
                value={
                  ocrModal.resultado.extracted_description ??
                  ocrModal.resultado.extractedDescription
                }
              />
              <OcrField
                label="Tipo extraído"
                value={
                  ocrModal.resultado.extracted_type ??
                  ocrModal.resultado.extractedType
                }
              />
              <OcrField
                label="Confiança"
                value={
                  ocrModal.resultado.confidence_score != null
                    ? `${(ocrModal.resultado.confidence_score * 100).toFixed(1)}%`
                    : ocrModal.resultado.confidenceScore != null
                      ? `${(ocrModal.resultado.confidenceScore * 100).toFixed(1)}%`
                      : null
                }
              />
            </div>
          ) : (
            <p style={{ color: colors.neutral500, fontSize: 14 }}>
              Nenhum dado OCR disponível.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

function OcrField({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 0',
        borderBottom: `1px solid ${colors.neutral100}`,
      }}
    >
      <span
        style={{
          minWidth: 150,
          fontWeight: 600,
          color: colors.neutral600,
          fontSize: 13,
        }}
      >
        {label}
      </span>
      <span style={{ color: value ? colors.neutral800 : colors.neutral400, fontSize: 13 }}>
        {value || '—'}
      </span>
    </div>
  );
}

const s = {
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    fontFamily: typography.fontFamily,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 28px',
    background: colors.white,
    borderBottom: `1px solid ${colors.border ?? '#e5e7eb'}`,
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
    color: colors.neutral600 ?? '#4b5563',
    padding: '4px 8px',
    borderRadius: radius.sm ?? '6px',
  },
  content: {
    padding: '20px 28px',
    flex: 1,
  },
};
