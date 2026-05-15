export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatForPrint(text: string): string {
  return escapeHtml(text)
    .replace(/\[(\d+)\]/g, '<sup style="color:#6366f1;font-size:10px;">[$1]</sup>')
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

export function printHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    try { iframe.remove(); } catch (_) {}
    return;
  }

  let cleaned = false;
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = null; }
    try {
      if (iframe.isConnected) iframe.remove();
    } catch (_) {}
  };

  doc.open();
  doc.write(html);
  doc.close();

  let printTriggered = false;

  const triggerPrint = () => {
    if (printTriggered) return;
    printTriggered = true;

    const images = doc.querySelectorAll("img");
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    });

    Promise.all(imagePromises).then(() => {
      setTimeout(() => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.onafterprint = cleanup;
          }
          iframe.contentWindow?.print();
        } catch (_) {}
        cleanupTimer = setTimeout(cleanup, 3000);
      }, 300);
    });
  };

  iframe.onload = () => {
    triggerPrint();
  };

  if (doc.readyState === "complete") {
    triggerPrint();
  }
}
