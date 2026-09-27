import { androidPrinterStatus, connectAndroidPrinter, disconnectAndroidPrinter, getAndroidPrinterStatus, hasAndroidPrintBridge, listPairedDevices, selectAndroidPrinter } from "./android-bridge";
import { browserPrintAdapter } from "./browser-print";
import { connectPrintBridge, testThermalPrinter, thermalPrint } from "./bridge-client";
import { isAndroidBrowser } from "./config";
import { readAndroidNativePrinter, saveAndroidNativePrinter, clearAndroidNativePrinter } from "./android-device-printer";
import { connectWebBluetooth, connectWebSerialBluetooth, connectWebUsb, disconnectWebBluetooth, disconnectWebSerialBluetooth, disconnectWebUsb, isWebBluetoothConnected, isWebSerialBluetoothConnected, isWebUsbConnected } from "./web-printer";
import { sampleReceipt, testReceipt } from "./sample-receipts";
import type { PrinterConfig, ReceiptData } from "./types";

export type PrinterStatus = "not-connected" | "connecting" | "connected" | "printing" | "ready" | "error";

function forbidLocalBridgeOnAndroid(config: PrinterConfig) {
  if (isAndroidBrowser() && !hasAndroidPrintBridge() && ["LOCAL_USB", "BLUETOOTH", "NETWORK"].includes(config.connection)) {
    throw new Error("This Android PWA cannot use the desktop localhost print bridge. Use Bluetooth Classic · Web Serial SPP, the Sajha Android app, or System Print.");
  }
}

/** Keeps POS components independent of the hardware/browser transport. */
export class PrinterManager {
  private resolveNativeConfig(config: PrinterConfig): PrinterConfig {
    const stored = readAndroidNativePrinter();
    const address = config.address || stored?.address || config.id;
    if (isAndroidBrowser() && hasAndroidPrintBridge() && (config.connection === "ANDROID_NATIVE" || stored)) {
      const nativeConfig = { ...config, connection: "ANDROID_NATIVE" as const, address: address && address !== "default" ? address : "", id: address && address !== "default" ? address : config.id, name: stored?.name ?? config.name };
      if (nativeConfig.address) saveAndroidNativePrinter({ transport: "android-native", address: nativeConfig.address, name: nativeConfig.name });
      return nativeConfig;
    }
    return config;
  }

  async connect(config: PrinterConfig): Promise<{ status: PrinterStatus; message: string; id?: string; name?: string }> {
    const resolved = this.resolveNativeConfig(config);
    if (resolved.connection === "BROWSER") {
      if (!browserPrintAdapter.isAvailable()) throw new Error("System Print is unavailable in this browser/device.");
      return { status: "not-connected", message: "System Print is available. It opens the browser/OS print dialog; it does not keep a thermal-printer connection open." };
    }
    if (isAndroidBrowser() && !hasAndroidPrintBridge()) {
      if (["LOCAL_USB", "BLUETOOTH", "NETWORK"].includes(resolved.connection)) {
        throw new Error("Android browsers cannot reach a desktop localhost print bridge. Use Web Serial SPP or System Print instead.");
      }
    }
    let selected: { id: string; name: string } | undefined;
    if (resolved.connection === "USB") selected = await connectWebUsb();
    else if (resolved.connection === "WEB_BLUETOOTH") selected = await connectWebBluetooth();
    else if (resolved.connection === "WEB_SERIAL") {
      selected = await connectWebSerialBluetooth();
      return { status: "ready", message: "This phone is paired and the printer's SPP connection was verified. The phone connects only while sending each print job.", ...selected };
    }
    else if (resolved.connection === "ANDROID_NATIVE") {
      if (!resolved.address) throw new Error("No Android native printer address is stored on this device. Connect a printer first.");
      const result = await connectAndroidPrinter(resolved.address);
      saveAndroidNativePrinter({ transport: "android-native", address: resolved.address, name: resolved.name ?? "XP-C2008" });
      return { status: result.connected ? "ready" : "not-connected", message: result.connected ? `Connected to ${resolved.name ?? "XP-C2008"}.` : "Android printer connection could not be established.", id: resolved.address, name: resolved.name ?? "XP-C2008" };
    }
    else if (resolved.connection === "BLUETOOTH" && hasAndroidPrintBridge()) {
      if (!resolved.id || resolved.id === "default") throw new Error("Select a paired printer first, then connect.");
      await selectAndroidPrinter(resolved.id);
      await connectAndroidPrinter(resolved.id);
    } else {
      forbidLocalBridgeOnAndroid(resolved);
      const result = await connectPrintBridge(resolved);
      return { status: "ready", message: result.message };
    }
    return { status: "connected", message: `Connected to ${selected?.name ?? resolved.name}.`, ...selected };
  }

  async disconnect(config: PrinterConfig): Promise<void> {
    const resolved = this.resolveNativeConfig(config);
    if (resolved.connection === "USB") await disconnectWebUsb();
    else if (resolved.connection === "WEB_BLUETOOTH") await disconnectWebBluetooth();
    else if (resolved.connection === "WEB_SERIAL") await disconnectWebSerialBluetooth();
    else if (resolved.connection === "ANDROID_NATIVE") {
      await disconnectAndroidPrinter();
      clearAndroidNativePrinter();
      return;
    }
    else if (resolved.connection === "BLUETOOTH" && hasAndroidPrintBridge()) await disconnectAndroidPrinter();
    // The local bridge deliberately uses short-lived device sockets per job.
  }

  async isConnected(config: PrinterConfig): Promise<boolean> {
    const resolved = this.resolveNativeConfig(config);
    if (resolved.connection === "USB") return isWebUsbConnected();
    if (resolved.connection === "WEB_BLUETOOTH") return isWebBluetoothConnected();
    if (resolved.connection === "WEB_SERIAL") return await isWebSerialBluetoothConnected();
    if (resolved.connection === "ANDROID_NATIVE") {
      const state = await getAndroidPrinterStatus();
      return Boolean(state.connected);
    }
    if (resolved.connection === "BLUETOOTH" && hasAndroidPrintBridge()) return Boolean((await androidPrinterStatus() as { connected?: boolean }).connected);
    return false;
  }

  async printReceipt(receipt: ReceiptData, config: PrinterConfig, onAfterSystemPrint?: () => void) {
    const resolved = this.resolveNativeConfig(config);
    if (resolved.connection === "BROWSER") return browserPrintAdapter.printReceipt(receipt, resolved.paperWidth, onAfterSystemPrint);
    return thermalPrint(receipt, resolved);
  }

  async testPrint(config: PrinterConfig) {
    const resolved = this.resolveNativeConfig(config);
    if (resolved.connection === "BROWSER") {
      const receipt = testReceipt(resolved);
      return browserPrintAdapter.printReceipt({ ...receipt, dateText: `XP-C2008 - ${resolved.paperWidth}mm System Print`, footer: "Choose the printer in the system dialog and confirm paper output." }, resolved.paperWidth);
    }
    return testThermalPrinter(resolved);
  }

  async printSampleReceipt(config: PrinterConfig) {
    const resolved = this.resolveNativeConfig(config);
    if (resolved.connection === "BROWSER") return browserPrintAdapter.printReceipt(sampleReceipt(), resolved.paperWidth);
    return thermalPrint(sampleReceipt(), resolved);
  }

  async listPairedNativePrinters() {
    if (!hasAndroidPrintBridge()) return [];
    return listPairedDevices();
  }
}

export const printerManager = new PrinterManager();
