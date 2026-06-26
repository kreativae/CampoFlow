import type { ReportTable } from '../report-table';

function escapeCsvCell(cell: string | number): string {
  const value = String(cell);
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(table: ReportTable): Buffer {
  const lines = [
    table.headers.map(escapeCsvCell).join(','),
    ...table.rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return Buffer.from(lines.join('\n'), 'utf-8');
}
