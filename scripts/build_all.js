/* moduleResume · 一键打包（网页版 EXE + 桌面软件版）
   用法：node scripts/build_all.js（或双击 build_all.bat）
   产物：
     1) 网页版：dist/moduleResume.exe（双击 → 浏览器打开使用）
     2) 桌面软件版：dist-desktop/moduleResume/moduleResume.exe（独立窗口）
*/
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function run(script) {
  console.log('\n' + '='.repeat(56));
  console.log('  ' + script);
  console.log('='.repeat(56));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script)], { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) {
    console.error('打包失败：' + script);
    process.exit(r.status || 1);
  }
}

run('build_exe.js');
run('build_desktop.js');

console.log();
console.log('='.repeat(56));
console.log('全部打包完成');
console.log('  网页版（浏览器使用）：dist\\moduleResume.exe');
console.log('  桌面软件版（独立窗口）：dist-desktop\\moduleResume\\moduleResume.exe');
console.log('='.repeat(56));
