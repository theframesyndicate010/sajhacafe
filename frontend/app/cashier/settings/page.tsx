"use client";

import { PrinterSettings } from "@/components/settings/printer-settings";

export default function CashierPrinterSettingsPage() {
  return (
    <div className="cashier-page">
      <p className="eyebrow">SETTINGS</p>
      <h1>Printer setup</h1>
      <PrinterSettings />
    </div>
  );
}
