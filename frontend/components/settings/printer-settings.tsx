"use client";

import { useEffect, useState } from "react";
import { hasAndroidPrintBridge, listAndroidPrinters } from "@/lib/printing/android-bridge";
import { isAndroidBrowser, readPrinterConfig, savePrinterConfig } from "@/lib/printing/config";
import { printerManager, type PrinterStatus } from "@/lib/printing/printer-manager";
import { bridgeStatus } from "@/lib/printing/bridge-client";
import { DEFAULT_PRINTER_CONFIG, type PrinterConfig } from "@/lib/printing/types";

type AndroidPrinter = { id: string; name: string };
const STATUS_LABEL: Record<PrinterStatus, string> = { "not-connected": "Not connected", connecting: "Connecting", connected: "Connected", printing: "Printing", ready: "Ready", error: "Error" };

export function PrinterSettings() {
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);
  const [androidMode, setAndroidMode] = useState(false);
  const [pairedPrinters, setPairedPrinters] = useState<AndroidPrinter[]>([]);
  const [status, setStatus] = useState<PrinterStatus>("not-connected");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = readPrinterConfig();
    const native = hasAndroidPrintBridge();
    const androidPwa = isAndroidBrowser() && !native;
    const preferredConnection: PrinterConfig["connection"] = native ? "BLUETOOTH" : androidPwa ? ("serial" in navigator ? "WEB_SERIAL" : "BROWSER") : saved.connection;
    const initial = native && saved.connection !== "BROWSER" ? { ...saved, connection: "BLUETOOTH" as const } : androidPwa && ["LOCAL_USB", "BLUETOOTH", "NETWORK"].includes(saved.connection) ? { ...saved, connection: preferredConnection, endpoint: "", token: "" } : androidPwa && saved.connection === "USB" ? { ...saved, endpoint: "", token: "" } : { ...saved, connection: preferredConnection };
    setConfig(initial);
    setAndroidMode(native);
    if (native) void listAndroidPrinters().then(setPairedPrinters).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to read paired Android printers."));
    if (!native && isBridgeConnection(initial.connection)) {
      void bridgeStatus(initial).then(bridge => {
        if (bridge.status !== "running") throw new Error("The local print bridge returned an invalid status.");
        if (bridge.transport === "unconfigured") {
          setStatus("not-connected");
          setMessage("Bridge is running, but no printer output is configured on this device.");
        } else if (bridge.transport !== expectedBridgeTransport(initial.connection)) {
          setStatus("error");
          setError(`The bridge is configured for ${bridge.transport}, but Sajha is set to ${initial.connection}. Select the matching connection or correct the bridge .env output.`);
        } else {
          setStatus("ready");
          setMessage("Bridge is reachable. Press Connect to verify the printer connection.");
        }
      }).catch((reason: unknown) => {
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "Unable to reach the local print bridge.");
      });
    } else if (native || ["USB", "WEB_BLUETOOTH", "WEB_SERIAL"].includes(initial.connection)) {
      void printerManager.isConnected(initial).then(connected => setStatus(connected ? (initial.connection === "WEB_SERIAL" ? "ready" : "connected") : "not-connected")).catch(() => setStatus("error"));
    }
  }, []);

  const persist = (next = config) => { savePrinterConfig(next); setMessage("Printer settings saved on this device."); setError(""); };
  const update = (field: keyof PrinterConfig, value: string | number | boolean) => setConfig(current => ({ ...current, [field]: value }));
  const selectConnection = (connection: PrinterConfig["connection"]) => {
    const next = { ...config, connection, id: "default", name: connection === "USB" ? "XP-C2008" : config.name };
    setConfig(next); setStatus("not-connected"); setMessage(""); setError("");
  };

  const run = async (action: "connect" | "disconnect" | "test" | "sample") => {
    setBusy(true); setMessage(""); setError("");
    try {
      let activeConfig = config;
      if (action === "connect" && androidMode && config.connection === "BLUETOOTH") {
        const printers = await listAndroidPrinters();
        setPairedPrinters(printers);
        let selected = printers.find(printer => printer.id === config.id);
        if (!selected && printers.length === 1) selected = printers[0];
        if (!selected) throw new Error(printers.length ? "Select a paired printer below, then connect." : "No paired printers found. Pair the XP-C2008 in Android Settings → Bluetooth, then retry.");
        activeConfig = { ...config, id: selected.id, name: selected.name, model: selected.name };
      }
      if (action === "connect") {
        setStatus("connecting");
        const result = await printerManager.connect(activeConfig);
        if (result.id || result.name) activeConfig = { ...activeConfig, id: result.id ?? activeConfig.id, name: activeConfig.connection === "WEB_SERIAL" ? activeConfig.name : result.name ?? activeConfig.name, model: activeConfig.connection === "WEB_SERIAL" ? activeConfig.model : result.name ?? activeConfig.model };
        setConfig(activeConfig); savePrinterConfig(activeConfig); setStatus(result.status); setMessage(result.message);
      } else if (action === "disconnect") {
        await printerManager.disconnect(activeConfig);
        setStatus("not-connected"); setMessage(activeConfig.connection === "BLUETOOTH" && !androidMode ? "The local bridge opens and closes its printer connection for each job." : "Printer disconnected.");
      } else {
        setStatus("printing");
        const result = action === "test" ? await printerManager.testPrint(activeConfig) : await printerManager.printSampleReceipt(activeConfig);
        const systemPrint = result.status === "dialog-opened";
        setStatus(systemPrint ? "not-connected" : activeConfig.connection === "WEB_SERIAL" ? (await printerManager.isConnected(activeConfig) ? "ready" : "not-connected") : (await printerManager.isConnected(activeConfig) ? "connected" : (activeConfig.connection === "BLUETOOTH" || activeConfig.connection === "LOCAL_USB" || activeConfig.connection === "NETWORK") && !androidMode ? "ready" : "not-connected"));
        setMessage(systemPrint ? "System print dialog opened. Choose the XP-C2008 and confirm the print; the browser cannot confirm paper output." : "Print command sent successfully. Confirm that the printer physically produced the page.");
      }
    } catch (reason) {
      setStatus("error"); setError(reason instanceof Error ? reason.message : "Printer operation failed.");
    } finally { setBusy(false); }
  };

  return <section className="card printer-settings" aria-labelledby="printer-settings-heading">
    <header><p className="eyebrow">{androidMode ? "ANDROID DEVICE" : "LOCAL DEVICE"}</p><h2 id="printer-settings-heading">Printer settings &amp; test</h2><p className="muted">Choose how this device will print receipts. Thermal Printer sends ESC/POS directly; System Print opens the browser/operating-system dialog.</p></header>
    <div className="printer-status" role="status"><span className={`printer-status-dot printer-status-${status}`} /><span><strong>Printer status: {STATUS_LABEL[status]}</strong>{config.name ? ` · ${config.name}` : ""}</span><span className="muted">Connection method: {connectionLabel(config.connection, androidMode)}</span></div>
    <div className="printer-settings-grid">
      <label className="field">Printer name<input value={config.name} onChange={event => update("name", event.target.value)} /></label>
      <label className="field">Printer model<input value={config.model} onChange={event => update("model", event.target.value)} placeholder="XP-C2008" /></label>
      {androidMode && <label className="field">Paired Android printer<select value={pairedPrinters.some(printer => printer.id === config.id) ? config.id : ""} onChange={event => { const printer = pairedPrinters.find(item => item.id === event.target.value); if (printer) { const next = { ...config, id: printer.id, name: printer.name, model: printer.name, connection: "BLUETOOTH" as const }; setConfig(next); setStatus("not-connected"); } }}><option value="">Select a paired printer</option>{pairedPrinters.map(printer => <option key={printer.id} value={printer.id}>{printer.name}</option>)}</select></label>}
      <label className="field">Connection method<select value={config.connection} onChange={event => selectConnection(event.target.value as PrinterConfig["connection"])}>{androidMode ? <><option value="BLUETOOTH">Bluetooth Classic · Android app</option><option value="BROWSER">Browser/System Print</option></> : <><option value="USB">USB · direct WebUSB</option><option value="LOCAL_USB">USB · local bridge</option><option value="WEB_SERIAL">Bluetooth Classic · Web Serial SPP</option><option value="WEB_BLUETOOTH">Bluetooth LE · Web Bluetooth</option><option value="BLUETOOTH">Bluetooth Classic · local bridge</option><option value="NETWORK">Network · local bridge</option><option value="BROWSER">Browser/System Print</option></>}</select></label>
      <label className="field">Paper width<select value={config.paperWidth} onChange={event => update("paperWidth", Number(event.target.value))}><option value={58}>58mm</option><option value={80}>80mm</option></select></label>
      <label className="field">Copies<input min={1} max={5} type="number" value={config.copies} onChange={event => update("copies", Math.min(5, Math.max(1, Number(event.target.value))))} /></label>
      <label className="field">Character handling<select value={config.encoding} onChange={event => update("encoding", event.target.value as PrinterConfig["encoding"])}><option value="utf-8">Automatic · ASCII or Unicode raster</option><option value="ascii">ASCII text; Unicode uses raster fallback</option></select></label>
      {!androidMode && (config.connection === "LOCAL_USB" || config.connection === "BLUETOOTH" || config.connection === "NETWORK") && <><label className="field">Local bridge URL<input value={config.endpoint} onChange={event => update("endpoint", event.target.value)} placeholder="http://127.0.0.1:17891" /></label><label className="field">Local bridge token<input autoComplete="off" type="password" value={config.token} onChange={event => update("token", event.target.value)} /></label></>}
    </div>
    {config.connection === "WEB_SERIAL" && <p className="muted">Each waiter can pair XP-C2008 with their own phone in Android Bluetooth settings, then select it here. Requires Chrome 138+ on Android, a secure HTTPS origin, and the printer's SPP/RFCOMM service. The phone opens Bluetooth only for a print job, then releases the printer for another waiter.</p>}
    {config.connection === "WEB_BLUETOOTH" && <p className="muted">This option is BLE/GATT only. The XP-C2008 label does not identify whether this unit uses BLE or Classic Bluetooth. If no writable GATT service exists, use Bluetooth Classic / Web Serial.</p>}
    {config.connection === "USB" && <p className="muted">WebUSB works only if the printer exposes an unclaimed bulk interface. USB printer-class drivers may keep the interface from the browser; choose USB · local bridge in that case. Android USB requires OTG and a WebUSB-accessible interface.</p>}
    {config.connection === "BLUETOOTH" && !androidMode && <p className="muted">Pair the printer in the computer's Bluetooth settings and configure its SPP address in the local bridge. The bridge opens a short-lived printer socket per print job; it does not report an always-on connection.</p>}
    {config.connection === "BROWSER" && <p className="muted">System Print uses a clean 58mm browser receipt preview, not ESC/POS. The browser cannot report whether paper physically came out.</p>}
    {message && <p className="muted" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}
    <div className="printer-actions"><button className="btn secondary" disabled={busy} onClick={() => persist()} type="button">Save settings</button><button className="btn secondary" disabled={busy || config.connection === "BROWSER"} onClick={() => void run("connect")} type="button">{busy && status === "connecting" ? "Connecting…" : "Connect"}</button><button className="btn secondary" disabled={busy} onClick={() => void run("disconnect")} type="button">Disconnect</button><button className="btn" disabled={busy} onClick={() => void run("test")} type="button">{busy && status === "printing" ? "Printing…" : "Test Print"}</button><button className="btn secondary" disabled={busy} onClick={() => void run("sample")} type="button">Print Sample Receipt</button></div>
    <p className="muted">For a sale, open the bill and choose <strong>Thermal Print</strong> or <strong>Browser/System Print</strong>. Print data is formatted on this device; no external print service is used.</p>
  </section>;
}

function connectionLabel(connection: PrinterConfig["connection"], androidMode: boolean) {
  if (connection === "USB") return "USB · WebUSB";
  if (connection === "LOCAL_USB") return "USB · local bridge";
  if (connection === "WEB_SERIAL") return "Bluetooth Classic SPP · Web Serial";
  if (connection === "WEB_BLUETOOTH") return "Bluetooth LE · GATT";
  if (connection === "BLUETOOTH") return androidMode ? "Bluetooth Classic · Android RFCOMM" : "Bluetooth Classic · local bridge";
  if (connection === "NETWORK") return "Network · local bridge";
  return "Browser/System Print";
}

function isBridgeConnection(connection: PrinterConfig["connection"]) {
  return connection === "LOCAL_USB" || connection === "BLUETOOTH" || connection === "NETWORK";
}

function expectedBridgeTransport(connection: PrinterConfig["connection"]) {
  if (connection === "LOCAL_USB") return "device";
  if (connection === "NETWORK") return "network";
  return "bluetooth";
}
