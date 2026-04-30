export function openPdfPreview(params: {
  bytes: Uint8Array;
  fallbackDownloadName: string;
}): void {
  const { bytes, fallbackDownloadName } = params;
  const normalized = new Uint8Array(bytes);
  const blob = new Blob([normalized], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  // Open print-ready PDF preview in a new tab when allowed.
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Popup blocked: fall back to direct download so users still get the report.
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackDownloadName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
