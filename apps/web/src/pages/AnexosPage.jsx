import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AppSidebar from '../components/AppSidebar.jsx';
import { InadimplenteGuard } from '../components/InadimplenteGuard.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import AnexoUploader from '../components/AnexoUploader.jsx';
import { anexosService } from '../services/anexos.service.js';
import { useAuth } from '../hooks/useAuth.js';
import { useContentLayout } from '../hooks/useContentLayout.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPaperclip,
  faTrash,
  faInbox,
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
      <span
        style={{
          color: value ? colors.neutral800 : colors.neutral400,
          fontSize: 13,
        }}
      >
        {value || '—'}
      </span>
    </div>
  );
}

export default function AnexosPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { isMobile, contentStyle } = useContentLayout();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

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
      toast.error(
        err?.response?.data?.message || 'Erro ao buscar resultado OCR.'
      );
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

  return (
    <>
      <div
        style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}
      >
        <AppSidebar
          sidebarOpen={sidebarOpen}
          currentPath="/anexos"
          isExpanded={sidebarExpanded}
          onHoverChange={setSidebarExpanded}
        />
        <div
          style={{
            ...s.mainArea,
            ...(isMobile
              ? contentStyle
              : {
                  marginLeft: !sidebarOpen
                    ? '0px'
                    : sidebarExpanded
                      ? '236px'
                      : '108px',
                  transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }),
          }}
        >
          <PageHeader
            title="Anexos"
            subtitle="Faça upload de documentos e acompanhe o processamento OCR."
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            sidebarExpanded={sidebarExpanded}
            setSidebarExpanded={setSidebarExpanded}
            actions={
              <button
                onClick={() => setShowUploader((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: radius.md,
                  backgroundColor: colors.primaryLight,
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <FontAwesomeIcon icon={faPaperclip} />
                Enviar arquivo
              </button>
            }
          />

          <InadimplenteGuard>
            <div style={s.content}>
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
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: colors.neutral500,
                    }}
                  >
                    Clique em &quot;Enviar arquivo&quot; para adicionar seu
                    primeiro documento.
                  </p>
                </div>
              )}

              {!loading &&
                !error &&
                anexos.length > 0 &&
                (isMobile ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {anexos.map((anexo) => {
                      const ocrStatus =
                        anexo.ocr_resultado?.status ||
                        anexo.ocrResultado?.status ||
                        'PENDING';
                      const isProcessed = ocrStatus === 'PROCESSED';
                      return (
                        <div
                          key={anexo.id}
                          style={{
                            backgroundColor: colors.white,
                            borderRadius: radius.lg,
                            boxShadow: shadows.sm,
                            border: `1px solid ${colors.border}`,
                            padding: '14px 16px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              marginBottom: 10,
                            }}
                          >
                            <span style={{ fontSize: 22, flexShrink: 0 }}>
                              {MIME_ICONS[anexo.mime_type] || '📎'}
                            </span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontWeight: 600,
                                  fontSize: 14,
                                  color: colors.neutral800,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={
                                  anexo.nome_original || anexo.nomeOriginal
                                }
                              >
                                {anexo.nome_original ||
                                  anexo.nomeOriginal ||
                                  '—'}
                              </p>
                              <p
                                style={{
                                  margin: '2px 0 0',
                                  fontSize: 12,
                                  color: colors.neutral500,
                                }}
                              >
                                {anexo.mime_type || '—'}
                              </p>
                            </div>
                            <OcrStatusBadge status={ocrStatus} />
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 6,
                              marginBottom: 12,
                            }}
                          >
                            <div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 11,
                                  color: colors.neutral500,
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                Tamanho
                              </p>
                              <p
                                style={{
                                  margin: '2px 0 0',
                                  fontSize: 13,
                                  color: colors.neutral700,
                                }}
                              >
                                {formatBytes(
                                  anexo.tamanho_bytes ?? anexo.tamanhoBytes
                                )}
                              </p>
                            </div>
                            <div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 11,
                                  color: colors.neutral500,
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                Upload
                              </p>
                              <p
                                style={{
                                  margin: '2px 0 0',
                                  fontSize: 13,
                                  color: colors.neutral700,
                                }}
                              >
                                {formatDate(
                                  anexo.created_at || anexo.createdAt
                                )}
                              </p>
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              justifyContent: 'flex-end',
                            }}
                          >
                            {isProcessed && (
                              <button
                                onClick={() => handleVerOcr(anexo)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '6px 12px',
                                  borderRadius: radius.sm,
                                  border: `1px solid ${colors.neutral200}`,
                                  background: 'none',
                                  color: colors.primaryLight,
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                }}
                              >
                                <FontAwesomeIcon icon={faEye} /> Ver OCR
                              </button>
                            )}
                            {confirmDelete === anexo.id ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  onClick={() => handleExcluir(anexo.id)}
                                  disabled={deleting}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    backgroundColor: colors.error,
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: radius.sm,
                                    cursor: deleting
                                      ? 'not-allowed'
                                      : 'pointer',
                                    opacity: deleting ? 0.7 : 1,
                                  }}
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: 13,
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
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '6px 12px',
                                  borderRadius: radius.sm,
                                  border: `1px solid ${colors.neutral200}`,
                                  background: 'none',
                                  color: colors.error,
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                }}
                              >
                                <FontAwesomeIcon icon={faTrash} /> Excluir
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: colors.white,
                      borderRadius: radius.lg,
                      boxShadow: shadows.sm,
                      border: `1px solid ${colors.border}`,
                      overflow: 'hidden',
                    }}
                  >
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
                    {anexos.map((anexo, idx) => {
                      const ocrStatus =
                        anexo.ocr_resultado?.status ||
                        anexo.ocrResultado?.status ||
                        'PENDING';
                      const isProcessed = ocrStatus === 'PROCESSED';
                      return (
                        <div
                          key={anexo.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              '1fr 120px 90px 130px 110px 80px',
                            padding: '12px 16px',
                            borderBottom:
                              idx === anexos.length - 1
                                ? 'none'
                                : `1px solid ${colors.neutral100}`,
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 14,
                            color: colors.neutral800,
                          }}
                        >
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
                          <span
                            style={{
                              fontSize: 12,
                              color: colors.neutral500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {anexo.mime_type || '—'}
                          </span>
                          <span
                            style={{ fontSize: 13, color: colors.neutral600 }}
                          >
                            {formatBytes(
                              anexo.tamanho_bytes ?? anexo.tamanhoBytes
                            )}
                          </span>
                          <span
                            style={{ fontSize: 13, color: colors.neutral600 }}
                          >
                            {formatDate(anexo.created_at || anexo.createdAt)}
                          </span>
                          <div>
                            <OcrStatusBadge status={ocrStatus} />
                          </div>
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
                                    cursor: deleting
                                      ? 'not-allowed'
                                      : 'pointer',
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
                ))}

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
                    {total} anexo{total !== 1 ? 's' : ''} · página {page} de{' '}
                    {totalPages}
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
                        color:
                          page <= 1 ? colors.neutral400 : colors.neutral700,
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
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page >= totalPages}
                      style={{
                        padding: '6px 12px',
                        borderRadius: radius.sm,
                        border: `1px solid ${colors.neutral200}`,
                        background:
                          page >= totalPages ? colors.neutral100 : '#fff',
                        color:
                          page >= totalPages
                            ? colors.neutral400
                            : colors.neutral700,
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

          <div style={{ padding: '0 28px 28px' }}>
            <div style={s.footer}>
              Finlly • painel financeiro pessoal — {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </div>

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
                    ocrModal.resultado.extractedAmount
                )}
              />
              <OcrField
                label="Data extraída"
                value={formatDate(
                  ocrModal.resultado.extracted_date ??
                    ocrModal.resultado.extractedDate
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

const s = {
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    fontFamily: typography.fontFamily,
  },
  content: { padding: '20px 28px', flex: 1 },
  footer: {
    backgroundColor: '#33528a',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingTop: '18px',
    paddingBottom: '18px',
    paddingLeft: '32px',
    paddingRight: '32px',
    fontSize: '14px',
    fontWeight: '500',
    letterSpacing: '0.01em',
    borderRadius: radius.lg,
  },
};
