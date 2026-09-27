export type AndroidNativePrinter = {
  transport: "android-native";
  address: string;
  name?: string;
};

const KEY = "sajha.android.printer.v1";

export function readAndroidNativePrinter(): AndroidNativePrinter | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<AndroidNativePrinter>;
    const address = typeof parsed.address === "string" ? parsed.address.trim() : "";
    if (!address || parsed.transport !== "android-native") return null;
    return { transport: "android-native", address, name: typeof parsed.name === "string" ? parsed.name : undefined };
  } catch {
    return null;
  }
}

export function saveAndroidNativePrinter(printer: AndroidNativePrinter): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify({ transport: "android-native", address: printer.address.trim(), name: printer.name ?? "XP-C2008" }));
}

export function clearAndroidNativePrinter(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
