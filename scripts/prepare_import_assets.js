/* Copy browser-only document readers into the app's static assets. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function prepareImportAssets() {
  const root = path.resolve(__dirname, '..');
  const dest = path.join(root, 'frontend', 'vendor');
  const pdf = path.join(root, 'node_modules', 'pdfjs-dist');
  const mammoth = path.join(root, 'node_modules', 'mammoth');
  if (!fs.existsSync(path.join(pdf, 'build', 'pdf.min.mjs')) ||
      !fs.existsSync(path.join(mammoth, 'mammoth.browser.js'))) {
    throw new Error('简历文件解析依赖缺失，请先执行 npm install。');
  }
  if (JSON.parse(fs.readFileSync(path.join(mammoth, 'package.json'), 'utf8')).version !== '1.13.0') {
    throw new Error('更新 Mammoth 前请检查其浏览器组件及第三方许可声明。');
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const file of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
    fs.copyFileSync(path.join(pdf, 'build', file), path.join(dest, file));
  }
  for (const dir of ['cmaps', 'standard_fonts']) {
    fs.cpSync(path.join(pdf, dir), path.join(dest, dir), { recursive: true });
  }
  // The unminified Mammoth bundle includes its third-party dependency notices.
  fs.copyFileSync(path.join(mammoth, 'mammoth.browser.js'), path.join(dest, 'mammoth.browser.js'));
  fs.copyFileSync(path.join(__dirname, 'mammoth-browser-licenses.txt'), path.join(dest, 'MAMMOTH-THIRD-PARTY-LICENSES.txt'));
  fs.copyFileSync(path.join(mammoth, 'LICENSE'), path.join(dest, 'MAMMOTH-LICENSE'));
  fs.copyFileSync(path.join(pdf, 'LICENSE'), path.join(dest, 'PDFJS-LICENSE'));
}

if (require.main === module) prepareImportAssets();
module.exports = prepareImportAssets;
