import { DEFAULT_PRINTER_CONFIG, type PrinterConfig } from "./types";
const KEY = "sajha.printer.config.v1";
export function readPrinterConfig(): PrinterConfig {
  if (typeof window === "undefined") return DEFAULT_PRINTER_CONFIG;
  try { return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULT_PRINTER_CONFIG; }
}
export function savePrinterConfig(config: PrinterConfig) { localStorage.setItem(KEY, JSON.stringify(config)); }
