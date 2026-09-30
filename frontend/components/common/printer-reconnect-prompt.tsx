"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { readPrinterConfig, savePrinterConfig } from "@/lib/printing/config";
import { readAndroidNativePrinter } from "@/lib/printing/android-device-printer";
import { hasAndroidPrintBridge } from "@/lib/printing/android-bridge";
import { printerManager } from "@/lib/printing/printer-manager";

/** Attempts to restore saved Bluetooth access quietly; manual connection stays in Printer Settings. */
export function PrinterReconnectPrompt() {
  const { user, isLoading } = useAuth();
  const attempted = useRef(false);

  useEffect(() => {
    if (isLoading || !user || attempted.current) return;
    attempted.current = true;

    const saved = readPrinterConfig();
    if (saved.connection === "WEB_BLUETOOTH") {
      void (async () => {
        try {
          if (await printerManager.isConnected(saved)) return;
          const reconnected = await printerManager.reconnectAuthorizedPrinter(saved);
          if (reconnected) {
            savePrinterConfig({ ...saved, ...reconnected, model: reconnected.name ?? saved.model });
          }
        } catch {
          // Automatic reconnect is best effort. The user can connect manually in settings.
        }
      })();
      return;
    }

    // Android's native bridge can reconnect to a previously selected paired printer
    // without opening a system picker or asking the user to connect.
    if (hasAndroidPrintBridge() && readAndroidNativePrinter()) {
      void (async () => {
        try {
          if (!(await printerManager.isConnected(saved))) await printerManager.connect(saved);
        } catch {
          // Leave the saved printer available for the manual connection control.
        }
      })();
    }
  }, [isLoading, user]);

  return null;
}
