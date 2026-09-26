import type { PrinterConfig, ReceiptData } from "./types";

export function testReceipt(config: PrinterConfig): ReceiptData {
  return {
    businessName: "SAJHA CAFE",
    billNumber: "PRINTER TEST",
    orderNumber: "TEST",
    date: new Date().toISOString(),
    dateText: config.connection === "BROWSER" ? `XP-C2008 - ${config.paperWidth}mm System Print` : `XP-C2008 - ${config.paperWidth}mm ESC/POS - Connection: ${connectionLabel(config.connection)}`,
    table: "Printer Test",
    customer: config.model || "XP-C2008",
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    paid: 0,
    change: 0,
    balance: 0,
    payments: [],
    footer: config.connection === "BROWSER" ? "Choose the printer in the system dialog and confirm paper output." : "Test successful",
  };
}

export function sampleReceipt(): ReceiptData {
  return {
    businessName: "Sajha Cafe",
    address: "Sample receipt - not a real sale",
    billNumber: "SAMPLE",
    orderNumber: "SAMPLE",
    date: new Date().toISOString(),
    dateText: new Date().toLocaleString(),
    table: "Table 1",
    customer: "Sample customer",
    items: [
      { name: "Chicken Momo", qty: 2, unitPrice: 260, total: 520 },
      { name: "Masala Tea", qty: 1, unitPrice: 80, total: 80 },
    ],
    subtotal: 531,
    discount: 0,
    tax: 69,
    total: 600,
    paid: 1000,
    change: 400,
    balance: 0,
    payments: [{ method: "CASH", amount: 1000 }],
    footer: "SAMPLE ONLY - NOT A REAL SALE",
  };
}

export function connectionLabel(connection: PrinterConfig["connection"]) {
  switch (connection) {
    case "WEB_SERIAL": return "Bluetooth Classic SPP";
    case "WEB_BLUETOOTH": return "Bluetooth LE / GATT";
    case "USB": return "USB";
    case "BLUETOOTH": return "Bluetooth Classic";
    case "NETWORK": return "Network bridge";
    case "BROWSER": return "Browser/System Print";
  }
}
