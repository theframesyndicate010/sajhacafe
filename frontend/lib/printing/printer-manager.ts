import { androidPrinterStatus, connectAndroidPrinter, disconnectAndroidPrinter, hasAndroidPrintBridge, selectAndroidPrinter } from "./android-bridge";
import { browserPrintAdapter } from "./browser-print";
import { connectPrintBridge, testThermalPrinter, thermalPrint } from "./bridge-client";
import { connectWebBluetooth, connectWebSerialBluetooth, connectWebUsb, disconnectWebBluetooth, disconnectWebSerialBluetooth, disconnectWebUsb, isWebBluetoothConnected, isWebSerialBluetoothConnected, isWebUsbConnected } from "./web-printer";
import { sampleReceipt, testReceipt } from "./sample-receipts";
import type { PrinterConfig, ReceiptData } from "./types";

export type PrinterStatus = "not-connected" | "connecting" | "connected" | "printing" | "ready" | "error";

/** Keeps POS components independent of the hardware/browser transport. */
export class PrinterManager {
  async connect(config: PrinterConfig): Promise<{ status: PrinterStatus; message: string; id?: string; name?: string }> {
    if (config.connection === "BROWSER") {
      if (!browserPrintAdapter.isAvailable()) throw new Error("System Print is unavailable in this browser/device.");
      return { status: "not-connected", message: "System Print is available. It opens the browser/OS print dialog; it does not keep a thermal-printer connection open." };
    }
    let selected: { id: string; name: string } | undefined;
    if (config.connection === "USB") selected = await connectWebUsb();
    else if (config.connection === "WEB_BLUETOOTH") selected = await connectWebBluetooth();
    else if (config.connection === "WEB_SERIAL") {
      selected = await connectWebSerialBluetooth();
      return { status: "ready", message: "This phone is paired and the printer's SPP connection was verified. The phone connects only while sending each print job.", ...selected };
    }
    else if (config.connection === "BLUETOOTH" && hasAndroidPrintBridge()) {
      if (!config.id || config.id === "default") throw new Error("Select a paired printer first, then connect.");
      await selectAndroidPrinter(config.id);
      await connectAndroidPrinter(config.id);
    } else {
      const result = await connectPrintBridge(config);
      return { status: "ready", message: result.message };
    }
    return { status: "connected", message: `Connected to ${selected?.name ?? config.name}.`, ...selected };
  }

  async disconnect(config: PrinterConfig): Promise<void> {
    if (config.connection === "USB") await disconnectWebUsb();
    else if (config.connection === "WEB_BLUETOOTH") await disconnectWebBluetooth();
    else if (config.connection === "WEB_SERIAL") await disconnectWebSerialBluetooth();
    else if (config.connection === "BLUETOOTH" && hasAndroidPrintBridge()) await disconnectAndroidPrinter();
    // The local bridge deliberately uses short-lived device sockets per job.
  }

  async isConnected(config: PrinterConfig): Promise<boolean> {
    if (config.connection === "USB") return isWebUsbConnected();
    if (config.connection === "WEB_BLUETOOTH") return isWebBluetoothConnected();
    if (config.connection === "WEB_SERIAL") return await isWebSerialBluetoothConnected();
    if (config.connection === "BLUETOOTH" && hasAndroidPrintBridge()) return Boolean((await androidPrinterStatus() as { connected?: boolean }).connected);
    return false;
  }

  async printReceipt(receipt: ReceiptData, config: PrinterConfig, onAfterSystemPrint?: () => void) {
    if (config.connection === "BROWSER") return browserPrintAdapter.printReceipt(receipt, config.paperWidth, onAfterSystemPrint);
    return thermalPrint(receipt, config);
  }

  async testPrint(config: PrinterConfig) {
    if (config.connection === "BROWSER") {
      const receipt = testReceipt(config);
      return browserPrintAdapter.printReceipt({ ...receipt, dateText: `XP-C2008 - ${config.paperWidth}mm System Print`, footer: "Choose the printer in the system dialog and confirm paper output." }, config.paperWidth);
    }
    return testThermalPrinter(config);
  }

  async printSampleReceipt(config: PrinterConfig) {
    if (config.connection === "BROWSER") return browserPrintAdapter.printReceipt(sampleReceipt(), config.paperWidth);
    return thermalPrint(sampleReceipt(), config);
  }
}

export const printerManager = new PrinterManager();
