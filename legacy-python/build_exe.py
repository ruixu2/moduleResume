"""moduleResume · EXE 打包脚本（PyInstaller）
用法：
    python scripts/build_exe.py            # 单文件 EXE（默认）
    python scripts/build_exe.py --onedir   # 目录模式（启动更快，便于排查）
产物：
    dist/moduleResume.exe （单文件模式）
构建完成后：把 dist/moduleResume.exe 复制到任意目录运行。
数据会保存在 EXE 同级的 data/ 目录（便携式）。
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
BUILD = ROOT / "build"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--onedir", action="store_true", help="目录模式打包")
    parser.add_argument("--name", default="moduleResume")
    args = parser.parse_args()

    for d in (DIST, BUILD):
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean",
        "--name", args.name,
        "--add-data", f"{ROOT / 'frontend'}{';' if sys.platform == 'win32' else ':'}frontend",
        # uvicorn 动态导入的子模块需要显式收集
        "--collect-submodules", "uvicorn",
        "--hidden-import", "backend.seed",
    ]
    cmd.append("--onedir" if args.onedir else "--onefile")
    cmd.append(str(ROOT / "run.py"))

    print("执行：", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=str(ROOT))
    print()
    print("=" * 56)
    print("打包完成 ✔")
    print(f"产物：{DIST / (args.name + '.exe')} （单文件模式）" if not args.onedir
          else f"产物：{DIST / args.name / (args.name + '.exe')} （目录模式）")
    print("双击运行后会启动本地服务并自动打开浏览器。")
    print("=" * 56)


if __name__ == "__main__":
    main()
