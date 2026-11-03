/* moduleResume · 桌面软件版打包（Electron 运行时 + 应用注入）
   用法：
       node scripts/build_desktop.js
   产物：
       dist-desktop/moduleResume/moduleResume.exe —— 桌面软件（独立窗口，无浏览器地址栏）
   说明：
       - 使用 node_modules/electron 自带的运行时（首次自动经 npmmirror 安装）
       - 应用代码（backend / frontend / desktop / package.json）拷入 resources/app
       - dist-desktop/moduleResume/data 以目录联接指向项目 data/，与网页/EXE 版共用同一份数据
*/
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const NPM_MIRROR = 'https://registry.npmmirror.com';
const ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
const OUT_ROOT = path.join(ROOT, 'dist-desktop');
const OUT = path.join(OUT_ROOT, 'moduleResume');

function run(cmd, args, opts) {
  console.log('>', cmd, args.join(' '));
  const r = spawnSync(cmd, args, Object.assign({
    stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32',
    env: Object.assign({}, process.env, { ELECTRON_MIRROR }),
  }, opts || {}));
  if (r.status !== 0) { console.error('命令失败，退出码', r.status); process.exit(r.status || 1); }
  return r;
}

function main() {
  /* 1. 确保 Electron 运行时存在 */
  const electronDist = path.join(ROOT, 'node_modules', 'electron', 'dist');
  if (!fs.existsSync(path.join(electronDist, 'electron.exe'))) {
    console.log('未检测到 Electron 运行时，开始安装（镜像：npmmirror）...');
    run('npm', ['install', '--no-audit', '--no-fund', '--save-dev', 'electron', '--registry', NPM_MIRROR]);
  } else {
    console.log('已检测到 Electron 运行时，跳过安装');
  }
  if (!fs.existsSync(path.join(electronDist, 'electron.exe'))) {
    console.error('Electron 运行时缺失（node_modules/electron/dist/electron.exe）。');
    console.error('可删除 node_modules/electron 后重新运行本脚本。');
    process.exit(1);
  }

  /* 2. 复制运行时 */
  fs.rmSync(OUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  console.log('复制 Electron 运行时 → ' + OUT);
  fs.cpSync(electronDist, OUT, { recursive: true });

  /* 3. 注入应用代码 */
  const appDir = path.join(OUT, 'resources', 'app');
  fs.mkdirSync(appDir, { recursive: true });
  const defApp = path.join(OUT, 'resources', 'default_app.asar');
  if (fs.existsSync(defApp)) fs.rmSync(defApp);
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(appDir, 'package.json'));
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(appDir, 'LICENSE'));
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(OUT, 'LICENSE'));
  fs.copyFileSync(path.join(ROOT, 'NOTICE'), path.join(appDir, 'NOTICE'));
  fs.copyFileSync(path.join(ROOT, 'NOTICE'), path.join(OUT, 'NOTICE'));
  for (const d of ['backend', 'frontend', 'desktop']) {
    fs.cpSync(path.join(ROOT, d), path.join(appDir, d), { recursive: true });
  }

  /* 4. 可执行文件改名 */
  fs.renameSync(path.join(OUT, 'electron.exe'), path.join(OUT, 'moduleResume.exe'));

  /* 5. data 目录联接（与项目数据共用；Windows 不支持时退化为复制） */
  const dataLink = path.join(OUT, 'data');
  const dataReal = path.join(ROOT, 'data');
  fs.mkdirSync(dataReal, { recursive: true });
  const link = spawnSync('cmd', ['/c', 'mklink', '/J', dataLink, dataReal], { stdio: 'ignore' });
  if (link.status !== 0) {
    console.log('提示：目录联接创建失败，改为复制一份数据目录（后续两份数据将各自独立）。');
    fs.cpSync(dataReal, dataLink, { recursive: true });
  }

  console.log();
  console.log('='.repeat(56));
  console.log('桌面软件版打包完成');
  console.log('产物：' + path.join(OUT, 'moduleResume.exe'));
  console.log('双击即打开独立软件窗口（无浏览器地址栏 / 标签页）；');
  console.log('数据通过 data 目录联接与项目 data/ 共用。');
  console.log('='.repeat(56));
}

main();
