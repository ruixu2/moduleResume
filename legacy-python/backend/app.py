"""moduleResume · FastAPI 应用（本地服务）
- REST API：分块读写 profile / blocks / variants / applications / settings
- 渲染与导出：/render/{vid}（预览/打印）、/api/export/{vid}.md|.html
- 前端静态页面托管
"""
import base64
from contextlib import asynccontextmanager
from urllib.parse import quote

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from . import paths, render, storage
from .seed import SEED


@asynccontextmanager
async def lifespan(_app: FastAPI):
    storage.ensure_data()
    yield


app = FastAPI(title="moduleResume", version="0.1.0", lifespan=lifespan)


# ------------------------------------------------------------------ 基础

@app.get("/api/health")
def health():
    return {
        "ok": True,
        "app": "moduleResume",
        "version": "0.1.0",
        "data_dir": str(paths.data_dir()),
        "frozen": paths.is_frozen(),
    }


@app.get("/api/workspace")
def get_workspace():
    return storage.load_all()


@app.put("/api/workspace")
def put_workspace(data: dict = Body(...)):
    storage.save_all(data)
    return {"ok": True}


# ------------------------------------------------------------------ 分块实体

@app.get("/api/profile")
def get_profile():
    return storage.load("profile")


@app.put("/api/profile")
def put_profile(data: dict = Body(...)):
    storage.save("profile", data)
    return {"ok": True}


@app.get("/api/blocks")
def get_blocks():
    return storage.load("blocks")


@app.put("/api/blocks")
def put_blocks(data: list = Body(...)):
    storage.save("blocks", data)
    return {"ok": True}


@app.get("/api/variants")
def get_variants():
    return storage.load("variants")


@app.put("/api/variants")
def put_variants(data: list = Body(...)):
    storage.save("variants", data)
    return {"ok": True}


@app.get("/api/applications")
def get_applications():
    return storage.load("applications")


@app.put("/api/applications")
def put_applications(data: list = Body(...)):
    storage.save("applications", data)
    return {"ok": True}


@app.get("/api/settings")
def get_settings():
    return storage.load("settings")


@app.put("/api/settings")
def put_settings(data: dict = Body(...)):
    storage.save("settings", data)
    return {"ok": True}


# ------------------------------------------------------------------ 照片

@app.get("/assets/photo")
def get_photo():
    p = paths.data_dir() / "assets" / "photo.jpg"
    if p.exists():
        return FileResponse(p, media_type="image/jpeg")
    return JSONResponse({"error": "no photo"}, status_code=404)


@app.post("/api/photo")
def post_photo(data: dict = Body(...)):
    data_url = (data or {}).get("dataUrl", "")
    if not data_url.startswith("data:image") or "," not in data_url:
        raise HTTPException(status_code=400, detail="invalid dataUrl")
    try:
        raw = base64.b64decode(data_url.split(",", 1)[1])
    except Exception:
        raise HTTPException(status_code=400, detail="invalid base64")
    p = paths.data_dir() / "assets" / "photo.jpg"
    p.write_bytes(raw)
    profile = storage.load("profile") or {}
    profile["photo"] = "assets/photo.jpg"
    storage.save("profile", profile)
    return profile


# ------------------------------------------------------------------ 渲染 / 导出

def _find_variant(vid: str) -> dict:
    for v in storage.load("variants") or []:
        if v.get("id") == vid:
            return v
    raise HTTPException(status_code=404, detail=f"variant not found: {vid}")


def _photo_data_uri() -> str:
    p = paths.data_dir() / "assets" / "photo.jpg"
    if p.exists():
        return "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode()
    return ""


@app.get("/render/{vid}", response_class=HTMLResponse)
def render_variant_page(vid: str, print: int = 0, zoom: float = 1.0):
    variant = _find_variant(vid)
    profile = storage.load("profile") or {}
    blocks = storage.load("blocks") or []
    return render.render_page(profile, blocks, variant, photo_src="/assets/photo",
                              print_mode=bool(print), zoom=zoom)


@app.get("/api/export/{vid}.md")
def export_markdown(vid: str):
    variant = _find_variant(vid)
    profile = storage.load("profile") or {}
    blocks = storage.load("blocks") or []
    md = render.render_markdown(profile, blocks, variant)
    filename = quote(f"{variant.get('name', 'resume')}.md")
    return PlainTextResponse(
        md,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@app.get("/api/export/{vid}.html")
def export_html(vid: str):
    variant = _find_variant(vid)
    profile = storage.load("profile") or {}
    blocks = storage.load("blocks") or []
    page = render.render_page(profile, blocks, variant, photo_src=_photo_data_uri())
    filename = quote(f"{variant.get('name', 'resume')}.html")
    return HTMLResponse(
        page,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


# ------------------------------------------------------------------ 前端静态

_frontend = paths.frontend_dir()

if not _frontend.exists():
    raise RuntimeError(f"frontend 目录不存在：{_frontend}")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(_frontend / "index.html")


app.mount("/static", StaticFiles(directory=str(_frontend)), name="static")
