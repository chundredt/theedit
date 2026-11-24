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
  // On phones, the share sheet lets you "Save to Files" (iCloud Drive) — more reliable than a download in a home-screen app.
  try {
    const file = new File([blob], filename, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (matchMedia('(pointer: coarse)').matches && nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return; // you closed the share sheet
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
