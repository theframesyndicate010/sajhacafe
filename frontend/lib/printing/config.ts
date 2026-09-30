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
    if (["LOCAL_USB", "BLUETOOTH", "NETWORK", "WEB_SERIAL", "USB"].includes(sanitized.connection)) {
      return { ...sanitized, connection: "BROWSER", endpoint: "", token: "" };
    }
  }
  if (sanitized.connection === "ANDROID_NATIVE") {
    return { ...sanitized, endpoint: "", token: "" };
  }
  return sanitized;
}

export function readPrinterConfig(): PrinterConfig {
  if (typeof window === "undefined") return DEFAULT_PRINTER_CONFIG;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<PrinterConfig>;
    // Before Bluetooth LE became the default, a fresh setup could persist the
    // generic USB config. Upgrade only that untouched placeholder; a connected
    // printer has a device-specific ID and keeps its saved connection method.
    const isLegacyDefaultUsb = stored.connection === "USB"
      && stored.id === "default"
      && stored.name === "XP-C2008"
      && stored.model === "XP-C2008";
    if (isLegacyDefaultUsb) {
      const upgraded = sanitizePrinterConfig({ ...DEFAULT_PRINTER_CONFIG, ...stored, connection: "WEB_BLUETOOTH" });
      localStorage.setItem(KEY, JSON.stringify(upgraded));
      return upgraded;
    }
    return sanitizePrinterConfig({ ...DEFAULT_PRINTER_CONFIG, ...stored } as PrinterConfig);
  } catch { return sanitizePrinterConfig(DEFAULT_PRINTER_CONFIG); }
}
export function savePrinterConfig(config: PrinterConfig) { localStorage.setItem(KEY, JSON.stringify(sanitizePrinterConfig(config))); }
