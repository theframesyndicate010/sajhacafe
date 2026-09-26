import type { PrinterConfig, ReceiptData } from "./types";
import { androidPrinterStatus, hasAndroidPrintBridge, printAndroidReceipt } from "./android-bridge";
import { printWebReceipt } from "./web-printer";
import { formatEscPos } from "./escpos";
import { testReceipt } from "./sample-receipts";
export type PrintBridgeErrorCode = "not-configured" | "unreachable" | "authentication" | "origin" | "printer-not-found" | "printer-busy" | "printer-connection" | "bridge";
export class PrintBridgeError extends Error {
  constructor(message: string, readonly code: PrintBridgeErrorCode = "bridge") { super(message); this.name = "PrintBridgeError"; }
}
function asBase64(bytes: Uint8Array) { let value = ""; for (let index = 0; index < bytes.length; index += 0x8000) value += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(value); }
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
  if (!config.token) throw new PrintBridgeError("Local print bridge pairing is not configured. Enter this bridge installation's token in Printer Settings.", "not-configured");
  if (!config.endpoint.trim()) throw new PrintBridgeError("Local print bridge URL is missing from Printer Settings.", "not-configured");
  let response: Response;
  try { response = await fetch(`${config.endpoint.replace(/\/$/, "")}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.token}` }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(body ? 130000 : 12000) }); }
  catch (error) {
    const detail = error instanceof DOMException && error.name === "TimeoutError" ? "The local print bridge request timed out." : "Could not reach the local print bridge.";
    throw new PrintBridgeError(`${detail} Check that it is running at ${config.endpoint}, allow Sajha Cafe local-network access, verify the bridge PWA_ORIGIN matches this site's exact origin, and retry. On a phone, 127.0.0.1 refers to the phone itself; a desktop bridge must run on the same device as the browser.`, "unreachable");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(data.error ?? `Printer unavailable (${response.status}).`);
    if (response.status === 401) throw new PrintBridgeError("Local print bridge authentication failed. Check that the token in Sajha matches this bridge installation's token.", "authentication");
    if (response.status === 403 && /origin/i.test(message)) throw new PrintBridgeError("This Sajha Cafe site is not allowed by the local bridge. Set PWA_ORIGIN to this exact site origin, restart the bridge, and retry.", "origin");
    if (response.status === 404) throw new PrintBridgeError("The local print bridge URL is reachable, but its API path was not found. Check the bridge URL and version.", "bridge");
    const code = String(data.code ?? "");
    if (code === "printer_not_found") throw new PrintBridgeError(message, "printer-not-found");
    if (code === "printer_busy") throw new PrintBridgeError(message, "printer-busy");
    if (code === "printer_connection") throw new PrintBridgeError(message, "printer-connection");
    if (code === "not_configured") throw new PrintBridgeError(message, "not-configured");
    throw new PrintBridgeError(message, "bridge");
  }
  return data as T;
}
export async function connectPrintBridge(config: PrinterConfig) {
  return call<{ status: "ready"; transport: string; message: string }>(config, "/connect", { connection: config.connection });
}
export async function thermalPrint(receipt: ReceiptData, config: PrinterConfig) {
  const prepared = await receiptWithRasterLogo(receipt, config.paperWidth);
  if (hasAndroidPrintBridge()) return printAndroidReceipt(prepared, config);
  if (config.connection === "USB" || config.connection === "WEB_BLUETOOTH" || config.connection === "WEB_SERIAL") return printWebReceipt(prepared, config);
  const data = formatEscPos(prepared, config.paperWidth, config.encoding);
  return call<{ jobId: string; status: string }>(config, "/print", { printerId: config.id, paperWidth: config.paperWidth, copies: config.copies, encoding: config.encoding, connection: config.connection, dataBase64: asBase64(data) });
}
export async function testThermalPrinter(config: PrinterConfig) {
  const receipt = testReceipt(config);
  if (hasAndroidPrintBridge()) return printAndroidReceipt(receipt, config);
  if (config.connection === "USB" || config.connection === "WEB_BLUETOOTH" || config.connection === "WEB_SERIAL") return printWebReceipt(receipt, config);
  const data = formatEscPos(receipt, config.paperWidth, config.encoding);
  return call<{ status: string }>(config, "/test-print", { printerId: config.id, paperWidth: config.paperWidth, copies: config.copies, connection: config.connection, dataBase64: asBase64(data) });
}
export async function bridgeStatus(config: PrinterConfig) {
  if (hasAndroidPrintBridge()) return { ...await androidPrinterStatus(), queueLength: 0 };
  return call<{ status: string; transport: string; queueLength: number }>(config, "/status");
}
