import { formatEscPos } from "./escpos";
import type { PrinterConfig, ReceiptData } from "./types";

type UsbEndpoint = { endpointNumber: number; direction: "in" | "out"; type: string };
type UsbDevice = { productName?: string; vendorId: number; productId: number; opened: boolean; configuration: { interfaces: Array<{ interfaceNumber: number; alternates: Array<{ endpoints: UsbEndpoint[] }> }> } | null; open(): Promise<void>; close(): Promise<void>; selectConfiguration(value: number): Promise<void>; claimInterface(value: number): Promise<void>; transferOut(endpoint: number, data: BufferSource): Promise<{ status: string }> };
type GattCharacteristic = { properties: { write?: boolean; writeWithoutResponse?: boolean }; writeValue(data: BufferSource): Promise<void>; writeValueWithoutResponse?(data: BufferSource): Promise<void> };
type BleService = { getCharacteristics(): Promise<GattCharacteristic[]> };
type BleServer = { getPrimaryServices(): Promise<BleService[]> };
type BleDevice = { id: string; name?: string; gatt?: { connected: boolean; connect(): Promise<BleServer>; disconnect(): void } };
type SerialPort = { readonly writable: WritableStream<Uint8Array> | null; open(options: { baudRate: number }): Promise<void>; close(): Promise<void> };
type BrowserNavigator = Navigator & { usb?: { requestDevice(options: { filters: object[] }): Promise<UsbDevice>; getDevices(): Promise<UsbDevice[]> }; bluetooth?: { requestDevice(options: { acceptAllDevices: boolean; optionalServices: number[] }): Promise<BleDevice>; getDevices?(): Promise<BleDevice[]> }; serial?: { requestPort(): Promise<SerialPort>; getPorts(): Promise<SerialPort[]> } };

const nav = () => navigator as BrowserNavigator;
let usbDevice: UsbDevice | undefined;
let usbEndpoint: UsbEndpoint | undefined;
let usbInterface: number | undefined;
let bleDevice: BleDevice | undefined;
let bleServer: BleServer | undefined;
let bleWriter: GattCharacteristic | undefined;
let serialPort: SerialPort | undefined;

async function withTimeout<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]);
  } finally { if (timer) clearTimeout(timer); }
}

const ownedBuffer = (view: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(view);
  return copy;
};

function bytes(receipt: ReceiptData, config: PrinterConfig) {
  const encoded = formatEscPos(receipt, config.paperWidth, config.encoding);
  const out = new Uint8Array(encoded.length * config.copies);
  for (let i = 0; i < config.copies; i++) out.set(encoded, i * encoded.length);
  return out;
}

function friendly(error: unknown, method: string) {
  if (error instanceof DOMException && error.name === "NotFoundError") return new Error(`${method} printer selection was cancelled.`);
  if (error instanceof DOMException && error.name === "SecurityError") return new Error(`${method} printing is blocked. Use HTTPS and allow device access in the browser.`);
  if (error instanceof DOMException && error.name === "NotAllowedError") return new Error(`${method} permission was denied. Allow this site to access the printer, then retry.`);
  return error instanceof Error ? error : new Error(`${method} printer unavailable.`);
}

export async function connectWebUsb() {
  if (!nav().usb) throw new Error("USB thermal printing is unavailable in this browser/device. Try Chrome or Edge over HTTPS, or choose System Print.");
  try {
    usbDevice = await nav().usb!.requestDevice({ filters: [] });
    if (!usbDevice.opened) await usbDevice.open();
    if (!usbDevice.configuration) await usbDevice.selectConfiguration(1);
    const iface = usbDevice.configuration!.interfaces.find(item => item.alternates.some(alt => alt.endpoints.some(ep => ep.direction === "out" && ep.type === "bulk")));
    const endpoint = iface?.alternates.flatMap(alt => alt.endpoints).find(ep => ep.direction === "out" && ep.type === "bulk");
    if (!iface || !endpoint) throw new Error("The selected device has no USB bulk print interface. Use its operating system driver, Bluetooth SPP, or a local print bridge.");
    try { await usbDevice.claimInterface(iface.interfaceNumber); }
    catch (error) { throw new Error("The operating system printer driver owns this USB interface. Use System Print or Bluetooth SPP instead.", { cause: error }); }
    usbEndpoint = endpoint;
    usbInterface = iface.interfaceNumber;
    return { id: `${usbDevice.vendorId}:${usbDevice.productId}`, name: usbDevice.productName || "USB receipt printer" };
  } catch (error) {
    if (usbDevice && !usbEndpoint) { try { await usbDevice.close(); } catch { /* failed open cleanup */ } usbDevice = undefined; }
    throw friendly(error, "USB");
  }
}

