/* moduleResume · Windows 安装包构建脚本（electron-builder + NSIS）

用法：
    node scripts/build_installer.js

产物：
    dist-installer/moduleResume-Setup-<版本>.exe   ← 安装向导（双击安装）
    dist-installer/win-unpacked/                    ← 免安装展开版（调试用）

说明：
    - 数据目录：安装版首次启动会在 %APPDATA%\moduleResume\data 下用「示例数据」初始化，
      不会读写安装目录（Program Files 下普通用户无写权限）。
    - 打包内容：backend / frontend / desktop / package.json，**不含 data/**，
      因此仓库里的真实个人信息（手机号、邮箱、证件照）不会进入安装包。
*/
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const NPM_MIRROR = 'https://registry.npmmirror.com';
const ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
const OUT = path.join(ROOT, 'dist-installer');

function die(msg) {
  console.error('\n[构建失败] ' + msg);
  process.exit(1);
}

function ensureDeps() {
  const has = (p) => fs.existsSync(path.join(ROOT, 'node_modules', p));
  const missing = [];
  if (!has(path.join('electron', 'dist', 'electron.exe'))) missing.push('electron');
  if (!has('electron-builder')) missing.push('electron-builder');
  if (!missing.length) { console.log('依赖已就绪：' + 'electron, electron-builder'); return; }

  console.log('缺少依赖（' + missing.join(', ') + '），开始安装（npmmirror）...');
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--save-dev']
    .concat(missing).concat(['--registry', NPM_MIRROR]),
    { stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32' });
  if (r.status !== 0) die('npm install 失败');
}

/* 安装版标记文件：放在 resources/ 下，desktop/main.js 据此把数据放到用户目录 */
function makeInstalledFlag() {
  const dir = path.join(ROOT, 'build');
  fs.mkdirSync(dir, { recursive: true });
  const flag = path.join(dir, 'installed.flag');
  fs.writeFileSync(flag, 'electron-builder installer build\n', 'utf8');
  return flag;
}

/* 从 data/ 收集个人敏感信息（手机号 / 邮箱 / 姓名 / 证件照字节），用于产物扫描 */
function collectPrivateData() {
  const out = { strings: [], photos: [] };
  const dataRoot = path.join(ROOT, 'data');
  if (!fs.existsSync(dataRoot)) return out;

  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (/profile\.json$/i.test(e.name)) {
        try {
          const pr = JSON.parse(fs.readFileSync(p, 'utf8'));
          for (const k of ['name', 'phone', 'email', 'wechat', 'website', 'location', 'hometown']) {
            const v = pr && pr[k];
            if (typeof v === 'string' && v.trim().length >= 3) out.strings.push(v.trim());
          }
        } catch (e) { /* 忽略坏文件 */ }
      } else if (/\.(jpe?g|png|pdf)$/i.test(e.name)) {
        try {
          const buf = fs.readFileSync(p);
          if (buf.length > 64) out.photos.push(buf.slice(0, 1024)); /* 取前 1KB 做指纹 */
        } catch (e) { /* 忽略 */ }
      }
    }
  };
  walk(dataRoot);
  /* 去重 */
  out.strings = Array.from(new Set(out.strings));
  return out;
}

/* 构建后自检：确认产物里不含个人信息，含则中止并删除产物 */
function assertNoPrivateData(setupPath, unpackedDir) {
  const priv = collectPrivateData();
  if (!priv.strings.length && !priv.photos.length) {
    console.log('自检：data/ 中未发现可识别的个人信息，跳过扫描');
    return;
  }

  const targets = [
    path.join(unpackedDir, 'resources', 'app.asar'),
    setupPath,
  ];
  const problems = [];

  for (const t of targets) {
    if (!fs.existsSync(t)) continue;
    const buf = fs.readFileSync(t);
    const label = path.relative(ROOT, t);

    for (const s of priv.strings) {
      const needle = Buffer.from(s, 'utf8');
      if (buf.indexOf(needle) >= 0) problems.push(label + ' 含文本「' + s + '」');
    }
    for (const probe of priv.photos) {
      if (buf.indexOf(probe) >= 0) problems.push(label + ' 含 data/ 中的图片/PDF 文件');
    }
  }

  if (problems.length) {
    console.error('\n[自检失败] 产物中发现个人信息，已中止：');
    for (const p of problems) console.error('  - ' + p);
    try { fs.rmSync(OUT, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    die('请检查 electron-builder 的 files 配置，确保未打包 data/ 目录');
  }
  console.log('自检通过：产物不含 data/ 中的个人信息（' + priv.strings.length + ' 项文本、'
    + priv.photos.length + ' 个文件指纹均未命中）');
}

async function main() {
  ensureDeps();
  const flag = makeInstalledFlag();
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  let builder;
  try { builder = require('electron-builder'); }
  catch (e) { die('无法加载 electron-builder，请先执行 npm install'); }

  /* 复用本机已下载的 Electron 运行时，避免每次重新下载 */
  process.env.ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || ELECTRON_MIRROR;

  const config = {
    appId: 'com.moduleresume.desktop',
    productName: 'moduleResume',
    copyright: 'Copyright © 2026 moduleResume',
    directories: { output: OUT, buildResources: path.join(ROOT, 'desktop') },
    /* 只打包运行所需的应用代码；data/（真实个人信息）、scripts/、legacy-python/ 均排除 */
    files: [
      'package.json',
      'LICENSE',
      'backend/**/*',
      'frontend/**/*',
      'desktop/main.js',
      'desktop/icon.ico',
      'desktop/icon.png',
    ],
    extraResources: [{ from: flag, to: 'installed.flag' }],
    asar: true,
    compression: 'maximum',
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      /* 用 PNG 源图交给 electron-builder 生成多尺寸 ico（16/24/32/48/64/128/256） */
      icon: path.join(ROOT, 'desktop', 'icon.png'),
      artifactName: 'moduleResume-Setup-${version}.${ext}',
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowElevation: true,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'moduleResume',
      language: '2052',
      deleteAppDataOnUninstall: false,
      artifactName: 'moduleResume-Setup-${version}.${ext}',
    },
  };

  console.log('开始构建 Windows 安装包（' + pkg.version + '）...');
  const { Platform, Arch } = builder;
  try {
    await builder.build({
      targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
      config,
      publish: 'never',
    });
  } catch (e) {
    die(String((e && e.message) || e));
  }

  const setup = path.join(OUT, 'moduleResume-Setup-' + pkg.version + '.exe');
  assertNoPrivateData(setup, path.join(OUT, 'win-unpacked'));

  console.log();
  console.log('='.repeat(60));
  console.log('安装包构建完成');
  console.log('  文件：' + setup);
  if (fs.existsSync(setup)) {
    console.log('  大小：' + (fs.statSync(setup).size / 1048576).toFixed(1) + ' MB');
  }
  console.log('  安装后数据目录：%APPDATA%\\moduleResume\\data（首次启动写入示例数据）');
  console.log('='.repeat(60));
}

main();
