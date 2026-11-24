export function toCSV(rows: (string | number | undefined | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v === undefined || v === null ? '' : String(v);
          // Guard against spreadsheet formula injection and quote when needed.
          const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
          return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
        })
        .join(','),
    )
    .join('\r\n');
}

/** True when running inside the claude.ai artifact viewer (which offers its own save dialog and blocks printing). */
export const inHostedViewer = typeof window !== 'undefined' && !!(window as any).claude?.use;

export async function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([type.startsWith('text/csv') ? '\ufeff' + content : content], { type });
  if (inHostedViewer) {
    try {
      const d = await (window as any).claude.use('downloads');
      if (d) {
        await d.save({ filename, data: blob });
        return;
      }
    } catch (e: any) {
      if (e?.code === 'declined' || e?.code === 'rate_limited') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
