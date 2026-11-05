/* moduleResume · EXE 打包脚本（@yao-pkg/pkg）
用法：
    node scripts/build_exe.js
产物：
    dist/moduleResume.exe —— 单文件，双击即用（自动开浏览器）
    数据保存在 EXE 同级的 data/ 目录（便携式）
*/
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const NPM_MIRROR = 'https://registry.npmmirror.com';

function run(cmd, args, opts) {
  console.log('>', cmd, args.join(' '));
  const r = spawnSync(cmd, args, Object.assign({ stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32' }, opts || {}));
  if (r.status !== 0) {
    console.error('命令失败，退出码', r.status);
    process.exit(r.status || 1);
  }
}

function main() {
  const isWin = process.platform === 'win32';
  const pkgBin = path.join(ROOT, 'node_modules', '.bin', isWin ? 'pkg.cmd' : 'pkg');

  // 1. 确保 @yao-pkg/pkg 已安装（走国内镜像加速）
  if (!fs.existsSync(pkgBin)) {
    console.log('未检测到 @yao-pkg/pkg，开始安装（镜像：npmmirror）...');
    run('npm', ['install', '--no-audit', '--no-fund', '--save-dev', '@yao-pkg/pkg', '--registry', NPM_MIRROR]);
  } else {
    console.log('已检测到 @yao-pkg/pkg，跳过安装');
  }

  require('./prepare_import_assets')();

  // 2. 清理旧产物
  fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'build'), { recursive: true, force: true });

  // 3. 打包（目标：node22 win-x64；虚拟文件系统内嵌 frontend/）
  run(pkgBin, ['run.js', '--targets', 'node22-win-x64', '--output', 'dist/moduleResume.exe', '--compress', 'GZip']);
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(ROOT, 'dist', 'LICENSE'));
  fs.copyFileSync(path.join(ROOT, 'NOTICE'), path.join(ROOT, 'dist', 'NOTICE'));

  console.log();
  console.log('='.repeat(56));
  console.log('打包完成');
  console.log('产物：' + path.join(ROOT, 'dist', 'moduleResume.exe'));
  console.log('双击运行后会启动本地服务并自动打开浏览器；');
  console.log('数据保存在 EXE 同级的 data/ 目录（可整体拷贝到 U 盘使用）。');
  console.log('='.repeat(56));
}

main();
