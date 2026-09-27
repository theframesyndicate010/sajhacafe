"use client";

import { PrinterSettings } from "@/components/settings/printer-settings";

export default function WaiterPrinterSettingsPage() {
  return (
    <div className="waiter-page">
      <p className="eyebrow">SETTINGS</p>
      <h1>Printer setup</h1>
      <PrinterSettings />
    </div>
  );
}
