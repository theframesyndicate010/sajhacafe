# Sajha Cafe Android print wrapper

This wrapper loads the existing PWA in an Android WebView and supplies a narrowly scoped, origin-checked native print channel. Paired Bluetooth device addresses stay in Android preferences; the web app sees only a display name and opaque printer id. ESC/POS is formatted by the existing frontend formatter and written through Android Bluetooth Classic RFCOMM using the Serial Port Profile UUID.

## Build

Install Android Studio (or JDK 17, Gradle 8.13, Android SDK Platform 36, and Build Tools 35.0.0). This workspace does not include the Android SDK or Gradle wrapper binary, so the APK cannot be built from the current agent environment.

For an Android emulator talking to a Next.js dev server on the same computer:

```sh
gradle -PpwaUrl=http://10.0.2.2:3001 :app:assembleDebug
```

For a physical phone during development, use the computer's LAN address in `pwaUrl` (the phone and computer must be on the same network). For release builds, use the deployed HTTPS PWA URL; release builds disallow cleartext HTTP.

## Use

1. Install and launch the debug APK on the Android phone.
2. Allow Sajha Cafe's **Nearby devices** permission.
3. Pair Printer001 in Android **Settings → Bluetooth** first. The app does not scan, pair automatically, or embed the PIN.
4. Open Sajha Cafe **Settings → Printer**, select the paired printer, press **Connect Printer**, then **Test Print**. Save paper width, copies, encoding, and auto-print settings in the PWA.
5. Open a bill and use **Thermal Print**, or enable auto print to send on receipt navigation after a successful sale.

The app requests only `BLUETOOTH_CONNECT`, uses secure SPP/RFCOMM sockets, and accepts native messages only from the exact configured PWA origin and top-level frame. Android Bluetooth permission and physical-device printer testing are still required before calling a mobile print successful. The printer returns no paper sensor acknowledgement, so native `printed` means the socket write completed.