export async function disconnectWebUsb() {
  if (!usbDevice) return;
  try { await usbDevice.close(); } finally { usbDevice = undefined; usbEndpoint = undefined; usbInterface = undefined; }
}
export function isWebUsbConnected() { return Boolean(usbDevice?.opened && usbEndpoint); }

export async function connectWebBluetooth() {
  if (!nav().bluetooth) throw new Error("Web Bluetooth is not supported by this browser/device. Use Chrome over HTTPS, Bluetooth SPP, or the Android app.");
  try {
    bleDevice = await nav().bluetooth!.requestDevice({ acceptAllDevices: true, optionalServices: [0x1800, 0x1801, 0x180a, 0x18f0, 0xffe0] });
    if (!bleDevice.gatt) throw new Error("This printer does not expose BLE GATT. Bluetooth Classic SPP requires Web Serial, the Android app, or the local bridge.");
    bleServer = await withTimeout(bleDevice.gatt.connect(), 20000, "Bluetooth connection timed out. Check the printer is powered on and paired.");
    bleWriter = await findWritableCharacteristic(bleServer);
    if (!bleWriter) throw new Error("The selected BLE device has no writable GATT characteristic. Generic ESC/POS-over-BLE cannot be assumed for this printer.");
    return { id: bleDevice.id, name: bleDevice.name || "Bluetooth LE printer" };
  } catch (error) {
    bleDevice?.gatt?.disconnect(); bleDevice = undefined; bleServer = undefined; bleWriter = undefined;
    throw friendly(error, "Bluetooth LE");
  }
}
export async function disconnectWebBluetooth() { bleDevice?.gatt?.disconnect(); bleDevice = undefined; bleServer = undefined; bleWriter = undefined; }
export function isWebBluetoothConnected() { return Boolean(bleDevice?.gatt?.connected && bleWriter); }

async function findWritableCharacteristic(server: BleServer) {
  for (const service of await server.getPrimaryServices()) {
    try {
      const writable = (await service.getCharacteristics()).find(item => item.properties.write || item.properties.writeWithoutResponse);
      if (writable) return writable;
    } catch { /* vendor services may not be exposed by the permission grant */ }
  }
  return undefined;
}

/**
 * Web Bluetooth is BLE/GATT. Chrome's Web Serial exposes paired Bluetooth Classic
 * RFCOMM/SPP (desktop Chrome 117+, Android Chrome 138+); the PWA uses the same API
 * when served from a secure origin. The printer must actually offer SPP.
 */
export async function connectWebSerialBluetooth() {
  if (!nav().serial) throw new Error("Bluetooth SPP is not supported by this browser/device. Use Chrome 117+ desktop or Chrome 138+ Android, the Sajha Cafe Android app, or the local bridge.");
  try {
    const selectedPort = await nav().serial!.requestPort();
    let openCompleted = false;
    let timedOut = false;
    const opening = selectedPort.open({ baudRate: 9600 }).then(() => {
      openCompleted = true;
      if (timedOut) void selectedPort.close();
    });
    try { await withTimeout(opening, 20000, "Bluetooth connection timed out. Confirm the printer is paired and not in use by another app."); }
    catch (error) { timedOut = true; if (openCompleted) await selectedPort.close().catch(() => undefined); throw error; }
    // Verify SPP during setup, then release the single connection so another
    // waiter's phone can use the printer. Keep this phone's granted port handle.
    await selectedPort.close();
    serialPort = selectedPort;
    return { id: "web-serial-printer", name: "Bluetooth SPP receipt printer" };
  } catch (error) {
    serialPort = undefined;
    throw friendly(error, "Bluetooth serial");
  }
}
export async function disconnectWebSerialBluetooth() {
  if (serialPort) { try { if (serialPort.writable) await serialPort.close(); } finally { serialPort = undefined; } }
}
export async function isWebSerialBluetoothConnected() {
  if (serialPort) return true; // Selected/granted; SPP stays closed between print jobs.
  const ports = await nav().serial?.getPorts();
  // Never silently choose a device when the browser has several printer grants.
  if (ports?.length === 1) { serialPort = ports[0]; return true; }
  return false;
}

