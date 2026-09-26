import type { ReceiptData } from "./types";

const ESC = 0x1b;
const GS = 0x1d;
const decoder = new TextEncoder();

function receiptHasUnicode(receipt: ReceiptData) {
  const values = [receipt.businessName, receipt.address, receipt.contact, receipt.taxNumber, receipt.table, receipt.customer, receipt.footer, receipt.billNumber, receipt.orderNumber, receipt.dateText,
    ...receipt.items.map(item => item.name), ...receipt.payments.flatMap(payment => [payment.method, payment.reference])];
  return values.some(value => value && /[^\x00-\x7f]/.test(value));
}

function wrap(value: string, max: number) {
  const result: string[] = [];
  let current = "";
  for (const word of value.trim().split(/\s+/).filter(Boolean)) {
    const chars = Array.from(word);
    if (chars.length > max) {
      if (current) result.push(current);
      current = "";
      for (let index = 0; index < chars.length; index += max) result.push(chars.slice(index, index + max).join(""));
    } else if (!current) current = word;
    else if (Array.from(current).length + chars.length + 1 <= max) current += ` ${word}`;
    else { result.push(current); current = word; }
  }
  if (current) result.push(current);
  return result.length ? result : [""];
}

function receiptText(receipt: ReceiptData, columns: number) {
  const lines: string[] = [];
  const line = (value = "") => wrap(value, columns).forEach(part => lines.push(part));
  const money = (amount: number) => `NPR ${Number(amount).toLocaleString("en-US")}`;
  const pair = (label: string, value: string) => {
    const right = Array.from(value).slice(-columns).join("");
    const labelLines = wrap(label, Math.max(1, columns - Array.from(right).length - 1));
    labelLines.slice(0, -1).forEach(line);
    const last = labelLines.at(-1) ?? "";
    lines.push(`${last}${" ".repeat(Math.max(1, columns - Array.from(last).length - Array.from(right).length))}${right}`);
  };
  const separator = "-".repeat(columns);
  wrap(receipt.businessName.toLocaleUpperCase(), columns === 42 ? 21 : 32).forEach(part => lines.push(part));
  if (receipt.address) line(receipt.address);
  if (receipt.contact) line(receipt.contact);
  if (receipt.taxNumber) line(`VAT/PAN: ${receipt.taxNumber}`);
  line(`Bill #${receipt.billNumber}`);
  if (receipt.orderNumber) line(`Order #${receipt.orderNumber}`);
  line(receipt.dateText || new Date(receipt.date).toLocaleString());
  lines.push(separator);
  pair("Table", receipt.table || "Takeaway");
  pair("Customer", receipt.customer || "Walk-in customer");
  lines.push(separator);
  const widths = columns === 42 ? [13, 3, 13, 10] : [23, 4, 17, 17];
  const row = (cells: string[]) => [
    cells[0].padEnd(widths[0]), cells[1].padStart(widths[1]), cells[2].padStart(widths[2]), cells[3].padStart(widths[3]),
  ].join(" ");
  lines.push(row(["ITEM", "QTY", "PRICE", "AMOUNT"]));
  lines.push(separator);
  for (const item of receipt.items) {
    const qty = String(item.qty);
    const unitPrice = money(item.unitPrice);
    const amount = money(item.total);
    if (qty.length > widths[1] || unitPrice.length > widths[2] || amount.length > widths[3]) {
      line(item.name); pair("Qty", qty); pair("Unit price", unitPrice); pair("Amount", amount);
    } else {
      const nameLines = wrap(item.name, widths[0]);
      if (nameLines.length > 1) {
        nameLines.forEach(line);
        lines.push(row(["", qty, unitPrice, amount]));
      } else lines.push(row([nameLines[0], qty, unitPrice, amount]));
    }
  }
  lines.push(separator);
  pair("Subtotal", money(receipt.subtotal));
  pair("Discount", money(receipt.discount));
  pair(receipt.taxLabel ?? "Tax", money(receipt.tax));
  lines.push(separator);
  pair("TOTAL", money(receipt.total));
  for (const payment of receipt.payments) pair(payment.method === "CASH" ? "Cash received" : `Paid (${payment.method})`, money(payment.amount));
  if (!receipt.payments.length) pair("Amount paid", money(receipt.paid));
  if (receipt.balance > 0) pair("Balance due", money(receipt.balance));
  else pair("Paid in full", `${money(0)} balance`);
  if (receipt.change > 0) pair("Change", money(receipt.change));
  line("");
  line(receipt.footer);
  return lines;
}

