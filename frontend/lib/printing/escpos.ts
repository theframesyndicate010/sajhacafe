import type { ReceiptData } from "./types";
const ESC = 0x1b, GS = 0x1d;
export function formatEscPos(receipt: ReceiptData, width: 58 | 80, encoding: "utf-8" | "ascii" = "utf-8"): Uint8Array {
  // Font B fits a true four-column item row at the narrow 58mm width.
  const cols = width === 58 ? 42 : 64;
  const itemWidths = width === 58 ? [13, 3, 13, 10] : [26, 4, 18, 13];
  const enc = new TextEncoder(); const chunks: number[] = [];
  const bytes = (s: string) => { const value = encoding === "ascii" ? s.normalize("NFKD").replace(/[^\x20-\x7e]/g, "?") : s; chunks.push(...enc.encode(value)); };
  const cmd = (...v: number[]) => chunks.push(...v);
  const money = (n: number) => `NPR ${Number(n).toLocaleString()}`;
  const line = (s = "") => { const chars = Array.from(s); for (let i = 0; i < chars.length; i += cols) { bytes(chars.slice(i, i + cols).join("")); bytes("\n"); } if (!chars.length) bytes("\n"); };
  const wrapText = (value: string, max: number) => {
    const lines: string[] = []; let current = "";
    for (const word of value.trim().split(/\s+/)) {
      if (Array.from(word).length > max) {
        if (current) { lines.push(current); current = ""; }
        const chars = Array.from(word);
        for (let i = 0; i < chars.length; i += max) lines.push(chars.slice(i, i + max).join(""));
      } else if (!current) current = word;
      else if (Array.from(current).length + 1 + Array.from(word).length <= max) current += ` ${word}`;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };
  const pair = (a: string, b: string) => { const right = Array.from(b).slice(-cols).join(""); const left = Array.from(a); while (left.length > cols - Array.from(right).length - 1) line(left.splice(0, cols - Array.from(right).length - 1).join("")); const label = left.join(""); line(label + " ".repeat(Math.max(1, cols - Array.from(label).length - Array.from(right).length)) + right); };
  const tableRow = (cells: string[]) => cells.map((value, index) => {
    const characters = Array.from(value);
    if (index === 1) return value.padStart(Math.ceil(itemWidths[index] / 2) + Math.ceil(characters.length / 2)).padEnd(itemWidths[index]);
    return index > 1 ? value.padStart(itemWidths[index]) : value.padEnd(itemWidths[index]);
  }).join(" ");
  cmd(ESC, 0x40, ESC, 0x4d, 1, ESC, 0x61, 1);
  if (receipt.logoRaster) {
    const raster = Uint8Array.from(atob(receipt.logoRaster.dataBase64), character => character.charCodeAt(0));
    const rowBytes = Math.ceil(receipt.logoRaster.width / 8), width = rowBytes;
    cmd(GS, 0x76, 0x30, 0, width & 0xff, width >> 8, receipt.logoRaster.height & 0xff, receipt.logoRaster.height >> 8);
    chunks.push(...raster, 10);
  }
  cmd(ESC, 0x45, 1); line(receipt.businessName); cmd(ESC, 0x45, 0);
  if (receipt.address) line(receipt.address); if (receipt.contact) line(receipt.contact); if (receipt.taxNumber) line(`VAT/PAN: ${receipt.taxNumber}`);
  line(`Bill #${receipt.billNumber}`); line(receipt.dateText || new Date(receipt.date).toLocaleString());
  cmd(ESC, 0x61, 0);
  line("- ".repeat(Math.ceil(cols / 2)));
  pair("Bill:", receipt.billNumber); pair("Table:", receipt.table || "Takeaway"); pair("Customer:", receipt.customer || "Walk-in customer");
  cmd(ESC, 0x45, 1); line(tableRow(["Item", "Qty", "Unit price", "Amount"])); cmd(ESC, 0x45, 0); line(". ".repeat(Math.ceil(cols / 2)));
  receipt.items.forEach(i => {
    const unitPrice = money(i.unitPrice), amount = money(i.total), qty = String(i.qty);
    if (qty.length > itemWidths[1] || unitPrice.length > itemWidths[2] || amount.length > itemWidths[3]) {
      line(i.name); pair("Qty", qty); pair("Unit price", unitPrice); pair("Amount", amount);
    } else if (Array.from(i.name).length > itemWidths[0]) {
      wrapText(i.name, cols).forEach(line);
      line(tableRow(["", qty, unitPrice, amount]));
    } else line(tableRow([i.name, qty, unitPrice, amount]));
  });
  pair("Subtotal", money(receipt.subtotal)); pair("Discount", money(receipt.discount)); pair("Tax (included in price)", money(receipt.tax));
  line("- ".repeat(Math.ceil(cols / 2))); cmd(ESC, 0x45, 1, GS, 0x21, 1); pair("Total", money(receipt.total)); cmd(GS, 0x21, 0, ESC, 0x45, 0);
  pair("Amount paid", money(receipt.paid));
  if (receipt.balance > 0) { cmd(ESC, 0x45, 1); pair("Balance due", money(receipt.balance)); cmd(ESC, 0x45, 0); }
  else { pair("Paid in full", "NPR 0 balance"); }
  if (receipt.change > 0) pair("Change", money(receipt.change));
  cmd(ESC,0x61,1); line(""); line(receipt.footer); line(""); line(""); cmd(GS,0x56,0x42,0); return new Uint8Array(chunks);
}
