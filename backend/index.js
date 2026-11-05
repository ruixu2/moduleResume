/* moduleResume · Node.js 本地服务（零依赖，node:http 实现）
   - REST API：分块读写 profile / blocks / variants / applications / settings
   - 渲染与导出：/render/{vid}（预览/打印）、/api/export/{vid}.md|.html
   - 前端静态页面托管（兼容 pkg 快照）
*/
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { version: appVersion } = require('../package.json');
const STARTED_AT = Date.now();

const { RESOURCE_ROOT, IS_PKG, dataDir } = require('./paths');
const storage = require('./storage');
const render = require('./render');
const themes = require('./themes');
const pdf = require('./pdf');
const resumeAi = require('./resume-ai');

const FRONTEND = path.join(RESOURCE_ROOT, 'frontend');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/* ---------------- 响应工具 ---------------- */
function sendJson(res, obj, status) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
  res.end(body);
}

function sendText(res, text, type, headers) {
  const body = Buffer.from(String(text), 'utf8');
  res.writeHead(200, Object.assign({
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Content-Length': body.length,
  }, headers || {}));
  res.end(body);
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) return sendJson(res, { error: 'not found' }, 404);
  const body = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': body.length });
  res.end(body);
}

function sendBuffer(res, buf, type, headers) {
  res.writeHead(200, Object.assign({
    'Content-Type': type || 'application/octet-stream',
    'Content-Length': buf.length,
  }, headers || {}));
  res.end(buf);
}

/* 本机服务自身地址（供无头浏览器渲染导出 PDF 使用） */
function selfBase() {
  const addr = server.address();
  const port = addr && addr.port ? addr.port : 8787;
  return 'http://127.0.0.1:' + port;
}

function readBody(req, limit) {
  limit = limit || 128 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const text = await readBody(req);
  return text ? JSON.parse(text) : null;
}

/* ---------------- 重启软件 ---------------- */
let restartHook = null;
let restarting = false;

function runtimeMode() {
  if (process.versions && process.versions.electron) return 'electron';
  if (IS_PKG) return 'exe';
  return 'node';
}

