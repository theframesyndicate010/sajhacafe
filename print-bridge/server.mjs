import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { randomUUID, timingSafeEqual } from "node:crypto";

const host = "127.0.0.1";
const port = Number(process.env.PORT || 17891);
const token = process.env.PRINT_BRIDGE_TOKEN;
if (!token || token.length < 24) throw new Error("Set PRINT_BRIDGE_TOKEN to a random value of at least 24 characters.");
const allowedOrigins = (process.env.PWA_ORIGIN || "").split(",").map(origin => origin.trim()).filter(Boolean);
const devicePath = process.env.PRINTER_DEVICE || "";
const networkHost = process.env.PRINTER_HOST || "";
const networkPort = Number(process.env.PRINTER_PORT || 9100);
const bluetoothAddress = process.env.PRINTER_BLUETOOTH_ADDRESS || "";
const bluetoothChannel = Number(process.env.PRINTER_BLUETOOTH_CHANNEL || 1);
const PRINT_TIMEOUT_MS = 120_000;
const queue = [];
let busy = false;
const jobs = new Map();

function escpos(receipt, width = 80, encoding = "utf-8") {
  const cols = width === 58 ? 42 : 64, itemWidths = width === 58 ? [13,3,13,10] : [26,4,18,13], out = [0x1b,0x40,0x1b,0x4d,1];
  const money = value => `NPR ${Number(value || 0).toLocaleString()}`;
  const text = (s) => { const chars = Array.from(String(s)); if (!chars.length) { out.push(10); return; } for(let i=0;i<chars.length;i+=cols) out.push(...Buffer.from(chars.slice(i,i+cols).join(""),"utf8"),10); };
  const wrapText = (value,max) => { const lines=[]; let current=""; for(const word of String(value).trim().split(/\s+/)) { if(Array.from(word).length>max) { if(current){lines.push(current);current="";} const chars=Array.from(word); for(let i=0;i<chars.length;i+=max) lines.push(chars.slice(i,i+max).join("")); } else if(!current) current=word; else if(Array.from(current).length+1+Array.from(word).length<=max) current+=` ${word}`; else {lines.push(current);current=word;} } if(current)lines.push(current); return lines.length?lines:[""]; };
  const pair = (a,b) => { const right=Array.from(String(b)).slice(-cols).join(""); const left=Array.from(String(a)); while(left.length>cols-Array.from(right).length-1) text(left.splice(0,cols-Array.from(right).length-1).join("")); const label=left.join(""); text(`${label}${" ".repeat(Math.max(1,cols-Array.from(label).length-Array.from(right).length))}${right}`); };
  const tableRow = cells => cells.map((value,index) => { const chars=Array.from(value); if(index===1) return value.padStart(Math.ceil(itemWidths[index]/2)+Math.ceil(chars.length/2)).padEnd(itemWidths[index]); return index>1?value.padStart(itemWidths[index]):value.padEnd(itemWidths[index]); }).join(" ");
  out.push(0x1b,0x61,1);
  if(receipt.logoRaster && Number.isInteger(receipt.logoRaster.width) && receipt.logoRaster.width > 0 && receipt.logoRaster.width <= (width === 58 ? 256 : 384) && Number.isInteger(receipt.logoRaster.height) && receipt.logoRaster.height > 0 && receipt.logoRaster.height <= 128 && typeof receipt.logoRaster.dataBase64 === "string") {
    const raster=Buffer.from(receipt.logoRaster.dataBase64,"base64"), rowBytes=Math.ceil(receipt.logoRaster.width/8), expected=rowBytes*receipt.logoRaster.height;
    if(raster.length!==expected) throw new Error("Invalid receipt logo raster data.");
    out.push(0x1d,0x76,0x30,0,rowBytes&255,rowBytes>>8,receipt.logoRaster.height&255,receipt.logoRaster.height>>8,...raster,10);
  }
  out.push(0x1b,0x45,1); text(receipt.businessName || "Cafe"); out.push(0x1b,0x45,0);
  if(receipt.address) text(receipt.address); if(receipt.contact) text(receipt.contact); if(receipt.taxNumber) text(`VAT/PAN: ${receipt.taxNumber}`);
  text(`Bill #${receipt.billNumber}`); text(receipt.dateText || new Date(receipt.date).toLocaleString());
  out.push(0x1b,0x61,0);
  text("- ".repeat(Math.ceil(cols / 2)));
  pair("Bill:",receipt.billNumber); pair("Table:",receipt.table || "Takeaway"); pair("Customer:",receipt.customer || "Walk-in customer");
  out.push(0x1b,0x45,1); text(tableRow(["Item","Qty","Unit price","Amount"])); out.push(0x1b,0x45,0); text(". ".repeat(Math.ceil(cols / 2)));
  for(const item of receipt.items || []) {
    const qty=String(item.qty), unitPrice=money(item.unitPrice), amount=money(item.total);
    if(qty.length>itemWidths[1]||unitPrice.length>itemWidths[2]||amount.length>itemWidths[3]) { text(item.name); pair("Qty",qty); pair("Unit price",unitPrice); pair("Amount",amount); }
    else if(Array.from(String(item.name)).length>itemWidths[0]) { for(const wrapped of wrapText(item.name,cols)) text(wrapped); text(tableRow(["",qty,unitPrice,amount])); }
    else text(tableRow([item.name,qty,unitPrice,amount]));
  }
  pair("Subtotal", money(receipt.subtotal)); pair("Discount", money(receipt.discount)); pair("Tax (included in price)", money(receipt.tax));
  text("- ".repeat(Math.ceil(cols / 2))); out.push(0x1b,0x45,1,0x1d,0x21,1); pair("Total", money(receipt.total)); out.push(0x1d,0x21,0,0x1b,0x45,0);
  pair("Amount paid", money(receipt.paid));
  if(Number(receipt.balance || 0)>0) { out.push(0x1b,0x45,1); pair("Balance due", money(receipt.balance)); out.push(0x1b,0x45,0); } else pair("Paid in full", "NPR 0 balance");
  if(receipt.change) pair("Change", money(receipt.change));
  out.push(0x1b,0x61,1); text(""); text(receipt.footer || "Thank you"); text(""); text(""); out.push(0x1d,0x56,0x42,0);
  const data = Buffer.from(out);
  return encoding === "ascii" ? Buffer.from(data.toString("utf8").normalize("NFKD").replace(/[^\x20-\x7e\n\r]/g,"?"),"ascii") : data;
}
function sendTcp(data) {
  return new Promise((resolve,reject) => { const socket = net.createConnection({ host: networkHost, port: networkPort }); socket.setTimeout(PRINT_TIMEOUT_MS); socket.once("connect", () => socket.end(data, resolve)); socket.once("error", reject); socket.once("timeout", () => socket.destroy(new Error("Printer connection timed out"))); });
}
async function sendDevice(data) {
  if (networkHost) return sendTcp(data);
  if (!devicePath) throw new Error("Printer unavailable: configure PRINTER_DEVICE (paired serial/USB raw device) or PRINTER_HOST and PRINTER_PORT in the local bridge.");
  if (!devicePath.startsWith("/dev/")) throw new Error("USB/Bluetooth device must be an OS configured raw device path under /dev.");
  await writeFile(devicePath, data);
}
function sendBluetooth(data) {
  if (!bluetoothAddress) throw new Error("Bluetooth unavailable: set PRINTER_BLUETOOTH_ADDRESS in the local bridge.");
  if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(bluetoothAddress)) throw new Error("Invalid local Bluetooth printer address.");
  return new Promise((resolve,reject) => {
    const source = "import socket,sys\na=sys.argv[1]\nc=int(sys.argv[2])\ns=socket.socket(socket.AF_BLUETOOTH,socket.SOCK_STREAM,socket.BTPROTO_RFCOMM)\ns.settimeout(120)\ns.connect((a,c))\nwhile True:\n d=sys.stdin.buffer.read(4096)\n if not d: break\n s.sendall(d)\ns.close()";
    const child=spawn(process.env.PYTHON || "python3",["-c",source,bluetoothAddress,String(bluetoothChannel)],{stdio:["pipe","ignore","pipe"]});
    let errorText=""; child.stderr.on("data",chunk=>errorText+=chunk);
    child.once("error",error=>reject(new Error(`Bluetooth unavailable: ${error.message}`)));
    child.once("close",code=>code===0?resolve():reject(new Error(`Bluetooth unavailable: ${errorText.trim() || `RFCOMM exited ${code}`}`)));
    child.stdin.on("error",()=>{}); child.stdin.end(data);
  });
}
async function processQueue() {
  if(busy) return; busy = true;
  while(queue.length) { const job = queue.shift(); try { if(job.connection === "BLUETOOTH") await sendBluetooth(job.data); else await sendDevice(job.data); jobs.set(job.id,{status:"printed"}); } catch(error) { jobs.set(job.id,{status:"failed",error:error.message}); } }
  busy = false;
}
function reply(res, status, data) { res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"}); res.end(JSON.stringify(data)); }
const server = http.createServer(async (req,res) => {
  const origin = req.headers.origin;
  if(origin && allowedOrigins.length && !allowedOrigins.includes(origin)) return reply(res,403,{error:"Origin not allowed"});
  if(origin) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary","Origin"); res.setHeader("Access-Control-Allow-Headers","Authorization,Content-Type"); res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS"); }
  if(req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const auth = req.headers.authorization || "", provided = Buffer.from(auth.replace(/^Bearer\s+/i,"")), expected = Buffer.from(token);
  if(provided.length !== expected.length || !timingSafeEqual(provided,expected)) return reply(res,401,{error:"Invalid print bridge token"});
  const chunks=[]; for await (const chunk of req) chunks.push(chunk);
  let body={}; try { if(chunks.length) body=JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return reply(res,400,{error:"Invalid JSON"}); }
  if(req.method === "GET" && req.url === "/status") return reply(res,200,{status:"running",transport:bluetoothAddress?"bluetooth":networkHost?"network":devicePath?"device":"unconfigured",queueLength:queue.length});
  if(req.method === "GET" && req.url === "/printers") return reply(res,200,{printers:bluetoothAddress||networkHost||devicePath?[{id:"default",name:bluetoothAddress||networkHost||devicePath,connection:bluetoothAddress?"BLUETOOTH":networkHost?"NETWORK":"LOCAL_DEVICE"}]:[]});
  if(req.method === "POST" && ["/print","/test-print"].includes(req.url)) {
    const receipt = req.url === "/test-print" ? {businessName:"SAJHA CAFE",billNumber:"TEST",date:new Date().toISOString(),items:[{name:"Thermal printer test",qty:1,unitPrice:1,total:1}],subtotal:1,total:1,paid:1,footer:"Test print successful"} : body.receipt;
    if(!receipt || !Array.isArray(receipt.items)) return reply(res,400,{error:"Receipt payload is required"});
    const id=randomUUID(); jobs.set(id,{status:"queued"});
    const data=escpos(receipt,body.paperWidth,body.encoding);
    const safeCopies=Math.min(5,Math.max(1,Number(body.copies)||1));
    queue.push({id,data:Buffer.concat(Array.from({length:safeCopies},()=>data)),connection:body.connection}); void processQueue();
    // Wait for transport result so the UI does not show success before bytes were accepted.
    const until=Date.now()+PRINT_TIMEOUT_MS; while(jobs.get(id)?.status==="queued" && Date.now()<until) await new Promise(r=>setTimeout(r,100));
    const result=jobs.get(id); return result?.status==="printed"?reply(res,200,{jobId:id,status:result.status}):reply(res,503,{jobId:id,error:result?.error || "Print timed out"});
  }
  reply(res,404,{error:"Not found"});
});
server.listen(port,host,()=>console.log(`Sajha print bridge listening on http://${host}:${port}`));
server.requestTimeout = PRINT_TIMEOUT_MS;
