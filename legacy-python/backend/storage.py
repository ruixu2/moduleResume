"""moduleResume · 分块存储层
信息按模块分文件存储：
    data/profile.json        个人基础信息（唯一一份）
    data/blocks.json         素材块库（唯一事实来源）
    data/variants.json       岗位定制版本（引用素材块组装）
    data/applications.json   投递记录（公司 × 岗位）
    data/settings.json       界面/导出设置
    data/assets/photo.jpg    证件照
"""
import base64
import json
from datetime import date
from typing import Any, Dict

from . import paths
from . import seed as seed_module

FILES: Dict[str, str] = {
    "profile": "profile.json",
    "blocks": "blocks.json",
    "variants": "variants.json",
    "applications": "applications.json",
    "settings": "settings.json",
}


def today() -> str:
    return date.today().isoformat()


def _path(name: str):
    return paths.data_dir() / FILES[name]


def ensure_data() -> None:
    """首次运行时写入初始数据与照片（不覆盖已有文件）"""
    d = paths.data_dir()
    for name in FILES:
        p = d / FILES[name]
        if not p.exists():
            save(name, seed_module.SEED.get(name))
    photo = d / "assets" / "photo.jpg"
    if not photo.exists() and seed_module.PHOTO_B64:
        raw = seed_module.PHOTO_B64.split(",", 1)[-1]
        photo.write_bytes(base64.b64decode(raw))


def load(name: str) -> Any:
    p = _path(name)
    if not p.exists():
        return seed_module.SEED.get(name)
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return seed_module.SEED.get(name)


def save(name: str, obj: Any) -> None:
    p = _path(name)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def load_all() -> Dict[str, Any]:
    return {name: load(name) for name in FILES}


def save_all(data: Dict[str, Any]) -> None:
    for name in FILES:
        if name in data:
            save(name, data[name])