function isLocalRequest(req) {
  const addr = String((req.socket && req.socket.remoteAddress) || '');
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

/* 启动继任进程：EXE 直接重启自身；开发模式用 node 重启 run.js */
function spawnSuccessor() {
  const args = process.argv.slice(2);
  /* 旧页面会在服务恢复后自动刷新，避免新进程再开一个重复标签页 */
  if (args.indexOf('--no-browser') < 0) args.push('--no-browser');
  const env = Object.assign({}, process.env);
  if (IS_PKG) {
    /* pkg 会给子进程注入 PKG_EXECPATH 并按该变量调整 argv；
       置空后按“直接启动”处理，避免用户参数被移位。 */
    env.PKG_EXECPATH = '';
  }
  const cmd = process.execPath;
  const cmdArgs = IS_PKG ? args : [process.argv[1]].concat(args).filter(Boolean);
  const child = spawn(cmd, cmdArgs, {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
    env,
    windowsHide: true,
  });
  child.unref();
}

function scheduleRestart() {
  if (typeof restartHook === 'function') {
    try { restartHook(); return; }
    catch (err) { console.error('[moduleResume] 重启失败：', err); }
  }
  let launched = false;
  const launch = () => {
    if (launched) return;
    launched = true;
    try { spawnSuccessor(); }
    catch (err) { console.error('[moduleResume] 重启失败：', err); }
    process.exit(0);
  };
  try {
    server.close(launch);
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  } catch (err) { launch(); }
  setTimeout(launch, 1500).unref();
}

function findVariant(vid) {
  const variants = storage.load('variants') || [];
  const v = variants.find(x => x.id === vid);
  if (!v) { const e = new Error('variant not found: ' + vid); e.status = 404; throw e; }
  return v;
}

function findSnapshot(sid) {
  const snap = (storage.load('snapshots') || []).find(x => x.id === sid);
  if (!snap) { const e = new Error('snapshot not found: ' + sid); e.status = 404; throw e; }
  return snap;
}

function snapshotMeta(s) {
  return { id: s.id, variantId: s.variantId, name: s.name, created: s.created, note: s.note || '' };
}

/* 冻结一个版本：保存当时的 variant + 被引用的素材块 + 主档 + 照片 */
function createSnapshot(variantId, note) {
  const v = findVariant(variantId);
  const byId = {};
  for (const b of storage.load('blocks') || []) byId[b.id] = b;
  const blocks = [];
  for (const sec of v.sections || []) {
    for (const it of sec.items || []) {
      if (byId[it.bid] && !blocks.some(b => b.id === it.bid)) blocks.push(byId[it.bid]);
      for (const advisorId of (Array.isArray(it.advisorIds) ? it.advisorIds : [])) {
        if (byId[advisorId] && !blocks.some(b => b.id === advisorId)) blocks.push(byId[advisorId]);
      }
    }
  }
  const profile = storage.load('profile') || {};
  const photo = photoDataUriFor(resolvePhotoFile(profile, v));
  const snap = {
    id: 'snap-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    variantId: v.id,
    name: v.name || '未命名版本',
    created: new Date().toISOString(),
    variant: JSON.parse(JSON.stringify(v)),
    blocks,
    profile: JSON.parse(JSON.stringify(profile)),
    photo,
    note: note || '',
  };
  const list = storage.load('snapshots') || [];
  list.unshift(snap);
  storage.save('snapshots', list);
  return snap;
}

/* ---------------- 照片（多版本，作用于当前个人项目） ---------------- */
function photoFilePath(file) {
  if (!file) return null;
  const safe = path.basename(String(file));
  const assets = storage.assetsDir();
  const p1 = path.join(assets, 'photos', safe);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(assets, safe);
  if (fs.existsSync(p2)) return p2;
  return null;
}
/* 解析版本实际使用的照片文件：variant.photoId > profile.photoId > 第一张 > 旧字段 photo */
function resolvePhotoFile(profile, variant) {
  const list = (profile && Array.isArray(profile.photos)) ? profile.photos : [];
  const id = (variant && variant.photoId) || (profile && profile.photoId);
  const p = list.find(x => x.id === id) || list[0];
  if (p && p.file) return p.file;
  if (profile && profile.photo) return path.basename(profile.photo);
  return '';
}
function photoDataUriFor(file) {
  const fp = photoFilePath(file);
  return fp ? 'data:image/jpeg;base64,' + fs.readFileSync(fp).toString('base64') : '';
}
function photoUrlFor(file) {
  if (!file) return '';
  const safe = path.basename(String(file));
  const assets = storage.assetsDir();
  if (fs.existsSync(path.join(assets, 'photos', safe))) return '/assets/photos/' + encodeURIComponent(safe);
  if (fs.existsSync(path.join(assets, safe))) return '/assets/photo';
  return '';
}

function contentDisposition(name) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/* ---------------- 路由 ---------------- */
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(u.pathname);
    const m = (req.method || 'GET').toUpperCase();

    /* --- 静态资源 --- */
    if (m === 'GET' && (p === '/' || p === '/index.html')) {
      return sendFile(res, path.join(FRONTEND, 'index.html'));
    }
    if (m === 'GET' && p.startsWith('/static/')) {
      const rel = p.slice('/static/'.length).split('/').filter(Boolean).map(s => s.replace(/\.\./g, '')).join(path.sep);
      const fp = path.join(FRONTEND, rel);
      if (!fp.startsWith(FRONTEND)) return sendJson(res, { error: 'forbidden' }, 403);
      return sendFile(res, fp);
    }
    if (m === 'GET' && p === '/assets/photo') {
      const profile = storage.load('profile') || {};
      const fp = photoFilePath(resolvePhotoFile(profile, null));
      if (!fp) return sendJson(res, { error: 'no photo' }, 404);
      return sendFile(res, fp);
    }
    const photoAsset = p.match(/^\/assets\/photos\/([^/]+)$/);
    if (m === 'GET' && photoAsset) {
      const safe = path.basename(decodeURIComponent(photoAsset[1]));
      if (!/^[\w.\-]+\.(jpe?g|png|webp)$/i.test(safe)) return sendJson(res, { error: 'forbidden' }, 403);
      const fp = path.join(storage.assetsDir(), 'photos', safe);
      if (!fs.existsSync(fp)) return sendJson(res, { error: 'not found' }, 404);
      return sendFile(res, fp);
    }
    const materialAsset = p.match(/^\/assets\/materials\/([^/]+)$/);
    if (m === 'GET' && materialAsset) {
      const safe = path.basename(decodeURIComponent(materialAsset[1]));
      if (!/^[\w.\-]+\.(jpe?g|png|webp|gif|pdf)$/i.test(safe)) return sendJson(res, { error: 'forbidden' }, 403);
      const fp = path.join(storage.assetsDir(), 'materials', safe);
      if (!fs.existsSync(fp)) return sendJson(res, { error: 'not found' }, 404);
      return sendFile(res, fp);
    }

    /* --- API --- */
    if (p === '/api/health') {
      return sendJson(res, {
        ok: true, app: 'moduleResume', version: appVersion,
        runtime: 'node ' + process.version, packaged: IS_PKG, mode: runtimeMode(),
        started: STARTED_AT, data_dir: dataDir(),
      });
    }

    if (p === '/api/restart' && m === 'POST') {
      if (!isLocalRequest(req)) return sendJson(res, { error: '仅允许在本机重启软件。' }, 403);
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
        return sendJson(res, { error: '请求必须使用 JSON 格式。' }, 415);
      }
      try { await readJson(req); }
      catch (e) { return sendJson(res, { error: '请求内容格式不正确。' }, 400); }
      if (restarting) return sendJson(res, { ok: true, restarting: true, mode: runtimeMode() });
      restarting = true;
      res.once('finish', () => setTimeout(scheduleRestart, 120));
      return sendJson(res, { ok: true, mode: runtimeMode() });
    }

    if (p === '/api/themes' && m === 'GET') return sendJson(res, themes.list());

    if ((p === '/api/ai/extract' || p === '/api/ai/import') && m === 'POST') {
      res.setHeader('Cache-Control', 'no-store');
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
        return sendJson(res, { error: '请求必须使用 JSON 格式。' }, 415);
      }
      const body = await readJson(req);
      if (p === '/api/ai/extract') return sendJson(res, await resumeAi.extractResume(body));
      if (!body || !body.projectId || storage.currentId() !== body.projectId) {
        return sendJson(res, { error: '当前项目已切换，请重新打开提取结果。' }, 409);
      }
      const workspace = storage.loadAll();
      const selected = resumeAi.normalizeResult({ profile: body.profile || {}, blocks: body.blocks || [] });
      for (const key of Object.keys(selected.profile)) {
        const before = body.expectedProfile && body.expectedProfile[key];
        if (String(before == null ? '' : before) !== String((workspace.profile || {})[key] || '')) {
          return sendJson(res, { error: '基础信息已被修改，请重新打开提取结果后再导入。' }, 409);
        }
      }
      const merged = resumeAi.buildImport({ ...selected, createVersion: body.createVersion, versionName: body.versionName }, workspace);
      const changes = [];
      if (merged.importedProfileFields) changes.push(['profile', merged.profile]);
      if (merged.importedBlocks) changes.push(['blocks', merged.blocks]);
      if (merged.versionId) changes.push(['variants', merged.variants]);
      try {
        for (const [name, value] of changes) storage.save(name, value);
      } catch (e) {
        for (const [name] of changes) { try { storage.save(name, workspace[name]); } catch (_) { /* best-effort rollback */ } }
        throw e;
      }
      return sendJson(res, { importedBlocks: merged.importedBlocks, importedProfileFields: merged.importedProfileFields, versionId: merged.versionId });
    }

    /* --- 个人项目（多工作区） --- */
    if (p === '/api/projects') {
      if (m === 'GET') return sendJson(res, storage.info());
      if (m === 'POST') {
        const body = await readJson(req);
        const proj = storage.createProject(body && body.name);
        return sendJson(res, { project: proj, info: storage.info() });
      }
    }
    if (p === '/api/projects/switch' && m === 'POST') {
      const body = await readJson(req);
      return sendJson(res, storage.switchProject(String((body && body.id) || '')));
    }
    const prj = p.match(/^\/api\/projects\/([^/]+)$/);
    if (prj) {
      const id = decodeURIComponent(prj[1]);
      if (m === 'PUT') { const body = await readJson(req); return sendJson(res, storage.renameProject(id, body && body.name)); }
      if (m === 'DELETE') { return sendJson(res, storage.deleteProject(id)); }
    }

    if (p === '/api/workspace') {
      if (m === 'GET') return sendJson(res, storage.loadAll());
      if (m === 'PUT') { storage.saveAll(await readJson(req)); return sendJson(res, { ok: true }); }
    }

    const ent = p.match(/^\/api\/(profile|blocks|variants|applications|snapshots|materials|settings)$/);
    if (ent) {
      const name = ent[1];
      if (m === 'GET') return sendJson(res, storage.load(name));
      if (m === 'PUT') { storage.save(name, await readJson(req)); return sendJson(res, { ok: true }); }
    }

    if (p === '/api/photos' && m === 'POST') {
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return sendJson(res, { error: '请求必须使用 JSON 格式。' }, 415);
      const body = await readJson(req);
      if (!body || !body.projectId || storage.currentId() !== body.projectId) return sendJson(res, { error: '当前项目已切换，请重新选择照片。' }, 409);
      const encoded = String(body.dataUrl || '').match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!encoded) return sendJson(res, { error: '照片格式无效，请选择 JPG、PNG 或 WebP 图片。' }, 400);
      const bytes = Buffer.from(encoded[1], 'base64');
      if (bytes.length < 4 || bytes.length > 3 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
        return sendJson(res, { error: '照片无效或过大，请重新选择图片。' }, 400);
      }
      const variants = storage.load('variants') || [];
      if (!Array.isArray(variants) || !variants.some(v => v.id === body.variantId)) return sendJson(res, { error: '简历版本不存在，请重新打开。' }, 404);
      const profile = storage.load('profile') || {};
      const oldPhotos = Array.isArray(profile.photos) ? profile.photos : [];
      const id = 'photo-' + randomUUID();
      const entry = { id, name: String(body.name || '证件照').trim().slice(0, 40) || '证件照', file: id + '.jpg' };
      const updatedProfile = Object.assign({}, profile, { photos: oldPhotos.concat([entry]) });
      if (!updatedProfile.photoId && !oldPhotos.length) updatedProfile.photoId = id;
      const updatedVariants = variants.map(v => v.id === body.variantId ? Object.assign({}, v, { photoId: id }) : v);
      const dir = path.join(storage.assetsDir(), 'photos');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, entry.file);
      fs.writeFileSync(file, bytes);
      try {
        storage.save('profile', updatedProfile);
        storage.save('variants', updatedVariants);
      } catch (e) {
        try { storage.save('profile', profile); } catch (_) { /* best-effort rollback */ }
        try { storage.save('variants', variants); } catch (_) { /* best-effort rollback */ }
        try { fs.rmSync(file, { force: true }); } catch (_) { /* best-effort cleanup */ }
        throw e;
      }
      return sendJson(res, { entry, profile: updatedProfile });
    }

    if (p === '/api/photo' && m === 'POST') {
      const body = await readJson(req);
      const dataUrl = String((body && body.dataUrl) || '');
      if (!dataUrl.startsWith('data:image') || !dataUrl.includes(',')) {
        return sendJson(res, { error: 'invalid dataUrl' }, 400);
      }
      const ext = dataUrl.slice(0, 30).toLowerCase().indexOf('png') >= 0 ? 'png' : 'jpg';
      const id = 'photo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const file = id + '.' + ext;
      const dir = path.join(storage.assetsDir(), 'photos');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, file), Buffer.from(dataUrl.split(',').slice(1).join(','), 'base64'));
      return sendJson(res, { id: id, name: String((body && body.name) || '证件照').slice(0, 40), file: file });
    }
    const photoDel = p.match(/^\/api\/photos\/([^/]+)$/);
    if (photoDel && m === 'DELETE') {
      const id = decodeURIComponent(photoDel[1]);
      const profile = storage.load('profile') || {};
      const list = Array.isArray(profile.photos) ? profile.photos : [];
      const entry = list.find(x => x.id === id);
      if (!entry) return sendJson(res, { error: 'photo not found' }, 404);
      const fp = photoFilePath(entry.file);
      const photosDir = path.join(storage.assetsDir(), 'photos');
      if (fp && path.dirname(fp) === photosDir) { try { fs.rmSync(fp); } catch (e) { /* 文件被占用则仅移除记录 */ } }
      profile.photos = list.filter(x => x.id !== id);
      if (profile.photoId === id) profile.photoId = profile.photos.length ? profile.photos[0].id : '';
      storage.save('profile', profile);
      return sendJson(res, profile);
    }

    /* --- 个人材料（简历以外的证件/证明文件） --- */
    if (p === '/api/materials' && m === 'POST') {
      const body = await readJson(req);
      const dataUrl = String((body && body.dataUrl) || '');
      const mm = dataUrl.match(/^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/);
      if (!mm) return sendJson(res, { error: 'invalid dataUrl' }, 400);
      const mime = mm[1].toLowerCase();
      const exts = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };
      const ext = exts[mime];
      if (!ext) return sendJson(res, { error: '仅支持图片或 PDF 文件' }, 400);
      const id = 'mat-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const file = id + '.' + ext;
      const dir = path.join(storage.assetsDir(), 'materials');
      fs.mkdirSync(dir, { recursive: true });
      const fp = path.join(dir, file);
      fs.writeFileSync(fp, Buffer.from(mm[2], 'base64'));
      const entry = {
        id: id,
        name: String((body && body.name) || '').trim().slice(0, 60) || '未命名材料',
        category: String((body && body.category) || '其他').slice(0, 20),
        note: String((body && body.note) || '').slice(0, 200),
        file: file,
        mime: mime,
        size: fs.statSync(fp).size,
        created: storage.today(),
      };
      const list = storage.load('materials') || [];
      list.unshift(entry);
      storage.save('materials', list);
      return sendJson(res, entry);
    }
    const matRef = p.match(/^\/api\/materials\/([^/]+)$/);
    if (matRef) {
      const id = decodeURIComponent(matRef[1]);
      const list = storage.load('materials') || [];
      const entry = list.find(x => x.id === id);
      if (!entry) return sendJson(res, { error: 'material not found' }, 404);
      if (m === 'PUT') {
        const body = await readJson(req) || {};
        if (body.name != null) entry.name = String(body.name).trim().slice(0, 60) || entry.name;
        if (body.category != null) entry.category = String(body.category).slice(0, 20) || entry.category;
        if (body.note != null) entry.note = String(body.note).slice(0, 200);
        storage.save('materials', list);
        return sendJson(res, entry);
      }
      if (m === 'DELETE') {
        const fp = path.join(storage.assetsDir(), 'materials', path.basename(entry.file || ''));
        try { if (fs.existsSync(fp)) fs.rmSync(fp); } catch (e) { /* 文件被占用则仅移除记录 */ }
        storage.save('materials', list.filter(x => x.id !== id));
        return sendJson(res, { ok: true });
      }
    }

    /* --- 版本快照 --- */
    if (p === '/api/snapshots' && m === 'POST') {
      const body = await readJson(req);
      const variantId = String((body && body.variantId) || '');
      if (!variantId) return sendJson(res, { error: 'variantId required' }, 400);
      return sendJson(res, snapshotMeta(createSnapshot(variantId, body && body.note)));
    }
    const snapDel = p.match(/^\/api\/snapshots\/([^/]+)$/);
    if (snapDel && m === 'DELETE') {
      const list = (storage.load('snapshots') || []).filter(x => x.id !== snapDel[1]);
      storage.save('snapshots', list);
      return sendJson(res, { ok: true });
    }

    if (m === 'GET') {
      /* 快照：预览 / 导出（渲染冻结数据，与素材块库当前状态无关） */
      let mm = p.match(/^\/render\/snap\/([^/]+)$/);
      if (mm) {
        const s = findSnapshot(mm[1]);
        const page = render.renderPage(s.profile || {}, s.blocks || [], s.variant || {}, s.photo || '/assets/photo', {
          printMode: u.searchParams.get('print') === '1',
          zoom: parseFloat(u.searchParams.get('zoom') || '1') || 1,
        });
        return sendText(res, page, 'text/html; charset=utf-8');
      }
      mm = p.match(/^\/api\/export\/snap\/([^/]+)\.(md|html|pdf)$/);
      if (mm) {
        const s = findSnapshot(mm[1]);
        const stamp = String(s.created || '').slice(0, 10);
        const fname = `${s.name || '快照'}-${stamp}.${mm[2]}`;
        if (mm[2] === 'md') {
          return sendText(res, render.renderMarkdown(s.profile || {}, s.blocks || [], s.variant || {}), 'text/markdown; charset=utf-8',
            { 'Content-Disposition': contentDisposition(fname) });
        }
        if (mm[2] === 'pdf') {
          const buf = await pdf.exportPdf(selfBase() + '/render/snap/' + encodeURIComponent(s.id));
          return sendBuffer(res, buf, 'application/pdf', { 'Content-Disposition': contentDisposition(fname) });
        }
        const page = render.renderPage(s.profile || {}, s.blocks || [], s.variant || {}, s.photo || '/assets/photo', {});
        return sendText(res, page, 'text/html; charset=utf-8',
          { 'Content-Disposition': contentDisposition(fname) });
      }

      mm = p.match(/^\/render\/([^/]+)$/);
      if (mm) {
        const v = findVariant(mm[1]);
        const profile = storage.load('profile') || {};
        const page = render.renderPage(profile, storage.load('blocks') || [], v, photoUrlFor(resolvePhotoFile(profile, v)), {
          printMode: u.searchParams.get('print') === '1',
          zoom: parseFloat(u.searchParams.get('zoom') || '1') || 1,
        });
        return sendText(res, page, 'text/html; charset=utf-8');
      }
      mm = p.match(/^\/api\/export\/([^/]+)\.(md|html|pdf)$/);
      if (mm) {
        const v = findVariant(mm[1]);
        const profile = storage.load('profile') || {};
        const blocks = storage.load('blocks') || [];
        const fname = `${v.name || 'resume'}.${mm[2]}`;
        if (mm[2] === 'md') {
          return sendText(res, render.renderMarkdown(profile, blocks, v), 'text/markdown; charset=utf-8',
            { 'Content-Disposition': contentDisposition(fname) });
        }
        if (mm[2] === 'pdf') {
          const buf = await pdf.exportPdf(selfBase() + '/render/' + encodeURIComponent(v.id));
          return sendBuffer(res, buf, 'application/pdf', { 'Content-Disposition': contentDisposition(fname) });
        }
        const page = render.renderPage(profile, blocks, v, photoDataUriFor(resolvePhotoFile(profile, v)), {});
        return sendText(res, page, 'text/html; charset=utf-8',
          { 'Content-Disposition': contentDisposition(fname) });
      }
    }

    return sendJson(res, { error: 'not found', path: p }, 404);
  } catch (err) {
    return sendJson(res, { error: String((err && err.message) || err) }, (err && err.status) || 500);
  }
});

