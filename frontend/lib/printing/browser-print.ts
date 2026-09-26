import type { ReceiptData } from "./types";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const money = (value: number) => `NPR ${Number(value).toLocaleString("en-US")}`;

function receiptDocument(receipt: ReceiptData, paperWidth: 58 | 80) {
  const rows = receipt.items.map(item => `<tr><td>${escapeHtml(item.name)}<small>${escapeHtml(item.qty)} × ${escapeHtml(money(item.unitPrice))}</small></td><td class="right">${escapeHtml(money(item.total))}</td></tr>`).join("");
  const payments = receipt.payments.map(item => `<div><span>${escapeHtml(item.method === "CASH" ? "Cash received" : `Paid (${item.method})`)}</span><span>${escapeHtml(money(item.amount))}</span></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(receipt.businessName)} receipt</title><style>
    @page { size: ${paperWidth}mm auto; margin: 0; }
    * { box-sizing: border-box; } body { width: ${paperWidth - 8}mm; margin: 4mm; color: #000; font: 12px/1.35 Arial, sans-serif; overflow-wrap: anywhere; }
    header { text-align:center; margin-bottom: 4mm; } header img { display:block; max-width:24mm; max-height:18mm; object-fit:contain; margin:0 auto 2mm; } h1 { font-size: 18px; margin: 0 0 2mm; } p { margin: 1mm 0; }
    .rule { border-top: 1px dashed #000; margin: 2mm 0; } table { border-collapse: collapse; width: 100%; table-layout: fixed; } td { vertical-align: top; padding: 1mm 0; }
    td:first-child { width: 62%; } td.right { width: 38%; text-align: right; white-space: nowrap; } small { display:block; font-size: 10px; }
    .pair, .total { display:flex; justify-content:space-between; gap:2mm; padding:1mm 0; } .total { font-size:15px; font-weight:bold; }
    footer { margin-top:4mm; text-align:center; } @media screen { body { margin: 8mm auto; padding: 3mm; border:1px solid #ddd; } }
  </style></head><body><header>${receipt.logo ? `<img alt="" src="${escapeHtml(receipt.logo)}">` : ""}<h1>${escapeHtml(receipt.businessName)}</h1>${receipt.address ? `<p>${escapeHtml(receipt.address)}</p>` : ""}${receipt.contact ? `<p>${escapeHtml(receipt.contact)}</p>` : ""}${receipt.taxNumber ? `<p>VAT/PAN: ${escapeHtml(receipt.taxNumber)}</p>` : ""}<p>Bill #${escapeHtml(receipt.billNumber)}</p>${receipt.orderNumber ? `<p>Order #${escapeHtml(receipt.orderNumber)}</p>` : ""}<p>${escapeHtml(receipt.dateText || receipt.date)}</p></header>
    <div class="rule"></div><div class="pair"><span>Table</span><strong>${escapeHtml(receipt.table || "Takeaway")}</strong></div><div class="pair"><span>Customer</span><strong>${escapeHtml(receipt.customer || "Walk-in customer")}</strong></div>
    <div class="rule"></div><table><tbody>${rows}</tbody></table><div class="rule"></div>
    <div class="pair"><span>Subtotal</span><span>${escapeHtml(money(receipt.subtotal))}</span></div><div class="pair"><span>Discount</span><span>${escapeHtml(money(receipt.discount))}</span></div><div class="pair"><span>${escapeHtml(receipt.taxLabel ?? "Tax")}</span><span>${escapeHtml(money(receipt.tax))}</span></div><div class="rule"></div>
    <div class="total"><span>Total</span><span>${escapeHtml(money(receipt.total))}</span></div>${payments || `<div class="pair"><span>Amount paid</span><span>${escapeHtml(money(receipt.paid))}</span></div>`}${receipt.balance > 0 ? `<div class="pair"><strong>Balance due</strong><strong>${escapeHtml(money(receipt.balance))}</strong></div>` : `<div class="pair"><strong>Paid in full</strong><strong>${escapeHtml(money(0))} balance</strong></div>`}${receipt.change > 0 ? `<div class="pair"><span>Change</span><span>${escapeHtml(money(receipt.change))}</span></div>` : ""}<footer>${escapeHtml(receipt.footer)}</footer></body></html>`;
}

/** System Print is a separate OS/browser dialog path; it sends no ESC/POS bytes. */
export class BrowserPrintAdapter {
  isAvailable() { return typeof window !== "undefined" && typeof window.print === "function"; }

  printReceipt(receipt: ReceiptData, paperWidth: 58 | 80, onAfterPrint?: () => void): { status: "dialog-opened" } {
    if (!this.isAvailable()) throw new Error("System Print is unavailable in this browser/device.");
    const printWindow = window.open("", "_blank");
    if (!printWindow) throw new Error("The browser blocked the print window. Allow popups for Sajha Cafe and retry.");
    printWindow.document.open();
    printWindow.document.write(receiptDocument(receipt, paperWidth));
    printWindow.document.close();
    printWindow.addEventListener("afterprint", () => { onAfterPrint?.(); printWindow.close(); }, { once: true });
    printWindow.focus();
    printWindow.print();
    return { status: "dialog-opened" };
  }
}

export const browserPrintAdapter = new BrowserPrintAdapter();