function rasterReceipt(receipt: ReceiptData, paperWidth: 58 | 80): Uint8Array {
  if (typeof document === "undefined") throw new Error("This receipt contains Unicode text. Use a browser, Android app, or local bridge that supports receipt rasterization.");
  const pixelWidth = paperWidth === 58 ? 384 : 576;
  const columns = paperWidth === 58 ? 42 : 64;
  const lines = receiptText(receipt, columns);
  const titleLines = wrap(receipt.businessName.toLocaleUpperCase(), columns === 42 ? 21 : 32).length;
  const canvas = document.createElement("canvas");
  const lineHeight = 27;
  canvas.width = pixelWidth;
  canvas.height = Math.max(1, lines.length * lineHeight + 12);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not rasterize Unicode receipt text.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000";
  context.textBaseline = "top";
  context.font = "16px 'Noto Sans Devanagari', 'Noto Sans', sans-serif";
  const headerEnd = lines.indexOf("-".repeat(columns));
  lines.forEach((text, index) => {
    if (index < titleLines) context.font = "bold 24px 'Noto Sans Devanagari', 'Noto Sans', sans-serif";
    else if (text.startsWith("TOTAL")) context.font = "bold 18px 'Noto Sans Devanagari', 'Noto Sans', sans-serif";
    else if (["ITEM", "-".repeat(columns)].includes(text)) context.font = "bold 16px 'Noto Sans Devanagari', 'Noto Sans', sans-serif";
    else context.font = "16px 'Noto Sans Devanagari', 'Noto Sans', sans-serif";
    const centered = index < headerEnd;
    context.textAlign = centered ? "center" : "left";
    context.fillText(text, centered ? pixelWidth / 2 : 2, 4 + index * lineHeight, pixelWidth - 4);
  });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rowBytes = Math.ceil(pixelWidth / 8);
  const packed = new Uint8Array(rowBytes * canvas.height);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < pixelWidth; x++) {
    const offset = (y * pixelWidth + x) * 4;
    const luminance = (pixels[offset] * 299 + pixels[offset + 1] * 587 + pixels[offset + 2] * 114) / 1000;
    if (luminance < 165) packed[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
  }
  const result: number[] = [ESC, 0x40, ESC, 0x61, 0];
  if (receipt.logoRaster) {
    const raster = Uint8Array.from(atob(receipt.logoRaster.dataBase64), character => character.charCodeAt(0));
    const rowBytes = Math.ceil(receipt.logoRaster.width / 8);
    result.push(GS, 0x76, 0x30, 0, rowBytes & 0xff, rowBytes >> 8, receipt.logoRaster.height & 0xff, receipt.logoRaster.height >> 8, ...raster, 10);
  }
  // GS v 0 raster bit image; unlike a UTF-8 code page this preserves Nepali glyphs.
  for (let top = 0; top < canvas.height; top += 128) {
    const height = Math.min(128, canvas.height - top);
    const band = packed.subarray(top * rowBytes, (top + height) * rowBytes);
    result.push(GS, 0x76, 0x30, 0, rowBytes & 0xff, rowBytes >> 8, height & 0xff, height >> 8, ...band);
  }
  result.push(10, 10, 10, GS, 0x56, 0x42, 0);
  return new Uint8Array(result);
}

export function formatEscPos(receipt: ReceiptData, paperWidth: 58 | 80, encoding: "utf-8" | "ascii" = "utf-8"): Uint8Array {
  if (receiptHasUnicode(receipt)) return rasterReceipt(receipt, paperWidth);
  const columns = paperWidth === 58 ? 42 : 64;
  const lines = receiptText(receipt, columns);
  const chunks: number[] = [ESC, 0x40, ESC, 0x4d, 1, ESC, 0x61, 1];
  if (receipt.logoRaster) {
    const raster = Uint8Array.from(atob(receipt.logoRaster.dataBase64), character => character.charCodeAt(0));
    const rowBytes = Math.ceil(receipt.logoRaster.width / 8);
    chunks.push(GS, 0x76, 0x30, 0, rowBytes & 0xff, rowBytes >> 8, receipt.logoRaster.height & 0xff, receipt.logoRaster.height >> 8, ...raster, 10);
  }
  const bytes = (value: string) => {
    const output = encoding === "ascii" ? value.replace(/[^\x00-\x7f]/g, "?") : value;
    chunks.push(...decoder.encode(output));
  };
  const titleParts = wrap(receipt.businessName.toLocaleUpperCase(), paperWidth === 58 ? 21 : 32);
  chunks.push(ESC, 0x45, 1, GS, 0x21, 0x11);
  for (const part of titleParts) { bytes(part); bytes("\n"); }
  chunks.push(GS, 0x21, 0, ESC, 0x45, 0, ESC, 0x61, 0);
  const separatorIndex = lines.findIndex(value => value === "-".repeat(columns));
  const headingLines = lines.slice(titleParts.length, separatorIndex);
  headingLines.forEach(value => { bytes(value); bytes("\n"); });
  const bodyLines = lines.slice(separatorIndex);
  for (const value of bodyLines) {
    if (value.startsWith("ITEM")) chunks.push(ESC, 0x45, 1);
    if (value.startsWith("TOTAL")) chunks.push(ESC, 0x45, 1, GS, 0x21, 0x10);
    bytes(value); bytes("\n");
    if (value.startsWith("ITEM")) chunks.push(ESC, 0x45, 0);
    if (value.startsWith("TOTAL")) chunks.push(GS, 0x21, 0, ESC, 0x45, 0);
  }
  chunks.push(GS, 0x56, 0x42, 0);
  return new Uint8Array(chunks);
}
