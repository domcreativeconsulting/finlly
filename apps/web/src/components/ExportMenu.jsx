import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileExport,
  faFilePdf,
  faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '../design-system/index.js';
import { colors, radius, shadows, typography } from '../design-system/tokens.js';

/**
 * Reusable export dropdown component.
 * Renders an "Exportar" trigger button that opens a small menu with CSV and PDF options.
 *
 * Props:
 *   onExportCSV  — async function called when user picks CSV
 *   onExportPDF  — async function called when user picks PDF
 *   loadingCSV   — boolean, true while CSV export is in progress
 *   loadingPDF   — boolean, true while PDF export is in progress
 */
export default function ExportMenu({
  onExportCSV,
  onExportPDF,
  loadingCSV = false,
  loadingPDF = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isLoading = loadingCSV || loadingPDF;

  function handleCSV() {
    setOpen(false);
    onExportCSV();
  }

  function handlePDF() {
    setOpen(false);
    onExportPDF();
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Button
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        disabled={isLoading}
        aria-haspopup="true"
        aria-expanded={open}
        title="Exportar relatório"
      >
        <FontAwesomeIcon icon={faFileExport} />
        {isLoading ? 'Exportando...' : 'Exportar'}
        <FontAwesomeIcon
          icon={faChevronDown}
          style={{ fontSize: '11px', opacity: 0.65 }}
        />
      </Button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '148px',
            backgroundColor: colors.white,
            borderRadius: radius.md,
            boxShadow: shadows.lg,
            border: `1px solid ${colors.border}`,
            zIndex: 1050,
            overflow: 'hidden',
            padding: '4px 0',
          }}
        >
          <button
            role="menuitem"
            disabled={isLoading}
            onClick={handleCSV}
            style={menuItemStyle(loadingCSV)}
            onMouseEnter={(e) => {
              if (!isLoading)
                e.currentTarget.style.backgroundColor = colors.neutral100;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <FontAwesomeIcon icon={faFileExport} style={{ fontSize: '13px' }} />
            {loadingCSV ? 'Exportando...' : 'CSV'}
          </button>

          <button
            role="menuitem"
            disabled={isLoading}
            onClick={handlePDF}
            style={menuItemStyle(loadingPDF)}
            onMouseEnter={(e) => {
              if (!isLoading)
                e.currentTarget.style.backgroundColor = colors.neutral100;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <FontAwesomeIcon icon={faFilePdf} style={{ fontSize: '13px' }} />
            {loadingPDF ? 'Exportando...' : 'PDF'}
          </button>
        </div>
      )}
    </div>
  );
}

function menuItemStyle(active) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '9px 16px',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.neutral700,
    background: 'transparent',
    border: 'none',
    cursor: active ? 'wait' : 'pointer',
    textAlign: 'left',
    opacity: active ? 0.6 : 1,
  };
}
