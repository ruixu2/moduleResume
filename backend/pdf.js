/* backend/pdf.js — 直接生成 PDF 文件（零第三方依赖）
   原理：查找本机 Edge/Chrome → headless 启动 → 通过 CDP(WebSocket) 调用 Page.printToPDF
   内置极简 WebSocket 客户端（文本帧），兼容 pkg 打包与 Electron 主进程（不依赖全局 WebSocket）
*/
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

function findBrowser() {
  const env = process.env.MODULERESUME_BROWSER || '';
  const cands = [
    env,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ].filter(Boolean);
  for (const c of cands) {
    try { if (fs.existsSync(c)) return c; } catch (e) { /* ignore */ }
  }
  return null;
}

/* ---------------- 极简 WebSocket 客户端（客户端掩码 / 文本帧 / 分片） ---------------- */
function sendFrame(socket, opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | len;
  } else if (len <= 0xffff) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode;
  const mask = crypto.randomBytes(4);
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i & 3];
  socket.write(Buffer.concat([header, mask, masked]));
}

function wsConnect(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const socket = net.connect(Number(u.port || 80), u.hostname);
    let done = false;
    let buffer = Buffer.alloc(0);
    let fragments = [];
    const listeners = [];
    const client = {
      send(obj) { try { sendFrame(socket, 1, Buffer.from(JSON.stringify(obj), 'utf8')); } catch (e) { /* ignore */ } },
      close() { try { socket.end(); } catch (e) { /* ignore */ } },
      onMessage(fn) { listeners.push(fn); },
    };
    socket.on('connect', () => {
      socket.write(
        'GET ' + (u.pathname || '/') + ' HTTP/1.1\r\n' +
        'Host: ' + u.host + '\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Key: ' + key + '\r\n' +
        'Sec-WebSocket-Version: 13\r\n\r\n'
      );
    });
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!done) {
        const idx = buffer.indexOf('\r\n\r\n');
        if (idx < 0) return;
        const head = buffer.slice(0, idx).toString('utf8');
        if (!/ 101 /.test(head)) { reject(new Error('WebSocket 握手失败：' + head.split('\r\n')[0])); try { socket.destroy(); } catch (e) {} return; }
        done = true;
        buffer = buffer.slice(idx + 4);
        resolve(client);
      }
      while (buffer.length >= 2) {
        const b0 = buffer[0], b1 = buffer[1];
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) === 0x80;
        let len = b1 & 0x7f;
        let off = 2;
        if (len === 126) { if (buffer.length < 4) return; len = buffer.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buffer.length < 10) return; len = Number(buffer.readBigUInt64BE(2)); off = 10; }
        let maskKey = null;
        if (masked) { if (buffer.length < off + 4) return; maskKey = buffer.slice(off, off + 4); off += 4; }
        if (buffer.length < off + len) return;
        let payload = buffer.slice(off, off + len);
        buffer = buffer.slice(off + len);
        if (masked && maskKey) for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i & 3];
        if (opcode === 1 || opcode === 0) {
          fragments.push(payload);
        } else if (opcode === 9) {
          sendFrame(socket, 10, payload);
          continue;
        } else if (opcode === 8) {
          try { socket.end(); } catch (e) { /* ignore */ }
          continue;
        } else {
          fragments = [];
          continue;
        }
        if ((b0 & 0x80) === 0x80) {
          const text = Buffer.concat(fragments).toString('utf8');
          fragments = [];
          for (const fn of listeners) { try { fn(text); } catch (e) { /* ignore */ } }
        }
      }
    });
    socket.on('error', err => { if (!done) reject(err); });
    socket.on('close', () => { /* ignore */ });
  });
}

/* ---------------- CDP 调用 ---------------- */
function cdpSession(client) {
  let id = 0;
  const pending = new Map();
  client.onMessage(text => {
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else p.resolve(msg.result || {});
    }
  });
  return (method, params, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    const timer = setTimeout(() => {
      if (pending.has(mid)) { pending.delete(mid); reject(new Error('CDP 超时：' + method)); }
    }, 30000);
    pending.set(mid, {
      resolve: r => { clearTimeout(timer); resolve(r); },
      reject: e => { clearTimeout(timer); reject(e); },
    });
    client.send({ id: mid, method: method, params: params || {}, sessionId: sessionId });
  });
}

/* ---------------- 对外接口：生成 PDF Buffer ---------------- */
async function exportPdf(renderUrl) {
  const exe = findBrowser();
  if (!exe) {
    const e = new Error('未找到 Edge / Chrome 浏览器，无法直接生成 PDF；可设置环境变量 MODULERESUME_BROWSER 指定浏览器路径');
    e.status = 501;
    throw e;
  }
  const profDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-pdf-'));
  const proc = spawn(exe, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--mute-audio', '--disable-extensions', '--remote-debugging-port=0',
    '--user-data-dir=' + profDir, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

  let client = null;
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let buf = '';
      const timer = setTimeout(() => reject(new Error('启动 PDF 引擎超时（Edge/Chrome 无响应）')), 20000);
      proc.stderr.on('data', d => {
        buf += d.toString();
        const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (m) { clearTimeout(timer); resolve(m[1]); }
      });
      proc.on('exit', () => { clearTimeout(timer); reject(new Error('PDF 引擎启动失败')); });
    });

    client = await wsConnect(wsUrl);
    const cdp = cdpSession(client);
    const created = await cdp('Target.createTarget', { url: renderUrl });
    const targetId = created.targetId;
    const attached = await cdp('Target.attachToTarget', { targetId: targetId, flatten: true });
    const sessionId = attached.sessionId;
    await cdp('Page.enable', {}, sessionId);

    for (let i = 0; i < 60; i++) {
      try {
        const r = await cdp('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, sessionId);
        if (r && r.result && r.result.value === 'complete') break;
      } catch (e) { /* 页面切换过程中可能短暂失败 */ }
      await new Promise(r2 => setTimeout(r2, 150));
    }
    await new Promise(r2 => setTimeout(r2, 400)); /* 字体/图片稳定 */

    const res = await cdp('Page.printToPDF', { printBackground: true, preferCSSPageSize: true }, sessionId);
    if (!res || !res.data) throw new Error('PDF 生成失败（无数据）');
    try { await cdp('Target.closeTarget', { targetId: targetId }); } catch (e) { /* ignore */ }
    return Buffer.from(res.data, 'base64');
  } finally {
    try { client && client.close(); } catch (e) { /* ignore */ }
    try { proc.kill(); } catch (e) { /* ignore */ }
    setTimeout(() => { try { fs.rmSync(profDir, { recursive: true, force: true }); } catch (e) { /* ignore */ } }, 900);
  }
}

module.exports = { exportPdf, findBrowser };

