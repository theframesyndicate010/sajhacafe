# XP-C2008 receipt printing

Sajha Cafe formats receipts locally from its existing `Bill`, `OrderItem`, `OrderPayment`, and cafe settings data. Thermal output is ESC/POS; System Print is a separate browser/operating-system dialog path. There is no cloud printing service.

## Connection findings

The XP-C2008 label provided for this unit confirms USB, Bluetooth, ESC/POS, and 58 mm paper. It does not identify the Bluetooth profile. The model name alone is not enough to determine whether this unit exposes BLE/GATT or Bluetooth Classic SPP, so the app never reports Bluetooth connected until its chosen transport actually opens.

- **Web Bluetooth** can access BLE peripherals through GATT. It cannot open a Bluetooth Classic SPP/RFCOMM socket. Sajha Cafe labels this option `Bluetooth LE` and rejects devices that have no writable GATT characteristic.
- **Web Serial** can talk to paired Bluetooth Classic RFCOMM/SPP ports. Chrome supports this on desktop from Chrome 117 and on Android from Chrome 138. Pair the printer in OS Bluetooth settings first, then select the SPP port in Sajha Cafe. The app reports Connected only after the port opens. Browser/platform policy, the printer profile, or another app using the port can still prevent connection.
- **PWA mode** does not add hardware privileges. An installed PWA uses the same browser engine and secure-origin/user-permission rules as the browser. Chrome's Web Serial route remains available only where that browser/platform supports it.
- **USB** uses WebUSB raw bulk transfer when the printer exposes an accessible, unclaimed bulk endpoint. A USB printer driver can claim the interface first; in that case use the OS printer driver with System Print, or the local print bridge. On Android, USB requires OTG and an interface exposed to WebUSB. Wired USB serial is not a general Android Chrome Web Serial path.
- **Android native option**: the repository already contains a narrow, origin-checked Android WebView bridge using Bluetooth Classic SPP/RFCOMM. It is useful for Android devices/browsers without Web Serial support, and stores the printer address on-device. It is optional where Chrome 138+ can access the paired SPP port directly.
- **Desktop local bridge**: for other browsers, the local Node bridge can send over a host-configured Bluetooth SPP socket, raw device path, or raw TCP printer connection. Its “Ready” status means bridge/output configuration only; it does not pretend to hold an always-on printer connection.

## Configure and print

1. Open **Settings → Printer settings & test** and leave Paper width at **58mm** for this labeled unit.
2. For Bluetooth Classic direct from Chrome, pair the XP-C2008 in Android/computer Bluetooth settings. Select **Bluetooth Classic · Web Serial SPP**, press **Connect**, and choose the XP-C2008 serial/SPP port. Android Chrome requires version 138 or later; desktop Chrome requires version 117 or later. Use the native Android app on Android or the local bridge on the same desktop if this option is unavailable.
3. Press **Test Print**. Sajha Cafe reports that the print command was sent only after the selected transport accepted the write. Confirm paper physically came out; the printer does not provide paper-output acknowledgement to this application.
4. Press **Print Sample Receipt** to check 58 mm alignment, wrapping, amounts, and change. Sample data is explicitly marked as a sample and is never used for a sale.
5. For a real bill, choose **Thermal Print**. **System Print** opens the browser/OS print path and is not direct ESC/POS Bluetooth printing.

For USB, connect the printer (use OTG on Android), choose **USB · direct WebUSB**, grant browser device permission, and Connect. If WebUSB reports that the interface is unavailable or already claimed, use **System Print** with the installed OS printer driver or choose **USB · local bridge** on a desktop where the bridge can access a raw USB device path.

## Desktop local bridge fallback

Use Node.js 20.6+, Linux, Python 3 with Bluetooth socket support, and an already paired printer for SPP. In `print-bridge`, copy `.env.example` to `.env`, set a unique random `PRINT_BRIDGE_TOKEN` of at least 24 characters for this installation, set `PWA_ORIGIN` to the exact Sajha Cafe origin (no path or trailing slash), and set `PRINTER_BLUETOOTH_ADDRESS` (or one of the other output options). Start it with:

```sh
cd print-bridge
npm start
```

Enter `http://127.0.0.1:17891` and the same token under Settings → Printer, then select Bluetooth Classic · local bridge. Press Connect; it performs an actual short-lived RFCOMM connection probe. The PWA and bridge must run on the same computer: `127.0.0.1` on a phone points to the phone. Allow Sajha local-network access if Chrome prompts. Keep the bridge bound to localhost and do not forward its port to the internet.

## Unicode and ESC/POS

ASCII receipts use ESC/POS text commands on a 42-column Font B layout for 58 mm paper. Long item names wrap; large amounts are moved to labeled rows rather than overflowing. Cafe name, item names, and other non-ASCII text use locally rasterized receipt lines with the ESC/POS raster-image command, which avoids sending Nepali Unicode bytes to a printer code page that cannot decode them. The browser/device must have a font with the needed glyphs; inspect a physical Unicode sample before relying on it. No receipt content is sent to an external renderer.

Cut uses the ESC/POS partial-cut command. A command write response confirms transport acceptance, not that the printer physically cut or emitted paper.

## Validation limits

This repository's test workflow sends real ESC/POS data through the selected device API. The XP-C2008 itself was not connected during implementation, so Bluetooth profile selection, USB endpoint access, raster glyphs, paper alignment, and cut behavior still require the physical **Test Print** on the unit. Do not treat successful JS/API writes as a physical printer test.
