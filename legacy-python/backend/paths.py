"""moduleResume · 路径管理（兼容开发运行与 PyInstaller 打包运行）"""
import os
import sys
from pathlib import Path


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def resource_root() -> Path:
    """静态资源根目录（frontend 等打包内文件所在处）"""
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parent.parent


def app_root() -> Path:
    """应用根目录（EXE 所在目录 / 项目根目录）——数据文件默认放这里"""
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def frontend_dir() -> Path:
    return resource_root() / "frontend"


def data_dir() -> Path:
    """数据目录：可用环境变量 MODULERESUME_DATA 覆盖；默认在应用根目录的 data/"""
    env = os.environ.get("MODULERESUME_DATA", "").strip()
    if env:
        path = Path(env).expanduser().resolve()
    else:
        path = app_root() / "data"
    path.mkdir(parents=True, exist_ok=True)
    (path / "assets").mkdir(exist_ok=True)
    return path
