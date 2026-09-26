import type { PrinterConfig, ReceiptData } from "./types";
import { printerManager } from "./printer-manager";
const pending = new Map<string, Promise<void>>();
export function enqueuePrint(id: string, receipt: ReceiptData, config: PrinterConfig, update: (state: "printing" | "printed" | "failed", error?: string) => void) {
  if (pending.has(id)) return;
  update("printing");
  const previous = [...pending.values()].at(-1) ?? Promise.resolve();
  const job = previous.catch(() => undefined).then(async () => { try { await printerManager.printReceipt(receipt, config); update("printed"); } catch (error) { update("failed", error instanceof Error ? error.message : "Print failed."); } }).finally(() => pending.delete(id));
  pending.set(id, job);
}
