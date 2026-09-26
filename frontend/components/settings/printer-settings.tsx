"use client";

import { useEffect, useState } from "react";
import { bridgeStatus, testThermalPrinter } from "@/lib/printing/bridge-client";
import { connectAndroidPrinter, disconnectAndroidPrinter, hasAndroidPrintBridge, listAndroidPrinters, selectAndroidPrinter } from "@/lib/printing/android-bridge";
import { readPrinterConfig, savePrinterConfig } from "@/lib/printing/config";
import { DEFAULT_PRINTER_CONFIG, type PrinterConfig } from "@/lib/printing/types";

type AndroidPrinter = { id: string; name: string };

export function PrinterSettings() {
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);
  const [androidMode, setAndroidMode] = useState(false);
  const [pairedPrinters, setPairedPrinters] = useState<AndroidPrinter[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = readPrinterConfig();
    setConfig(saved);
    if (!hasAndroidPrintBridge()) return;
    setAndroidMode(true);
    if (saved.connection === "USB") setConfig({ ...saved, connection: "BLUETOOTH" });
    void listAndroidPrinters().then(setPairedPrinters).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to read paired Android printers."));
  }, []);

  const update = (field: keyof PrinterConfig, value: string | number | boolean) => setConfig(current => ({ ...current, [field]: value }));
  const persist = (next = config) => { savePrinterConfig(next); setMessage("Printer settings saved on this device."); setError(""); };

  const run = async (action: "connect" | "test") => {
    setBusy(true); setMessage(""); setError("");
    try {
      if (androidMode && action === "connect") {
        const printers = await listAndroidPrinters();
        setPairedPrinters(printers);
        let selected = printers.find(printer => printer.id === config.id);
        if (!selected && printers.length === 1) selected = printers[0];
        if (!selected) throw new Error(printers.length ? "Select a paired printer below, then connect." : "No paired printers found. Pair the receipt printer in Android Bluetooth settings, then retry.");
        await selectAndroidPrinter(selected.id);
        await connectAndroidPrinter(selected.id);
        const next = { ...config, id: selected.id, name: selected.name, model: selected.name, connection: "BLUETOOTH" as const };
        setConfig(next); savePrinterConfig(next);
        setMessage(`Connected to ${selected.name}.`);
      } else if (action === "connect") {
        persist();
        const status = await bridgeStatus(config);
        if (status.status !== "running") throw new Error("Print bridge is not running.");
        if (status.transport === "unconfigured") throw new Error("Printer not configured in the local bridge. Set PRINTER_DEVICE, PRINTER_BLUETOOTH_ADDRESS, or PRINTER_HOST there.");
        setMessage("Print bridge is running and has a configured output.");
      } else {
        persist();
        await testThermalPrinter(config);
        setMessage("Test print sent successfully.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Printer unavailable.");
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      if (androidMode) await disconnectAndroidPrinter();
      const next = { ...config, id: "default", name: "Receipt printer", model: "", token: "", connection: androidMode ? "BLUETOOTH" as const : config.connection };
      setConfig(next); savePrinterConfig(next); setMessage("Printer disconnected.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to disconnect printer."); }
    finally { setBusy(false); }
  };

  return <section className="card printer-settings">
    <header><p className="eyebrow">{androidMode ? "ANDROID DEVICE" : "LOCAL DEVICE"}</p><h2>Printer</h2><p className="muted">{androidMode ? "Select an already-paired Bluetooth Classic printer. Sajha Cafe connects to it directly through Android; no desktop print bridge or Bluetooth PIN in the PWA is needed." : "Settings are stored in this browser. Bluetooth Classic printers must be paired by the computer operating system and connected through the local bridge."}</p></header>
    <div className="printer-settings-grid">
      <label className="field">Printer name<input value={config.name} onChange={event => update("name", event.target.value)} /></label>
      <label className="field">Printer model / name<input value={config.model} onChange={event => update("model", event.target.value)} placeholder="Printer001" /></label>
      {androidMode && <label className="field">Paired Android printer<select value={pairedPrinters.some(printer => printer.id === config.id) ? config.id : ""} onChange={event => { const printer = pairedPrinters.find(item => item.id === event.target.value); if (printer) setConfig(current => ({ ...current, id: printer.id, name: printer.name, model: printer.name, connection: "BLUETOOTH" })); }}><option value="">Select a paired printer</option>{pairedPrinters.map(printer => <option key={printer.id} value={printer.id}>{printer.name}</option>)}</select></label>}
      <label className="field">Connection type<select value={config.connection} onChange={event => update("connection", event.target.value as PrinterConfig["connection"])}>{androidMode ? <><option value="BLUETOOTH">Bluetooth Classic (Android)</option><option value="BROWSER">Browser only</option></> : <><option value="USB">USB</option><option value="BLUETOOTH">Bluetooth Classic via local bridge</option><option value="NETWORK">Network</option><option value="BROWSER">Browser only</option></>}</select></label>
      <label className="field">Paper width<select value={config.paperWidth} onChange={event => update("paperWidth", Number(event.target.value))}><option value={58}>58mm</option><option value={80}>80mm</option></select></label>
      <label className="field">Copies<input min={1} max={5} type="number" value={config.copies} onChange={event => update("copies", Math.min(5, Math.max(1, Number(event.target.value))))} /></label>
      <label className="field">Character encoding<select value={config.encoding} onChange={event => update("encoding", event.target.value as PrinterConfig["encoding"])}><option value="utf-8">UTF-8</option><option value="ascii">ASCII</option></select></label>
      {!androidMode && <><label className="field">Local bridge URL<input value={config.endpoint} onChange={event => update("endpoint", event.target.value)} placeholder="http://127.0.0.1:17891" /></label><label className="field">Local bridge token<input autoComplete="off" type="password" value={config.token} onChange={event => update("token", event.target.value)} /></label></>}
    </div>
    <p className="muted">Bills print only when someone selects Browser Print or Thermal Print from the bill screen.</p>
    {message && <p className="muted" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}
    <div className="printer-actions"><button className="btn secondary" onClick={() => persist()} type="button">Save printer settings</button><button className="btn secondary" disabled={busy} onClick={() => void run("connect")} type="button">{busy ? "Checking…" : androidMode ? "Connect Printer" : "Connect/Test Connection"}</button><button className="btn secondary" disabled={busy} onClick={() => void run("test")} type="button">Test Print</button><button className="btn secondary" disabled={busy} onClick={() => void disconnect()} type="button">Disconnect</button></div>
    <p className="muted">{androidMode ? "If it is not listed, first pair it in Android Settings → Bluetooth. Android Nearby devices permission is required. The Bluetooth address remains on the phone." : "The bridge token is stored in this browser's local storage. Pair Bluetooth at the OS level; never enter the PIN here."}</p>
  </section>;
}
