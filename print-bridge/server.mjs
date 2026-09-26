import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { access, open } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { randomUUID, timingSafeEqual } from "node:crypto";

const host = "127.0.0.1";
const port = Number(process.env.PORT || 17891);
const token = process.env.PRINT_BRIDGE_TOKEN;
if (!token || token.length < 24) throw new Error("Set PRINT_BRIDGE_TOKEN to a random value of at least 24 characters.");
const allowedOrigins = (process.env.PWA_ORIGIN || "").split(",").map(origin => origin.trim()).filter(Boolean);
if (!allowedOrigins.length) throw new Error("Set PWA_ORIGIN to the exact Sajha Cafe site origin (scheme + host + optional port), for example http://localhost:3001.");
for (const origin of allowedOrigins) {
  try { if (new URL(origin).origin !== origin) throw new Error(); }
  catch { throw new Error(`Invalid PWA_ORIGIN value: ${origin}. Set origins only, without a path or trailing slash.`); }
}
const devicePath = process.env.PRINTER_DEVICE || "";
const networkHost = process.env.PRINTER_HOST || "";
const networkPort = Number(process.env.PRINTER_PORT || 9100);
const bluetoothAddress = process.env.PRINTER_BLUETOOTH_ADDRESS || "";
const bluetoothChannel = Number(process.env.PRINTER_BLUETOOTH_CHANNEL || 1);
const configuredTransports = [Boolean(devicePath), Boolean(networkHost), Boolean(bluetoothAddress)].filter(Boolean).length;
if (configuredTransports > 1) throw new Error("Configure only one of PRINTER_DEVICE, PRINTER_HOST, or PRINTER_BLUETOOTH_ADDRESS in the local bridge.");
const PRINT_TIMEOUT_MS = 120_000;
const queue = [];
let busy = false;
const jobs = new Map();

