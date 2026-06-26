import PDFDocument from 'pdfkit';
import type { ReportTable } from '../report-table';

const COLUMN_WIDTH = 110;
const ROW_HEIGHT = 20;

export function toPdf(table: ReportTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      layout: 'landscape',
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(table.title, { underline: true });
    doc.moveDown();

    let y = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    table.headers.forEach((header, i) => {
      doc.text(String(header), doc.page.margins.left + i * COLUMN_WIDTH, y, {
        width: COLUMN_WIDTH,
      });
    });

    doc.font('Helvetica');
    table.rows.forEach((row) => {
      y += ROW_HEIGHT;
      if (y > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      row.forEach((cell, i) => {
        doc.text(String(cell), doc.page.margins.left + i * COLUMN_WIDTH, y, {
          width: COLUMN_WIDTH,
        });
      });
    });

    doc.end();
  });
}
