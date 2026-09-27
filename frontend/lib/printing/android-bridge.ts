import { formatEscPos } from "./escpos";
import type { PrinterConfig, ReceiptData } from "./types";

type AndroidPrinter = { id: string; name: string; address?: string };
type NativeWindow = Window & { SajhaNative?: { postMessage: (message: string) => void; addEventListener: (type: "message", listener: (event: MessageEvent<string>) => void) => void; removeEventListener: (type: "message", listener: (event: MessageEvent<string>) => void) => void } };

export type PairedAndroidPrinter = { address: string; name: string };

export function hasAndroidPrintBridge(): boolean {
  return typeof window !== "undefined" && Boolean((window as NativeWindow).SajhaNative);
}

function request<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const bridge = (window as NativeWindow).SajhaNative;
  if (!bridge) return Promise.reject(new Error("Android Bluetooth printing is available only in the Sajha Cafe Android app."));
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => { bridge.removeEventListener("message", onMessage); reject(new Error("Android printer request timed out. Check Bluetooth and retry.")); }, action === "print" ? 130000 : 25000);
    const onMessage = (event: MessageEvent<string>) => {
      let response: { requestId?: string; ok?: boolean; result?: T; error?: string };
      try { response = JSON.parse(String(event.data)); } catch { return; }
      if (response.requestId !== requestId) return;
      window.clearTimeout(timeout);
      bridge.removeEventListener("message", onMessage);
      if (response.ok) resolve(response.result as T);
      else reject(new Error(response.error || "Android print bridge failed."));
    };
    bridge.addEventListener("message", onMessage);
    bridge.postMessage(JSON.stringify({ requestId, action, ...payload }));
  });
}

export function listPairedDevices(): Promise<PairedAndroidPrinter[]> {
  return request<{ printers: AndroidPrinter[] }>("listPrinters").then((result) =>
    result.printers
      .map((printer) => ({ address: String(printer.address ?? printer.id).trim(), name: String(printer.name ?? "Bluetooth printer").trim() }))
      .filter((printer) => Boolean(printer.address))
  );
}

export function listAndroidPrinters() {
  return listPairedDevices().then((printers) => printers.map((printer) => ({ id: printer.address, name: printer.name, address: printer.address })));
}

export function selectAndroidPrinter(printerId: string) {
  return request<{ selected: boolean; id: string; name: string; address?: string }>("selectPrinter", { printerId });
}

export function connectAndroidPrinter(printerIdOrAddress: string) {
  return request<{ connected: boolean; status: string; printerId: string; printerName: string; address?: string }>("connect", { printerId: printerIdOrAddress, address: printerIdOrAddress });
}

export function disconnectAndroidPrinter() { return request<{ status: string }>("disconnect"); }
export function androidPrinterStatus() { return request<{ connected?: boolean; status: string; transport: string; printerId?: string; printerName?: string; address?: string }>("status"); }
export function getAndroidPrinterStatus() { return androidPrinterStatus(); }

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export async function printAndroidReceipt(receipt: ReceiptData, config: PrinterConfig) {
  const targetAddress = config.address ?? config.id ?? "";
  if (!targetAddress || targetAddress === "default") throw new Error("Connect the XP-C2008 on this Android device before printing.");
  const bytes = formatEscPos(receipt, config.paperWidth, config.encoding);
  return request<{ accepted: boolean; status: string; printerName: string }>("print", { printerId: targetAddress, address: targetAddress, dataBase64: encodeBase64(bytes), copies: config.copies });
}
