import ExcelJS from 'exceljs';
import type { ReportTable } from '../report-table';

export async function toXlsx(table: ReportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(table.title.slice(0, 31));

  sheet.addRow(table.headers).font = { bold: true };
  table.rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((column) => {
    column.width = 20;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
