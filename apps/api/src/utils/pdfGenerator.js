import PDFDocument from 'pdfkit';

/**
 * Gera um PDF com título, período, tabela de dados e totalizadores
 * @param {object} opts
 * @param {string} opts.titulo
 * @param {string} [opts.periodo]
 * @param {string[]} opts.colunas - nomes das colunas
 * @param {string[][]} opts.linhas - array de arrays de strings
 * @param {Array<{label: string, value: string}>} [opts.totalizadores]
 * @returns {Promise<Buffer>}
 */
export function gerarPDF({ titulo, periodo, colunas, linhas, totalizadores }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 80; // left+right margin = 80

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text(titulo, { align: 'center' });

    if (periodo) {
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').fillColor('#555555').text(`Período: ${periodo}`, { align: 'center' });
    }

    doc.moveDown(0.8);
    doc.fillColor('#000000');

    // Table
    if (colunas.length > 0) {
      const colWidth = pageWidth / colunas.length;
      const rowHeight = 20;
      const headerHeight = 22;
      let y = doc.y;

      // Header background
      doc.rect(40, y, pageWidth, headerHeight).fill('#2563eb');

      // Header text
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
      colunas.forEach((col, i) => {
        doc.text(col, 40 + i * colWidth + 4, y + 6, {
          width: colWidth - 8,
          ellipsis: true,
          lineBreak: false,
        });
      });

      y += headerHeight;

      // Rows
      doc.fontSize(8).font('Helvetica');
      linhas.forEach((row, rowIndex) => {
        if (y + rowHeight > doc.page.height - 80) {
          doc.addPage();
          y = 40;
        }

        const bg = rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(40, y, pageWidth, rowHeight).fill(bg);

        doc.fillColor('#111827');
        row.forEach((cell, i) => {
          doc.text(String(cell ?? ''), 40 + i * colWidth + 4, y + 5, {
            width: colWidth - 8,
            ellipsis: true,
            lineBreak: false,
          });
        });

        y += rowHeight;
      });

      // Bottom border of table
      doc.rect(40, y, pageWidth, 1).fill('#e5e7eb');
      doc.y = y + 4;
    }

    // Totalizadores
    if (totalizadores && totalizadores.length > 0) {
      doc.moveDown(0.8);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('Resumo:', 40);
      doc.moveDown(0.3);

      totalizadores.forEach((tot) => {
        doc.fontSize(10).font('Helvetica').fillColor('#374151');
        doc.text(`${tot.label}: `, 40, doc.y, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#111827').text(tot.value);
      });
    }

    // Footer
    doc.moveDown(1.5);
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#9ca3af')
      .text(`Gerado em ${new Date().toLocaleString('pt-BR')} — Finlly`, { align: 'center' });

    doc.end();
  });
}
