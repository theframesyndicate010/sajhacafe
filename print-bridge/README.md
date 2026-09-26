# Sajha Cafe local print bridge

Requires Node.js 20+. Runs only on `127.0.0.1` and is independent of the cloud API. Generate a long random `PRINT_BRIDGE_TOKEN`; configure the same token and the PWA origin (for example `https://cafe.example`) in Settings → Printer. Start it with `PRINT_BRIDGE_TOKEN=... PWA_ORIGIN=... npm start`.

Configure exactly one local output in the bridge environment:

- `PRINTER_HOST` and optional `PRINTER_PORT` (default 9100) for a printer's raw TCP socket.
- `PRINTER_DEVICE=/dev/usb/lp0` for a Linux raw USB/serial device or an OS-paired Bluetooth Classic serial device under `/dev/`.
- `PRINTER_BLUETOOTH_ADDRESS=10:22:33:46:C0:9E` and optional `PRINTER_BLUETOOTH_CHANNEL=1` for a paired Bluetooth Classic Serial Port Profile (RFCOMM) printer. The RFCOMM adapter uses Python 3's standard Bluetooth socket support; pair/trust the device with the OS first. The default SPP channel 1 worked for the supplied Printer001 during a direct ESC/POS test on this host.

The service does not perform Bluetooth pairing/discovery. USB and Bluetooth success depend on host drivers, device permissions, and printer command compatibility. Windows needs an OS-provided raw port/serial mapping; this minimal bridge intentionally does not install drivers or handle pairing. Keep token secrets on the local device and do not forward this port from a router or public interface. The bridge currently accepts one configured output at a time.

For Android, the intended adapter is a native Kotlin Android app embedding the PWA and providing a narrowly scoped print API. On Android 12+ it must request `BLUETOOTH_CONNECT` (and `BLUETOOTH_SCAN` only if it performs discovery), ask the user to pair/select the printer, then use `BluetoothDevice.createRfcommSocketToServiceRecord()` and write ESC/POS bytes to the resulting RFCOMM `BluetoothSocket`. Printer SPP service UUID is commonly `00001101-0000-1000-8000-00805F9B34FB`, but should be confirmed from the printer/OS; neither PIN nor MAC should be embedded in web code. Avoid exposing a broad `addJavascriptInterface` to arbitrary web content: keep the WebView origin allowlisted and the native operation narrowly scoped, or use an origin-checked message channel. The printer's exact RFCOMM profile and pairing behavior still need a real-device test. No Android wrapper is included in this web repository yet.

Endpoints (Bearer token required): `GET /status`, `GET /printers`, `POST /test-print`, `POST /print`. The HTTP response reports transport write success, not a physical paper sensor confirmation. Run a test print on each target printer before using it in sales.
