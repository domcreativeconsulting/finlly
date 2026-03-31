import { useState, useRef, useCallback } from 'react';
import { colors, radius } from '../design-system/tokens.js';
import { anexosService } from '../services/anexos.service.js';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const MIME_ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/webp': '🖼️',
};

const OCR_STATUS_LABELS = {
  UPLOADED: 'Aguardando processamento',
  PROCESSING: 'Processando...',
  PROCESSED: 'Processado',
  FAILED: 'Falha no processamento',
};

const OCR_STATUS_COLORS = {
  UPLOADED: colors.neutral500,
  PROCESSING: colors.warning,
  PROCESSED: colors.success,
  FAILED: colors.error,
};

const DEFAULT_OCR_STATUS = 'UPLOADED';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Tipo de arquivo não permitido. Use: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `Arquivo muito grande. Tamanho máximo: ${MAX_SIZE_MB}MB`;
  }
  return null;
}

/**
 * AnexoUploader — componente de upload de arquivos com suporte a drag-and-drop.
 *
 * Props:
 *   onSuccess(anexo) — chamado após upload bem-sucedido
 *   onError(message) — chamado em caso de erro
 *   disabled — desabilita o componente
 */
export default function AnexoUploader({ onSuccess, onError, disabled = false }) {
  const [state, setState] = useState('idle'); // idle | uploading | success | error
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [anexo, setAnexo] = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(
    async (file) => {
      const validationError = validateFile(file);
      if (validationError) {
        setErrorMessage(validationError);
        setState('error');
        if (onError) onError(validationError);
        return;
      }

      setSelectedFile(file);
      setState('uploading');
      setProgress(0);
      setErrorMessage('');

      // Simulate progress during upload using chained timeouts
      let currentProgress = 0;
      const tick = () => {
        currentProgress = Math.min(currentProgress + 10, 90);
        setProgress(currentProgress);
        if (currentProgress < 90) setTimeout(tick, 100);
      };
      setTimeout(tick, 100);

      try {
        const result = await anexosService.upload(file);
        setProgress(100);
        setAnexo(result);
        setState('success');
        if (onSuccess) onSuccess(result);
      } catch (err) {
        const msg = err?.response?.data?.message || 'Erro ao fazer upload do arquivo.';
        setErrorMessage(msg);
        setState('error');
        if (onError) onError(msg);
      }
    },
    [onSuccess, onError],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled || state === 'uploading') return;
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    },
    [disabled, state, handleFile],
  );

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      if (!disabled && state !== 'uploading') setDragOver(true);
    },
    [disabled, state],
  );

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [handleFile],
  );

  const handleReset = useCallback(() => {
    setState('idle');
    setSelectedFile(null);
    setProgress(0);
    setErrorMessage('');
    setAnexo(null);
  }, []);

  const isInteractive = !disabled && state !== 'uploading';

  const dropZoneStyle = {
    border: `2px dashed ${dragOver ? colors.primaryLight : state === 'error' ? colors.error : colors.neutral300}`,
    borderRadius: radius.lg,
    padding: '32px 24px',
    textAlign: 'center',
    cursor: isInteractive ? 'pointer' : 'default',
    backgroundColor: dragOver ? colors.primaryBg : state === 'error' ? colors.errorBg : colors.neutral50,
    transition: 'all 0.2s ease',
    outline: 'none',
  };

  if (state === 'success' && anexo) {
    const ocrStatus = anexo.ocr_resultado?.status || DEFAULT_OCR_STATUS;
    return (
      <div
        style={{
          border: `1px solid ${colors.successBorder}`,
          borderRadius: radius.lg,
          padding: '16px',
          backgroundColor: colors.successBg,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>{MIME_ICONS[anexo.mime_type] || '📎'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                color: colors.neutral800,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {anexo.nome_original}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.neutral500 }}>
              {formatBytes(Number(anexo.tamanho_bytes))}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: OCR_STATUS_COLORS[ocrStatus] }}>
              ● {OCR_STATUS_LABELS[ocrStatus] || ocrStatus}
            </p>
          </div>
          <button
            onClick={handleReset}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.neutral500,
              fontSize: '18px',
              padding: '0 4px',
              lineHeight: 1,
            }}
            title="Enviar outro arquivo"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={dropZoneStyle}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => isInteractive && inputRef.current?.click()}
        role="button"
        tabIndex={isInteractive ? 0 : -1}
        onKeyDown={(e) => e.key === 'Enter' && isInteractive && inputRef.current?.click()}
        aria-label="Área de upload de arquivo"
        aria-disabled={!isInteractive}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          style={{ display: 'none' }}
          disabled={!isInteractive}
        />

        {state === 'uploading' ? (
          <div>
            <p style={{ margin: '0 0 8px', color: colors.neutral700, fontWeight: 500 }}>
              Enviando {selectedFile?.name}…
            </p>
            <div
              style={{
                height: '6px',
                borderRadius: radius.full,
                backgroundColor: colors.neutral200,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: colors.primaryLight,
                  borderRadius: radius.full,
                  transition: 'width 0.1s ease',
                }}
              />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: colors.neutral500 }}>{progress}%</p>
          </div>
        ) : (
          <>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>📎</span>
            <p style={{ margin: '0 0 4px', fontWeight: 500, color: colors.neutral700 }}>
              {dragOver ? 'Solte o arquivo aqui' : 'Arraste um arquivo ou clique para selecionar'}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: colors.neutral500 }}>
              PDF, JPG, PNG ou WEBP · Máximo {MAX_SIZE_MB}MB
            </p>
            {state === 'error' && errorMessage && (
              <p style={{ margin: '12px 0 0', color: colors.error, fontSize: '13px' }}>⚠ {errorMessage}</p>
            )}
          </>
        )}
      </div>

      {selectedFile && state === 'idle' && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: radius.md,
            backgroundColor: colors.neutral100,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: colors.neutral700,
          }}
        >
          <span>{MIME_ICONS[selectedFile.type] || '📎'}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedFile.name}
          </span>
          <span style={{ color: colors.neutral500, flexShrink: 0 }}>{formatBytes(selectedFile.size)}</span>
        </div>
      )}
    </div>
  );
}
