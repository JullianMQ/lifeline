import html2canvas from "html2canvas";

type HistoryEntry = {
  time: string;
  timestamp?: string;
  lat: number;
  lng: number;
  formatted_location: string;
  sos?: boolean;
};

type PrintHistoryDocumentOptions = {
  contactName?: string;
  history: HistoryEntry[];
  captureTarget?: HTMLElement | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return match;
    }
  });
}

function buildTableRows(history: HistoryEntry[]): string {
  if (!history.length) {
    return `
      <tr>
        <td colspan="5" class="empty">No history available</td>
      </tr>
    `;
  }

  let geocodeCache: Record<string, string> = {};
  try {
    const raw = localStorage.getItem("lifeline:geocode");
    if (raw) {
      geocodeCache = JSON.parse(raw) as Record<string, string>;
    }
  } catch {
    geocodeCache = {};
  }

  let cacheUpdated = false;
  const rowsHtml = history
    .map((row) => {
      const formattedLocation = resolveFormattedLocationCached(
        row,
        geocodeCache,
        () => {
          cacheUpdated = true;
        }
      );
      const dateValue = row.timestamp ? new Date(row.timestamp).toLocaleDateString() : "";
      const rowClass = row.sos ? "sos-row" : "";
      return `<tr class="${rowClass}">
            <td>${escapeHtml(dateValue)}</td>
            <td>${escapeHtml(row.time)}</td>
            <td>${escapeHtml(String(row.lat))}</td>
            <td>${escapeHtml(String(row.lng))}</td>
            <td>${escapeHtml(formattedLocation)}</td>
          </tr>`;
    })
    .join("");

  if (cacheUpdated) {
    try {
      localStorage.setItem("lifeline:geocode", JSON.stringify(geocodeCache));
    } catch {
      // Ignore storage errors (quota, disabled, etc.)
    }
  }

  return rowsHtml;
}

function resolveFormattedLocationCached(
  row: HistoryEntry,
  cache: Record<string, string>,
  onUpdate: () => void
): string {
  const rawLocation = row.formatted_location?.trim();
  const roundedKey = `${row.lat.toFixed(6)},${row.lng.toFixed(6)}`;
  const rawKey = `${row.lat},${row.lng}`;

  if (rawLocation) {
    cache[roundedKey] = rawLocation;
    cache[rawKey] = rawLocation;
    onUpdate();
    return rawLocation;
  }

  return cache[roundedKey] ?? cache[rawKey] ?? "";
}

async function captureFixedLayoutScreenshot(
  element: HTMLElement,
  opts?: { width?: number; height?: number; scale?: number }
): Promise<string> {
  const width = opts?.width ?? 1024;  
  const height = opts?.height ?? 768;
  const scale = opts?.scale ?? 1;

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.setAttribute("aria-hidden", "true");

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = "100%";
  clone.style.height = "100%";

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      scale,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
    });

    return canvas.toDataURL("image/png");
  } finally {
    document.body.removeChild(wrapper);
  }
}

function buildDocumentHtml({
  screenshotUrl,
  reportTitle,
  generatedAt,
  tableRowsHtml,
  headerName,
}: {
  screenshotUrl: string;
  reportTitle: string;
  generatedAt: string;
  tableRowsHtml: string;
  headerName: string;
}): string {
  const headerHtml = `
    <header class="doc-header">
      <div class="doc-header-name">${escapeHtml(headerName)}</div>
      <div class="doc-header-brand">Lifeline</div>
      <div class="doc-header-date">${escapeHtml(generatedAt)}</div>
    </header>
  `;

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(reportTitle)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; padding: 24px; color: #111; }
          h1 { font-size: 20px; margin: 0 0 8px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 16px; }

          @page { size: A4 portrait; margin: 12mm; }

          .page { break-after: page; page-break-after: always; }
          .page:last-child { break-after: auto; page-break-after: auto; }

          .doc-header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: baseline;
            border-bottom: 1px solid #e2e2e2;
            margin-bottom: 16px;
            padding-bottom: 8px;
          }
          .doc-header-name { font-weight: 600; font-size: 14px; }
          .doc-header-brand { font-weight: 700; font-size: 16px; letter-spacing: 0.04em; text-transform: uppercase; }
          .doc-header-date { font-size: 12px; color: #666; }

          .screenshot img {
            width: 100%;
            height: auto;
            border: 1px solid #ddd;
            display: block;
            margin: 0 auto;
          }

          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f3f3f3; }
          .empty { text-align: center; color: #666; }
          .sos-row td { background: #D9D9D9; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <section class="page screenshot">
          ${headerHtml}
          <img src="${escapeHtml(screenshotUrl)}" alt="Device screen capture" />
        </section>

        <section class="page">
          ${headerHtml}
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Lat</th>
                <th>Lng</th>
                <th>Formatted Location</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </section>
      </body>
    </html>`;
}

function waitForImages(printDocument: Document, onComplete: () => void, timeoutMs = 10_000) {
  const images = Array.from(printDocument.images);
  if (images.length === 0) {
    onComplete();
    return;
  }

  let loaded = 0;
  let completed = false;  
  const finish = () => {  
    if (completed) return;  
    completed = true;  
    onComplete();  
  };  
  const timer = setTimeout(finish, timeoutMs); 

  images.forEach((image) => {  
    if (image.complete) {  
      loaded += 1;  
      if (loaded === images.length) {  
        clearTimeout(timer);  
        finish();  
      } return;  
    }  
     image.onload = image.onerror = () => {  
       loaded += 1;  
       if (loaded === images.length) {  
         clearTimeout(timer);  
         finish();  
       }  
     };  
   });  
}

export async function printHistoryDocument({  
  contactName,  
  history,  
  captureTarget,  
}: PrintHistoryDocumentOptions): Promise<void> {  
  const target = captureTarget ?? document.getElementById("root") ?? document.body;  
  if (!target) return;  

  try {  
    const screenshotUrl = await captureFixedLayoutScreenshot(target, {  
      width: 820,  
      height: 1180,  
      scale: 2,  
    });  

    const reportTitle = "LIFELINE";  
    const headerName = contactName || "Contact";  
    const generatedAt = new Date().toLocaleString();  
    const tableRowsHtml = buildTableRows(history);  

    const html = buildDocumentHtml({  
      screenshotUrl,  
      reportTitle,  
      generatedAt,  
      tableRowsHtml,  
      headerName,  
    });  

    const printFrame = document.createElement("iframe");  
    printFrame.style.position = "fixed";  
    printFrame.style.right = "0";  
    printFrame.style.bottom = "0";  
    printFrame.style.width = "0";  
    printFrame.style.height = "0";  
    printFrame.style.border = "0";  
    printFrame.setAttribute("aria-hidden", "true");  
    document.body.appendChild(printFrame);  

    const frameDocument = printFrame.contentDocument;  
    const frameWindow = printFrame.contentWindow;  
    if (!frameDocument || !frameWindow) {  
      document.body.removeChild(printFrame);  
      return;  
    }  

    frameDocument.open();  
    frameDocument.write(html);  
    frameDocument.close();  

    await new Promise<void>((resolve) => {  
      waitForImages(frameDocument, () => {  
        frameWindow.focus();  
        const cleanup = () => {  
          printFrame.parentNode?.removeChild(printFrame);  
          resolve();  
        };  
        frameWindow.addEventListener("afterprint", cleanup, { once: true });  
        frameWindow.print();  
        setTimeout(cleanup, 60_000);  
      });  
    });  
  } catch (error) {  
    console.error("Failed to generate printable document.", error);  
  }  
}
