/* moduleResume · 桌面软件版（Electron 主进程）
   - 内嵌启动后端服务，用独立应用窗口承载界面（无浏览器地址栏 / 标签页）
   - 数据目录：可执行文件同级的 data/（打包时与项目 data/ 做目录联接共用）
*/
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');

let win = null;

/* 安装版：数据放到用户目录 %APPDATA%\moduleResume\data，
   避免写入 Program Files 等普通用户无写权限的位置。
   便携版（dist-desktop）不带标记文件，仍沿用程序目录 data/，数据随文件夹走。 */
if (!process.env.MODULERESUME_DATA) {
  const flag = path.join(process.resourcesPath || '', 'installed.flag');
  if (process.resourcesPath && fs.existsSync(flag)) {
    const appData = process.env.APPDATA || path.join(require('node:os').homedir(), 'AppData', 'Roaming');
    process.env.MODULERESUME_DATA = path.join(appData, 'moduleResume', 'data');
  }
}

const { start } = require('../backend/index.js');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.setName('moduleResume');
  if (process.platform === 'win32') app.setAppUserModelId('moduleResume');

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    const wantPort = process.env.MODULERESUME_PORT ? (parseInt(process.env.MODULERESUME_PORT, 10) || 0) : 0;

    start({
      host: '127.0.0.1',
      port: wantPort,
      noBrowser: true,
      silent: true,
      onReady: (port) => {
        win = new BrowserWindow({
          width: 1480,
          height: 950,
          minWidth: 1080,
          minHeight: 700,
          title: 'moduleResume · 简历工作台',
          icon: path.join(__dirname, 'icon.ico'),
          autoHideMenuBar: true,
          backgroundColor: '#eef0f5',
          webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false },
        });
        win.loadURL('http://127.0.0.1:' + port + '/');
        win.on('closed', () => { win = null; });

        /* 下载文件（PDF / 数据导出等）时弹出保存对话框 */
        win.webContents.session.on('will-download', (event, item) => {
          const savePath = dialog.showSaveDialogSync(win, { defaultPath: item.getFilename() });
          if (savePath) item.setSavePath(savePath);
          else item.cancel();
        });

        /* 站内链接（预览 / 打印）留在应用内；外部链接交给系统浏览器 */
        win.webContents.setWindowOpenHandler(({ url }) => {
          if (url.indexOf('http://127.0.0.1') === 0) return { action: 'allow' };
          shell.openExternal(url);
          return { action: 'deny' };
        });
      },
      onError: (err) => {
        dialog.showErrorBox('moduleResume 启动失败', String((err && err.message) || err));
        app.quit();
      },
    });
  });

  app.on('window-all-closed', () => app.quit());
}
