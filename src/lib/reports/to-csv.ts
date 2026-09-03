function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRows(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

/** One small multi-section CSV rather than a zip of several files — plenty
 * readable in a spreadsheet app, and the whole point of `reports.export`
 * is "hand this to someone in Excel", not build a reporting pipeline. */
export function buildReportsCsv(sections: { title: string; headers: string[]; rows: (string | number)[][] }[]): string {
  return sections
    .map((section) => `${section.title}\n${csvRows([section.headers, ...section.rows])}`)
    .join('\n\n');
}