async function sendUsb(data: Uint8Array, config: PrinterConfig) {
  const devices = usbDevice ? [usbDevice] : (await nav().usb?.getDevices()) ?? [];
  const device = devices.find(item => `${item.vendorId}:${item.productId}` === config.id);
  if (!device || !usbEndpoint || usbInterface === undefined) throw new Error("USB printer is not connected in Printer Settings. Connect it and grant USB access first.");
  for (let offset = 0; offset < data.length; offset += 4096) {
    const result = await withTimeout(device.transferOut(usbEndpoint.endpointNumber, ownedBuffer(data.subarray(offset, Math.min(offset + 4096, data.length)))), 30000, "USB printer write timed out. Check the cable and printer power.");
    if (result.status !== "ok") throw new Error(`USB printer write failed (${result.status}). Check the cable and printer power.`);
  }
}

async function sendBle(data: Uint8Array, config: PrinterConfig) {
  const device = bleDevice ?? (await nav().bluetooth?.getDevices?.())?.find(item => item.id === config.id);
  if (!device?.gatt) throw new Error("Bluetooth LE printer is not connected. Connect it in Printer Settings first.");
  const server = bleServer ?? (device.gatt.connected ? undefined : await device.gatt.connect());
  if (!server) throw new Error("Bluetooth GATT connection did not open.");
  bleServer = server;
  const writable = bleWriter ?? await findWritableCharacteristic(server);
  if (!writable) throw new Error("No writable BLE GATT characteristic was found. This printer may use Bluetooth Classic SPP instead.");
  bleWriter = writable;
  for (let offset = 0; offset < data.length; offset += 180) {
    const chunk = ownedBuffer(data.slice(offset, Math.min(offset + 180, data.length)));
    if (writable.properties.writeWithoutResponse && writable.writeValueWithoutResponse) await withTimeout(writable.writeValueWithoutResponse(chunk), 30000, "Bluetooth LE printer write timed out.");
    else await withTimeout(writable.writeValue(chunk), 30000, "Bluetooth LE printer write timed out.");
  }
}

async function sendSerial(data: Uint8Array) {
  if (!await isWebSerialBluetoothConnected() || !serialPort) throw new Error("Bluetooth SPP printer is not selected on this phone. Pair it in Bluetooth settings, then select it in Printer Settings.");
  const port = serialPort;
  if (port.writable) throw new Error("A Bluetooth print is already in progress on this phone. Wait for it to finish, then retry.");
  try {
    let openCompleted = false;
    let timedOut = false;
    const opening = port.open({ baudRate: 9600 }).then(() => {
      openCompleted = true;
      if (timedOut) void port.close().catch(() => undefined);
    });
    try { await withTimeout(opening, 20000, "Bluetooth connection timed out. Confirm the printer is paired, powered on, and available."); }
    catch (error) { timedOut = true; if (openCompleted) await port.close().catch(() => undefined); throw error; }
    const stream = (port as SerialPort).writable;
    if (!stream) throw new Error("Bluetooth SPP opened without a writable printer connection.");
    const writer = stream.getWriter();
    try {
      for (let offset = 0; offset < data.length; offset += 4096) {
        await withTimeout(writer.write(data.slice(offset, Math.min(offset + 4096, data.length))), 30000, "Bluetooth printer write timed out. Check printer power and retry.");
      }
    } catch (error) {
      try { await writer.abort(error); } catch { /* transport may already have closed */ }
      throw error;
    } finally {
      try { writer.releaseLock(); } catch { /* closed after a failed write */ }
    }
  } catch (error) {
    throw new Error(`Bluetooth SPP print failed. Check printer power, pairing, and whether another phone or app is using it. ${error instanceof Error ? error.message : ""}`, { cause: error });
  } finally {
    // Release the printer after each job so a different waiter's phone can print.
    if (port.writable) {
      try { await port.close(); }
      catch (error) { throw new Error(`Receipt bytes were sent, but the Bluetooth connection did not release cleanly. ${error instanceof Error ? error.message : ""}`, { cause: error }); }
    }
  }
}

export async function printWebReceipt(receipt: ReceiptData, config: PrinterConfig) {
  const data = bytes(receipt, config);
  if (config.connection === "USB") await sendUsb(data, config);
  else if (config.connection === "WEB_BLUETOOTH") await sendBle(data, config);
  else if (config.connection === "WEB_SERIAL") await sendSerial(data);
  else throw new Error("Select WebUSB, Bluetooth LE, or Bluetooth SPP as the printer connection.");
  return { status: "sent", printerName: config.name };
}
