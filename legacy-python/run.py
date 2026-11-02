"""moduleResume 启动入口
用法（开发或源码运行）：
    python run.py                # 启动并自动打开浏览器（默认 http://127.0.0.1:8787）
    python run.py --port 9000    # 指定端口
    python run.py --no-browser   # 不自动打开浏览器
打包后的 EXE 同样支持以上参数。
"""
import argparse
import threading
import webbrowser

import uvicorn

from backend.app import app


def main() -> None:
    parser = argparse.ArgumentParser(description="moduleResume 本地服务")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--no-browser", action="store_true", help="启动后不自动打开浏览器")
    args = parser.parse_args()

    url = f"http://{args.host}:{args.port}/"
    if not args.no_browser:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()

    print("=" * 56)
    print("  moduleResume 已启动")
    print(f"  请在浏览器打开：{url}")
    print("  （关闭本窗口即停止服务；数据保存在程序目录 data/ 下）")
    print("=" * 56)

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
