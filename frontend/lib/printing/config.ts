import { DEFAULT_PRINTER_CONFIG, type PrinterConfig } from "./types";
const KEY = "sajha.printer.config.v1";

type NativeWindow = Window & { SajhaNative?: unknown };

export function isAndroidBrowser(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function sanitizePrinterConfig(config: PrinterConfig): PrinterConfig {
  const sanitized = { ...DEFAULT_PRINTER_CONFIG, ...config, endpoint: String(config?.endpoint ?? "").trim(), token: String(config?.token ?? "") };
  const nativeWindow = typeof window !== "undefined" ? (window as NativeWindow) : undefined;
  if (isAndroidBrowser() && !nativeWindow?.SajhaNative) {
    const prefersSerial = typeof navigator !== "undefined" && "serial" in navigator;
    if (["LOCAL_USB", "BLUETOOTH", "NETWORK"].includes(sanitized.connection)) {
      return { ...sanitized, connection: prefersSerial ? "WEB_SERIAL" : "BROWSER", endpoint: "", token: "" };
    }
    if (sanitized.connection === "USB") {
      return { ...sanitized, endpoint: "", token: "" };
    }
  }
  return sanitized;
}

export function readPrinterConfig(): PrinterConfig {
  if (typeof window === "undefined") return DEFAULT_PRINTER_CONFIG;
  try { return sanitizePrinterConfig(JSON.parse(localStorage.getItem(KEY) ?? "{}")); } catch { return sanitizePrinterConfig(DEFAULT_PRINTER_CONFIG); }
}
export function savePrinterConfig(config: PrinterConfig) { localStorage.setItem(KEY, JSON.stringify(sanitizePrinterConfig(config))); }
