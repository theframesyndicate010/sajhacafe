"use client";

import { useEffect, useState } from "react";
import { connectAndroidPrinter, hasAndroidPrintBridge, listPairedDevices } from "@/lib/printing/android-bridge";
import { clearAndroidNativePrinter, readAndroidNativePrinter, saveAndroidNativePrinter } from "@/lib/printing/android-device-printer";

type PrinterChoice = { address: string; name: string };

export function AndroidPrinterConnectButton() {
  const [storedPrinter, setStoredPrinter] = useState<ReturnType<typeof readAndroidNativePrinter>>(readAndroidNativePrinter());
  const [pairedPrinters, setPairedPrinters] = useState<PrinterChoice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>(storedPrinter?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasAndroidPrintBridge()) return;
    void refreshPrinters();
  }, []);

  async function refreshPrinters() {
    if (!hasAndroidPrintBridge()) return;
    try {
      const printers = await listPairedDevices();
      setPairedPrinters(printers);
      if (printers.length && !selectedAddress) {
        const fallback = storedPrinter?.address && printers.some((printer) => printer.address === storedPrinter.address) ? storedPrinter.address : printers[0].address;
        setSelectedAddress(fallback);
      }
    } catch {
      setPairedPrinters([]);
    }
  }

  async function connectSelected(address?: string) {
    if (!hasAndroidPrintBridge()) return;
    setBusy(true);
    setError("");
    try {
      const printers = await listPairedDevices();
      if (!printers.length) throw new Error("No paired Bluetooth printers were found. Pair the XP-C2008 in Android Settings → Bluetooth first.");
      const chosen = printers.find((printer) => printer.address === (address ?? selectedAddress)) ?? printers[0];
      const result = await connectAndroidPrinter(chosen.address);
      if (!result.connected) throw new Error("The Android printer connection was not accepted. Check that the XP-C2008 is powered on and nearby.");
      const saved = { transport: "android-native" as const, address: chosen.address, name: chosen.name || "XP-C2008" };
      saveAndroidNativePrinter(saved);
      setStoredPrinter(saved);
      setSelectedAddress(chosen.address);
      setPairedPrinters(printers);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to connect the printer.";
      setError(message);
      clearAndroidNativePrinter();
      setStoredPrinter(null);
      setSelectedAddress("");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectSelected() {
    if (!hasAndroidPrintBridge()) return;
    try {
      const { disconnectAndroidPrinter } = await import("@/lib/printing/android-bridge");
      await disconnectAndroidPrinter();
    } catch {
      // Ignore disconnect errors and clear the local device-only selection.
    }
    clearAndroidNativePrinter();
    setStoredPrinter(null);
    setSelectedAddress("");
    setError("");
  }

  if (!hasAndroidPrintBridge()) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {pairedPrinters.length > 0 ? (
          <select
            aria-label="Select paired printer"
            onChange={(event) => setSelectedAddress(event.target.value)}
            style={{ minWidth: 180 }}
            value={selectedAddress || pairedPrinters[0].address}
          >
            {pairedPrinters.map((printer) => (
              <option key={printer.address} value={printer.address}>{printer.name || printer.address}</option>
            ))}
          </select>
        ) : null}
        <button
          className="btn secondary"
          disabled={busy}
          onClick={() => void connectSelected()}
          type="button"
        >
          {busy ? "Connecting…" : storedPrinter ? "Reconnect printer" : "Connect Printer"}
        </button>
        {storedPrinter && (
          <button className="btn secondary" onClick={() => void disconnectSelected()} type="button">
            Clear
          </button>
        )}
      </div>
      {storedPrinter && !error && (
        <small className="muted">Printer saved on this device: {storedPrinter.name || storedPrinter.address}</small>
      )}
      {error && <small className="error">{error}</small>}
    </div>
  );
}
