#!/usr/bin/env node
/* moduleResume 启动入口
用法：
    node run.js                # 启动并自动打开浏览器（默认 http://127.0.0.1:8787）
    node run.js --port 9000    # 指定端口
    node run.js --no-browser   # 不自动打开浏览器
打包后的 EXE 同样支持以上参数。
*/
require('./backend/index.js').start();
