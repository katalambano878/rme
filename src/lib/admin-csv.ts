'use client';

/**
 * Quotes one CSV field (RFC 4180) and neutralises spreadsheet formulas: values that start
 * with = + - @ (or a tab / carriage return) get a leading ' so Excel/Sheets treat them as text.
 * Real numbers are left alone so negative quantities stay numeric.
 */
export function csvField(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Builds a CSV document (CRLF line endings) from a header row and data rows. */
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n');
}

/** Triggers a browser download of CSV text. */
export function downloadCsv(filename: string, rows: unknown[][]): void {
  // BOM so Excel opens UTF-8 names (e.g. GH₵) correctly.
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