/* ---------------- 启动 ---------------- */
function parseCliArgs(argv) {
  const args = argv || process.argv.slice(2);
  const out = { host: '127.0.0.1', port: 8787, noBrowser: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--host') out.host = args[++i] || out.host;
    else if (a === '--port') out.port = parseInt(args[++i], 10) || out.port;
    else if (a === '--no-browser') out.noBrowser = true;
  }
  return out;
}

/* 启动服务（CLI / EXE / Electron 桌面壳共用）
   opts: { host, port, noBrowser, silent, onReady(port, url), onError(err) } */
function start(opts) {
  opts = opts || {};
  restartHook = typeof opts.onRestart === 'function' ? opts.onRestart : null;
  const cli = parseCliArgs();
  const host = opts.host || cli.host;
  const port = opts.port != null ? opts.port : cli.port;
  const noBrowser = 'noBrowser' in opts ? opts.noBrowser : cli.noBrowser;
  const silent = !!opts.silent;

  storage.ensureData();

  server.once('listening', () => {
    const actual = server.address().port;
    const url = `http://${host}:${actual}/`;
    if (!silent) {
      console.log('='.repeat(56));
      console.log('  moduleResume 已启动');
      console.log(`  请在浏览器打开：${url}`);
      console.log('  （关闭本窗口即停止服务；数据保存在程序目录 data/ 下）');
      console.log('='.repeat(56));
    }
    if (typeof opts.onReady === 'function') { try { opts.onReady(actual, url); } catch (e) {} }
    if (!noBrowser) {
      try {
        if (process.platform === 'win32') {
          spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
        } else if (process.platform === 'darwin') {
          spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
        } else {
          spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
        }
      } catch (e) { /* 打不开浏览器不影响服务 */ }
    }
  });

  server.once('error', err => {
    if (typeof opts.onError === 'function') { opts.onError(err); return; }
    if (err && err.code === 'EADDRINUSE') {
      console.error(`端口 ${port} 已被占用，请改用：node run.js --port 9000`);
    } else {
      console.error('启动失败：', err);
    }
    process.exit(1);
  });

  server.listen(port, host);
  return server;
}

if (require.main === module) start();
module.exports = { start, server };