function tcpSocket() {
  return new Promise((resolve, reject) => {
    if (!networkHost) return reject(Object.assign(new Error("No network printer is configured."), { code: "not_configured" }));
    const socket = net.createConnection({ host: networkHost, port: networkPort });
    socket.setTimeout(10_000);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
    socket.once("timeout", () => socket.destroy(new Error("Network printer connection timed out.")));
  });
}
async function sendTcp(data) {
  const socket = await tcpSocket();
  await new Promise((resolve, reject) => { socket.once("error", reject); socket.end(data, resolve); });
}
async function sendDevice(data) {
  if (!devicePath) throw Object.assign(new Error("No raw USB/serial printer is configured. Set PRINTER_DEVICE."), { code: "not_configured" });
  if (!devicePath.startsWith("/dev/")) throw Object.assign(new Error("This bridge requires a Linux raw device path under /dev for USB/serial printing. Windows needs an OS-provided raw or serial port."), { code: "not_configured" });
  const handle = await open(devicePath, "w");
  try {
    let offset = 0;
    while (offset < data.length) {
      const { bytesWritten } = await handle.write(data, offset, data.length - offset);
      if (!bytesWritten) throw new Error("USB printer accepted zero bytes.");
      offset += bytesWritten;
    }
    await handle.sync().catch(() => undefined);
  } finally { await handle.close(); }
}
function bluetoothSocket(data = Buffer.alloc(0)) {
  return new Promise((resolve, reject) => {
    if (!bluetoothAddress) return reject(Object.assign(new Error("No Bluetooth printer is configured. Set PRINTER_BLUETOOTH_ADDRESS."), { code: "not_configured" }));
    if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(bluetoothAddress)) return reject(Object.assign(new Error("Invalid local Bluetooth printer address."), { code: "not_configured" }));
    const source = "import socket,sys\na=sys.argv[1]\nc=int(sys.argv[2])\ns=socket.socket(socket.AF_BLUETOOTH,socket.SOCK_STREAM,socket.BTPROTO_RFCOMM)\ns.settimeout(12)\ns.connect((a,c))\nwhile True:\n d=sys.stdin.buffer.read(4096)\n if not d: break\n s.sendall(d)\ns.close()";
    const child = spawn(process.env.PYTHON || "python3", ["-c", source, bluetoothAddress, String(bluetoothChannel)], { stdio: ["pipe", "ignore", "pipe"] });
    let errorText = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(Object.assign(new Error("Bluetooth SPP connection timed out. Check printer power, pairing, SPP channel, and whether another device is connected."), { code: "printer_connection" })); }, 15_000);
    child.stderr.on("data", chunk => errorText += chunk);
    child.once("error", error => { clearTimeout(timer); reject(Object.assign(new Error(`Bluetooth transport could not start: ${error.message}. This bridge requires Python with Linux Bluetooth socket support.`), { code: "printer_connection" })); });
    child.once("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else if (/Host is down|No route to host|not available|not found|Network is down/i.test(errorText)) reject(Object.assign(new Error("Bluetooth printer not found or unavailable. Pair the XP-C2008 on this computer, confirm it is powered on, and check its Bluetooth address in the bridge settings."), { code: "printer_not_found" }));
      else if (/Device or resource busy|Address already in use/i.test(errorText)) reject(Object.assign(new Error("Bluetooth printer is busy, probably because another device or app currently holds its SPP connection. Disconnect that client, wait a few seconds, then retry."), { code: "printer_busy" }));
      else if (/AF_BLUETOOTH|BTPROTO_RFCOMM|Bluetooth protocol not available/i.test(errorText)) reject(Object.assign(new Error("This bridge host does not provide Bluetooth Classic RFCOMM support. Use a Linux host with Bluetooth socket support, Chrome Web Serial SPP, or the Android printer wrapper."), { code: "printer_connection" }));
      else reject(Object.assign(new Error(`Bluetooth SPP connection failed: ${errorText.trim() || `RFCOMM exited ${code}`}. Confirm the printer uses SPP and the configured RFCOMM channel is correct.`), { code: "printer_connection" }));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(data);
  });
}
async function checkPrinter(connection) {
  if (connection === "BLUETOOTH") {
    await bluetoothSocket();
    return { transport: "bluetooth", message: "The bridge opened and closed an SPP connection to the printer. It reconnects for each print job." };
  }
  if (connection === "NETWORK") {
    const socket = await tcpSocket();
    socket.destroy();
    return { transport: "network", message: "The bridge reached the configured network printer port. It reconnects for each print job." };
  }
  if (connection === "LOCAL_USB") {
    if (!devicePath) throw Object.assign(new Error("No USB raw device is configured. Set PRINTER_DEVICE to the printer's Linux device path."), { code: "not_configured" });
    if (!devicePath.startsWith("/dev/")) throw Object.assign(new Error("The configured USB path is not a Linux /dev device. Windows needs an OS-provided raw or serial port."), { code: "not_configured" });
    try { await access(devicePath, fsConstants.W_OK); }
    catch { throw Object.assign(new Error("USB printer device not found or not writable. Check the cable, device path, and host permissions."), { code: "printer_not_found" }); }
    return { transport: "device", message: "The configured USB device exists and is writable. Physical output is confirmed only by a test print." };
  }
  throw Object.assign(new Error("The bridge output does not match the selected connection method."), { code: "not_configured" });
}
function normalizePrinterError(error) {
  const code = error?.code;
  if (["printer_not_found", "printer_busy", "printer_connection", "not_configured"].includes(code)) return { code, message: error.message };
  if (["ENOENT", "ENODEV"].includes(code)) return { code: "printer_not_found", message: "The configured printer device or Bluetooth adapter was not found. Check the connection and local device path." };
  if (code === "EBUSY") return { code: "printer_busy", message: "The printer is busy. Close other apps using it, wait a few seconds, and retry." };
  if (["EACCES", "EPERM"].includes(code)) return { code: "printer_connection", message: "The bridge process does not have permission to access the printer device. Check OS pairing and device permissions." };
  if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) return { code: "printer_connection", message: "The printer connection failed. Check that it is powered on, paired, and not in use by another app." };
  return { code: "printer_connection", message: error?.message || "Printer connection failed." };
}
async function processQueue() {
  if(busy) return; busy = true;
  while(queue.length) { const job = queue.shift(); try { if(job.connection === "BLUETOOTH") await bluetoothSocket(job.data); else if(job.connection === "NETWORK") await sendTcp(job.data); else if(job.connection === "LOCAL_USB") await sendDevice(job.data); else throw Object.assign(new Error("Unsupported printer connection method."), { code: "not_configured" }); jobs.set(job.id,{status:"printed"}); } catch(error) { const failure=normalizePrinterError(error); jobs.set(job.id,{status:"failed",error:failure.message,code:failure.code}); } }
  busy = false;
}
function reply(res, status, data) { res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"}); res.end(JSON.stringify(data)); }
const server = http.createServer(async (req,res) => {
  const origin = req.headers.origin;
  if(origin && !allowedOrigins.includes(origin)) return reply(res,403,{error:"Origin not allowed",code:"origin_not_allowed"});
  if(origin) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary","Origin"); res.setHeader("Access-Control-Allow-Headers","Authorization,Content-Type"); res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS"); }
  if(req.headers["access-control-request-private-network"] === "true") res.setHeader("Access-Control-Allow-Private-Network","true");
  if(req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const auth = req.headers.authorization || "", provided = Buffer.from(auth.replace(/^Bearer\s+/i,"")), expected = Buffer.from(token);
  if(provided.length !== expected.length || !timingSafeEqual(provided,expected)) return reply(res,401,{error:"Invalid print bridge token",code:"authentication_failed"});
  const chunks=[]; let requestSize=0;
  for await (const chunk of req) { requestSize+=chunk.length; if(requestSize>8_000_000) return reply(res,413,{error:"Print request exceeds the local bridge limit"}); chunks.push(chunk); }
  let body={}; try { if(chunks.length) body=JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return reply(res,400,{error:"Invalid JSON"}); }
  const transport = bluetoothAddress ? "bluetooth" : networkHost ? "network" : devicePath ? "device" : "unconfigured";
  if(req.method === "GET" && req.url === "/status") return reply(res,200,{status:"running",transport,printerConfigured:transport!=="unconfigured",printerConnection:"checked-on-connect-and-print",queueLength:queue.length});
  if(req.method === "GET" && req.url === "/printers") return reply(res,200,{printers:transport==="unconfigured"?[]:[{id:"default",name:bluetoothAddress?"Bluetooth SPP thermal printer":networkHost?"Network thermal printer":"USB/serial thermal printer",connection:bluetoothAddress?"BLUETOOTH":networkHost?"NETWORK":"LOCAL_USB",configured:true}]});
  if(req.method === "POST" && req.url === "/connect") {
    try { const result = await checkPrinter(body.connection); return reply(res,200,{status:"ready",...result}); }
    catch(error) { const failure=normalizePrinterError(error); return reply(res,503,{error:failure.message,code:failure.code}); }
  }
  if(req.method === "POST" && ["/print","/test-print"].includes(req.url)) {
    const hasRawData = typeof body.dataBase64 === "string";
    if(!hasRawData || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.dataBase64) || body.dataBase64.length > 7_000_000) return reply(res,400,{error:"Encoded ESC/POS bytes are required; format the bill in the Sajha print service.",code:"invalid_payload"});
    if(!["BLUETOOTH","NETWORK","LOCAL_USB"].includes(body.connection)) return reply(res,400,{error:"The bridge connection method must be Bluetooth, Network, or USB via bridge.",code:"invalid_connection"});
    const data=Buffer.from(body.dataBase64,"base64");
    if(data.length > 5_000_000) return reply(res,400,{error:"ESC/POS payload exceeds the local bridge limit",code:"invalid_payload"});
    const id=randomUUID(); jobs.set(id,{status:"queued"});
    const safeCopies=Math.min(5,Math.max(1,Number(body.copies)||1));
    queue.push({id,data:Buffer.concat(Array.from({length:safeCopies},()=>data)),connection:body.connection}); void processQueue();
    const until=Date.now()+PRINT_TIMEOUT_MS; while(jobs.get(id)?.status==="queued" && Date.now()<until) await new Promise(r=>setTimeout(r,100));
    const result=jobs.get(id);
    return result?.status==="printed"?reply(res,200,{jobId:id,status:result.status}):reply(res,503,{jobId:id,error:result?.error || "Print timed out",code:result?.code || "printer_connection"});
  }
  reply(res,404,{error:"Not found"});
});
server.listen(port,host,()=>console.log(`Sajha print bridge listening on http://${host}:${port}`));
server.requestTimeout = PRINT_TIMEOUT_MS;
