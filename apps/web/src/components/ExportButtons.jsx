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
        <FontAwesomeIcon
          icon={faFileExport}
          style={{ marginRight: '6px', visibility: loadingCSV ? 'hidden' : 'visible' }}
        />
        {loadingCSV ? 'Exportando...' : 'CSV'}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onExportPDF}
        loading={loadingPDF}
        title="Exportar PDF"
      >
        <FontAwesomeIcon
          icon={faFilePdf}
          style={{ marginRight: '6px', visibility: loadingPDF ? 'hidden' : 'visible' }}
        />
        {loadingPDF ? 'Exportando...' : 'PDF'}
      </Button>
    </>
  );
}
