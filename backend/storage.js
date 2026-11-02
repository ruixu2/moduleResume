/* moduleResume · 分块存储层（多「个人项目」）

   目录结构：
     data/projects.json                    项目注册表 { current, list: [{id,name,created}] }
     data/projects/<id>/profile.json       个人基础信息
     data/projects/<id>/blocks.json        素材块库（唯一事实来源）
     data/projects/<id>/variants.json      岗位定制版本（引用素材块组装）
     data/projects/<id>/applications.json  投递记录（公司 × 岗位）
     data/projects/<id>/snapshots.json     版本快照（投递时冻结的版本副本）
     data/projects/<id>/settings.json      设置
     data/projects/<id>/assets/...         照片等资产

   兼容：旧版单项目布局（data/profile.json 等）在启动时自动迁入 data/projects/<id>/。
*/
const fs = require('node:fs');
const path = require('node:path');
const { dataDir } = require('./paths');
const seed = require('./seed');

const FILES = {
  profile: 'profile.json',
  blocks: 'blocks.json',
  variants: 'variants.json',
  applications: 'applications.json',
  snapshots: 'snapshots.json',
  materials: 'materials.json',
  settings: 'settings.json',
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function newId() {
  return 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------------- 项目注册表 ---------------- */
function registryPath() { return path.join(dataDir(), 'projects.json'); }
function projectsDir() { return path.join(dataDir(), 'projects'); }
function projectDir(id) { return path.join(projectsDir(), String(id).replace(/[^\w-]/g, '')); }

function readRegistry() {
  try {
    const r = JSON.parse(fs.readFileSync(registryPath(), 'utf8'));
    if (r && Array.isArray(r.list) && r.list.length) return r;
  } catch (e) { /* 尚未建立注册表 */ }
  return { current: '', list: [] };
}
function writeRegistry(r) {
  fs.writeFileSync(registryPath(), JSON.stringify(r, null, 2), 'utf8');
}
function currentId() {
  const r = readRegistry();
  if (r.current && r.list.some(p => p.id === r.current)) return r.current;
  return r.list.length ? r.list[0].id : '';
}
function info() {
  const r = readRegistry();
  return { current: currentId(), list: r.list };
}

function assetsDir(id) { return path.join(projectDir(id || currentId()), 'assets'); }

/* ---------------- 项目 CRUD ---------------- */
function ensureProjectFiles(id) {
  const dir = projectDir(id);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  for (const [name, fn] of Object.entries(FILES)) {
    const p = path.join(dir, fn);
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(seed.SEED[name], null, 2), 'utf8');
  }
}

function blankProfile(name) {
  return {
    name: name || '', gender: '', birth: '', hometown: '', political: '', ethnicity: '',
    phone: '', email: '', location: '', wechat: '', website: '',
    photo: '', photos: [], photoId: '',
  };
}

function createProject(name) {
  const id = newId();
  const nm = String(name || '').trim().slice(0, 40) || '新项目';
  ensureProjectFiles(id);
  /* 新建项目：空档起步（只写入姓名），不套用示例素材 */
  const defaults = Object.assign({}, seed.SEED, {
    profile: blankProfile(nm),
    blocks: [],
    variants: [],
    applications: [],
    snapshots: [],
  });
  for (const [k, fn] of Object.entries(FILES)) {
    fs.writeFileSync(path.join(projectDir(id), fn), JSON.stringify(defaults[k], null, 2), 'utf8');
  }
  const r = readRegistry();
  r.list.push({ id: id, name: nm, created: today() });
  r.current = id;
  writeRegistry(r);
  return { id: id, name: nm, created: today() };
}

function renameProject(id, name) {
  const r = readRegistry();
  const it = r.list.find(p => p.id === id);
  if (!it) { const e = new Error('project not found: ' + id); e.status = 404; throw e; }
  const nm = String(name || '').trim().slice(0, 40);
  if (nm) it.name = nm;
  writeRegistry(r);
  return it;
}

function deleteProject(id) {
  const r = readRegistry();
  const idx = r.list.findIndex(p => p.id === id);
  if (idx < 0) { const e = new Error('project not found: ' + id); e.status = 404; throw e; }
  if (r.current === id) { const e = new Error('不能删除当前项目，请先切换到其它项目'); e.status = 400; throw e; }
  r.list.splice(idx, 1);
  try { fs.rmSync(projectDir(id), { recursive: true, force: true }); } catch (e) { /* 目录删除失败不阻塞注册表 */ }
  writeRegistry(r);
  return { ok: true, list: r.list };
}

function switchProject(id) {
  const r = readRegistry();
  if (!r.list.some(p => p.id === id)) { const e = new Error('project not found: ' + id); e.status = 404; throw e; }
  r.current = id;
  writeRegistry(r);
  return info();
}

/* ---------------- 迁移与初始化 ---------------- */
/* 旧版单项目布局 → projects/<id>/（仅当注册表不存在且存在旧 profile.json 时执行） */
function migrateLegacy(dir) {
  if (fs.existsSync(registryPath())) return;
  const oldProfile = path.join(dir, 'profile.json');
  if (!fs.existsSync(oldProfile)) return;
  let pname = '我的简历';
  try {
    const p = JSON.parse(fs.readFileSync(oldProfile, 'utf8'));
    if (p && p.name) pname = String(p.name).slice(0, 40);
  } catch (e) { /* 读不出名字则用默认名 */ }
  const id = newId();
  const dest = projectDir(id);
  fs.mkdirSync(path.join(dest, 'assets'), { recursive: true });
  for (const fn of Object.values(FILES)) {
    const src = path.join(dir, fn);
    if (!fs.existsSync(src)) continue;
    try { fs.renameSync(src, path.join(dest, fn)); }
    catch (e) { fs.copyFileSync(src, path.join(dest, fn)); try { fs.rmSync(src, { force: true }); } catch (e2) {} }
  }
  const oldAssets = path.join(dir, 'assets');
  if (fs.existsSync(oldAssets)) {
    try { fs.renameSync(oldAssets, path.join(dest, 'assets')); }
    catch (e) {
      fs.cpSync(oldAssets, path.join(dest, 'assets'), { recursive: true });
      try { fs.rmSync(oldAssets, { recursive: true, force: true }); } catch (e2) {}
    }
  }
  writeRegistry({ current: id, list: [{ id: id, name: pname, created: today() }] });
  console.log('[moduleResume] 已将原有数据迁移为个人项目：' + pname + '（' + id + '）');
}

/* 照片多版本迁移（项目内）：assets/photo.jpg → 可管理的默认照片条目 */
function ensurePhotos(id) {
  try {
    const pdir = projectDir(id);
    const pp = path.join(pdir, 'profile.json');
    const photo = path.join(pdir, 'assets', 'photo.jpg');
    if (!fs.existsSync(pp)) return;
    const profile = JSON.parse(fs.readFileSync(pp, 'utf8'));
    let changed = false;
    if (!Array.isArray(profile.photos)) { profile.photos = []; changed = true; }
    if (profile.photos.length === 0 && fs.existsSync(photo)) {
      const photosDir = path.join(pdir, 'assets', 'photos');
      fs.mkdirSync(photosDir, { recursive: true });
      const dest = path.join(photosDir, 'photo-default.jpg');
      if (!fs.existsSync(dest)) fs.copyFileSync(photo, dest);
      profile.photos.push({ id: 'photo-default', name: '证件照', file: 'photo-default.jpg' });
      if (!profile.photoId) profile.photoId = 'photo-default';
      changed = true;
    }
    if (changed) fs.writeFileSync(pp, JSON.stringify(profile, null, 2), 'utf8');
  } catch (e) { /* 迁移失败不影响启动 */ }
}

function ensureData() {
  const dir = dataDir();
  migrateLegacy(dir);
  let pid = currentId();
  if (!pid) {
    /* 全新安装：创建一个带示例数据的默认项目 */
    const id = newId();
    ensureProjectFiles(id);
    const r = readRegistry();
    r.list.push({ id: id, name: (seed.SEED.profile && seed.SEED.profile.name) || '示例项目', created: today() });
    r.current = id;
    writeRegistry(r);
    pid = id;
  }
  ensureProjectFiles(pid);
  ensurePhotos(pid);
}

/* ---------------- 读写（作用于当前项目） ---------------- */
function load(name) {
  try {
    const pid = currentId();
    if (!pid) return seed.SEED[name];
    return JSON.parse(fs.readFileSync(path.join(projectDir(pid), FILES[name]), 'utf8'));
  } catch (e) {
    return seed.SEED[name];
  }
}

function save(name, obj) {
  const pid = currentId();
  fs.writeFileSync(path.join(projectDir(pid), FILES[name]), JSON.stringify(obj, null, 2), 'utf8');
}

function loadAll() {
  const out = {};
  for (const name of Object.keys(FILES)) out[name] = load(name);
  return out;
}

function saveAll(data) {
  for (const name of Object.keys(FILES)) {
    if (data && name in data) save(name, data[name]);
  }
}

module.exports = {
  FILES, today, ensureData, load, save, loadAll, saveAll,
  /* 多项目 */
  info, createProject, renameProject, deleteProject, switchProject, assetsDir, currentId,
};
