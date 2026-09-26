# Sajha Cafe local print bridge

Requires Node.js 20.6+. Runs only on `127.0.0.1` and is independent of the cloud API. Copy `.env.example` to `.env`, set a random per-installation `PRINT_BRIDGE_TOKEN` of at least 24 characters, and set `PWA_ORIGIN` to the exact Sajha origin (scheme, host, optional port; no path or trailing slash). The bridge refuses to start without it. Start with `npm start`.

Configure one local output in `.env`:

- `PRINTER_HOST` and optional `PRINTER_PORT` (default 9100) for a printer's raw TCP socket.
- `PRINTER_DEVICE=/dev/usb/lp0` for a Linux raw USB/serial device or an OS-paired Bluetooth Classic serial device under `/dev/`.
- `PRINTER_BLUETOOTH_ADDRESS` and optional `PRINTER_BLUETOOTH_CHANNEL=1` for a paired Bluetooth Classic SPP/RFCOMM printer. Linux, Python 3 with Bluetooth socket support, a powered Bluetooth adapter, and an OS-paired printer are required. Pair the device first; the XP-C2008 label does not identify its profile or RFCOMM channel.

The bridge does not pair or discover devices. **Connect** checks that the bridge is reachable and then opens/closes the configured SPP socket (or checks a raw USB/network path); each print job opens its own device connection. Thus **Ready** means the bridge and printer transport were reachable during that check, not that an always-on socket is held. Windows needs an OS-provided raw port/serial mapping. Keep the token on the local device and never forward this port to the internet.

An origin-checked Android WebView wrapper is available in `android-app/`; it uses Bluetooth Classic SPP/RFCOMM. On supported Chrome versions, the PWA can also use Web Serial directly (desktop Chrome 117+, Android Chrome 138+), if the XP-C2008 unit exposes SPP. The label confirms Bluetooth but not its profile, so confirm the actual connection using a physical test print.

Endpoints (Bearer token required): `GET /status`, `GET /printers`, `POST /connect`, `POST /test-print`, `POST /print`. The app formats ESC/POS locally (including rasterized Unicode) and sends base64 encoded command bytes; the bridge does not re-encode receipt text. Responses report transport write success, not physical paper sensor confirmation. Test each printer before using it for sales.

The PWA and bridge must run on the same computer when using `127.0.0.1`. A phone's `127.0.0.1` is the phone itself, not a desktop bridge. For Android, use supported Chrome Web Serial SPP or the existing Android SPP wrapper. Chrome may also ask permission for Sajha to access the local network; allow it for the Sajha origin.
