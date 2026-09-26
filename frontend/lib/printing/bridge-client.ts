import type { PrinterConfig, ReceiptData } from "./types";
import { androidPrinterStatus, hasAndroidPrintBridge, printAndroidReceipt } from "./android-bridge";
export class PrintBridgeError extends Error {}
async function receiptWithRasterLogo(receipt: ReceiptData, width: 58 | 80): Promise<ReceiptData> {
  if (!receipt.logo || receipt.logoRaster || typeof document === "undefined") return receipt;
  const image = new Image();
  image.src = receipt.logo;
  try { await image.decode(); } catch { throw new PrintBridgeError("The cafe logo could not be prepared for the thermal printer. Remove or replace it in Settings, then retry."); }
  const maxWidth = width === 58 ? 256 : 384;
  const scale = Math.min(maxWidth / image.naturalWidth, 128 / image.naturalHeight, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.floor(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new PrintBridgeError("Could not prepare the cafe logo for thermal printing.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rowBytes = Math.ceil(canvas.width / 8), raster = new Uint8Array(rowBytes * canvas.height);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const offset = (y * canvas.width + x) * 4;
    const luminance = (pixels[offset] * 299 + pixels[offset + 1] * 587 + pixels[offset + 2] * 114) / 1000;
    if (luminance < 170 && pixels[offset + 3] > 40) raster[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
  }
  let binary = "";
  for (let i = 0; i < raster.length; i += 0x8000) binary += String.fromCharCode(...raster.subarray(i, i + 0x8000));
  return { ...receipt, logoRaster: { width: canvas.width, height: canvas.height, dataBase64: btoa(binary) } };
}
async function call<T>(config: PrinterConfig, path: string, body?: unknown): Promise<T> {
  if (!config.token) throw new PrintBridgeError("Printer not configured: enter the local print bridge token in Settings → Printer.");
  let response: Response;
  try { response = await fetch(`${config.endpoint.replace(/\/$/, "")}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.token}` }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(body ? 130000 : 12000) }); }
  catch { throw new PrintBridgeError("Print bridge not running. Start the local print bridge and retry."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(data.error ?? `Printer unavailable (${response.status}).`);
    if (message.includes("configure PRINTER_DEVICE")) {
      if (config.connection === "BLUETOOTH") throw new PrintBridgeError("Bluetooth unavailable: pair the Bluetooth Classic printer with the host and configure its local serial device.");
      if (config.connection === "USB") throw new PrintBridgeError("USB printer unavailable: connect it and configure its local raw device or print port.");
    }
    if (/timed out|ECONN|EIO|No such device/i.test(message)) throw new PrintBridgeError("Printer not connected or unavailable. Check the local USB/Bluetooth pairing or printer connection.");
    throw new PrintBridgeError(message);
  }
  return data as T;
}
export async function thermalPrint(receipt: ReceiptData, config: PrinterConfig) {
  const prepared = await receiptWithRasterLogo(receipt, config.paperWidth);
  if (hasAndroidPrintBridge()) return printAndroidReceipt(prepared, config);
  return call<{ jobId: string; status: string }>(config, "/print", { printerId: config.id, paperWidth: config.paperWidth, copies: config.copies, encoding: config.encoding, connection: config.connection, receipt: prepared });
}
export async function testThermalPrinter(config: PrinterConfig) {
  if (hasAndroidPrintBridge()) return printAndroidReceipt({ businessName: "SAJHA CAFE", billNumber: "TEST", date: new Date().toISOString(), items: [{ name: "Thermal printer test", qty: 1, unitPrice: 1, total: 1 }], subtotal: 1, discount: 0, tax: 0, total: 1, paid: 1, change: 0, balance: 0, payments: [], footer: "Test print successful" }, config);
  return call<{ status: string }>(config, "/test-print", { printerId: config.id, paperWidth: config.paperWidth, connection: config.connection });
}
export async function bridgeStatus(config: PrinterConfig) {
  if (hasAndroidPrintBridge()) return { ...await androidPrinterStatus(), queueLength: 0 };
  return call<{ status: string; transport: string; queueLength: number }>(config, "/status");
}
