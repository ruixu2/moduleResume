/* moduleResume · 路径管理（开发运行 / pkg 打包运行 兼容） */
const path = require('node:path');
const fs = require('node:fs');

const IS_PKG = typeof process.pkg !== 'undefined';
const IS_ELECTRON = !!(process.versions && process.versions.electron);

/* 代码与静态资源根目录（pkg 快照内依然成立） */
const RESOURCE_ROOT = path.join(__dirname, '..');

/* 应用根目录：EXE / Electron 桌面版 → 可执行文件所在目录；开发 → 项目根目录 */
const APP_ROOT = (IS_PKG || IS_ELECTRON) ? path.dirname(process.execPath) : path.join(__dirname, '..');

function dataDir() {
  const env = (process.env.MODULERESUME_DATA || '').trim();
  const dir = env ? path.resolve(env) : path.join(APP_ROOT, 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { IS_PKG, RESOURCE_ROOT, APP_ROOT, dataDir };
