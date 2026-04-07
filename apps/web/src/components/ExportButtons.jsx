import { Button } from '../design-system/index.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport, faFilePdf } from '@fortawesome/free-solid-svg-icons';

export default function ExportButtons({
  onExportCSV,
  onExportPDF,
  loadingCSV = false,
  loadingPDF = false,
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onExportCSV}
        loading={loadingCSV}
        title="Exportar CSV"
      >
        {!loadingCSV && <FontAwesomeIcon icon={faFileExport} style={{ marginRight: '6px' }} />}
        {loadingCSV ? 'Exportando...' : 'CSV'}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onExportPDF}
        loading={loadingPDF}
        title="Exportar PDF"
      >
        {!loadingPDF && <FontAwesomeIcon icon={faFilePdf} style={{ marginRight: '6px' }} />}
        {loadingPDF ? 'Exportando...' : 'PDF'}
      </Button>
    </>
  );
}
