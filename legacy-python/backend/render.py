"""moduleResume · 渲染引擎（领域层）
输入：profile + blocks + variant  →  输出：简历正文 HTML / 完整页面 / Markdown

数据流：
    素材块库(blocks) ──按 variant 组装（引用 + 覆盖）──▶ 渲染树 ──▶ HTML / Markdown
"""
import html as html_lib
from typing import Any, Dict, List

# ---------------------------------------------------------------- 基础工具


def esc(value: Any) -> str:
    return html_lib.escape(str(value if value is not None else ""), quote=True)


def _split_lead(text: str):
    """「引导词：内容」→ (lead, colon, rest)；不满足条件返回 None"""
    for colon in ("：", ":"):
        pos = text.find(colon)
        if 0 < pos <= 12 and pos < len(text) - 1:
            return text[:pos], colon, text[pos + 1:]
    return None


def _bullet_li(text: str) -> str:
    m = _split_lead(text)
    if m:
        lead, colon, rest = m
        return f"<li><b>{esc(lead)}</b>{colon}{esc(rest)}</li>"
    return f"<li>{esc(text)}</li>"


def _bullet_md(text: str) -> str:
    m = _split_lead(text)
    if m:
        lead, colon, rest = m
        return f"- **{lead}**{colon}{rest}"
    return f"- {text}"


# ---------------------------------------------------------------- 组装


def _apply_override(block: Dict[str, Any], ov: Dict[str, Any]) -> Dict[str, Any]:
    """版本级局部覆盖：v0.1 支持 title / text / work / desc / bullets{index}"""
    if not ov:
        return block
    content = dict(block.get("content", {}))
    merged = {
        "id": block.get("id"),
        "type": block.get("type"),
        "title": ov.get("title", block.get("title", "")),
        "group": block.get("group", ""),
        "tags": block.get("tags", []),
        "content": content,
    }
    for key in ("text", "work", "desc"):
        if ov.get(key):
            content[key] = ov[key]
    if ov.get("bullets"):
        bullets = list(content.get("bullets", []))
        for idx, val in ov["bullets"].items():
            i = int(idx)
            if 0 <= i < len(bullets):
                bullets[i] = val
        content["bullets"] = bullets
    return merged


def _section_items(section: Dict[str, Any], blocks_map: Dict[str, dict]) -> List[dict]:
    items = []
    for it in section.get("items", []):
        bid = it.get("bid")
        block = blocks_map.get(bid)
        if block:
            items.append(_apply_override(block, it.get("ov") or {}))
    return items


# ---------------------------------------------------------------- HTML 渲染


def _render_header(profile: dict, variant: dict, photo_src: str) -> str:
    photo = f'<img class="photo" alt="照片" src="{esc(photo_src)}">' if photo_src else ""
    return (
        '<header class="r-head">\n'
        '  <div class="r-head-left">\n'
        f'    <h1>{esc(profile.get("name", ""))}</h1>\n'
        f'    <p class="intent">求职意向：{esc(variant.get("intent", ""))}</p>\n'
        f'    <p class="meta">出生年月：{esc(profile.get("birth", ""))}　|　籍贯：{esc(profile.get("hometown", ""))}</p>\n'
        f'    <p class="meta">联系电话：{esc(profile.get("phone", ""))}　|　电子邮箱：{esc(profile.get("email", ""))}</p>\n'
        '  </div>\n'
        f'  {photo}\n'
        '</header>'
    )


def _render_section_html(section: dict, items: List[dict], variant: dict) -> str:
    kind = section.get("kind", "bullets")
    title = section.get("title", "")
    if not items:
        return ""
    out: List[str] = []
    if title and kind != "paragraph":
        out.append(f"<h2>{esc(title)}</h2>")

    if kind == "paragraph":
        if title:
            out.insert(0, f"<h2>{esc(title)}</h2>")
        for b in items:
            text = b["content"].get("text", "")
            if b.get("type") == "summary" and variant.get("summaryOverride"):
                text = variant["summaryOverride"]
            if text:
                out.append(f"<p>{esc(text)}</p>")

    elif kind == "education":
        out.append('<ul class="edu">')
        for b in items:
            c = b["content"]
            out.append(
                f'<li><b class="dates">{esc(c.get("dates", ""))}</b>'
                f'<b class="school">{esc(c.get("school", ""))}</b>'
                f'<span class="deg">{esc(c.get("degree", ""))}</span></li>'
            )
        out.append("</ul>")

    elif kind == "bullets":
        out.append('<ul class="bullets">')
        for b in items:
            out.append(_bullet_li(b["content"].get("text", "")))
        out.append("</ul>")

    elif kind == "projects":
        for b in items:
            c = b["content"]
            out.append(f'<h3>{esc(b.get("title", ""))}</h3>')
            if c.get("work"):
                out.append(f'<p class="work"><b>项目工作</b>：{esc(c["work"])}</p>')
            out.append('<ul class="bullets">')
            for line in c.get("bullets", []):
                out.append(_bullet_li(line))
            out.append("</ul>")

    elif kind in ("publications", "patents"):
        counter = 0
        current_group = None
        open_list = False
        default_group = "论文" if kind == "publications" else "专利"
        for b in items:
            group = b.get("group") or default_group
            if group != current_group:
                if open_list:
                    out.append("</ol>")
                out.append(f'<p class="label">{esc(group)}</p>')
                out.append(f'<ol class="papers" start="{counter + 1}">')
                open_list = True
                current_group = group
            counter += 1
            c = b["content"]
            if kind == "publications":
                note = c.get("note", "")
                desc = c.get("desc", "")
                out.append(f'<li><b>{esc(b.get("title", ""))}</b>{esc(note)}。{esc(desc)}。</li>')
            else:
                out.append(f'<li><b>{esc(b.get("title", ""))}</b>，{esc(c.get("status", ""))}。</li>')
        if open_list:
            out.append("</ol>")

    elif kind == "custom":
        out.append('<ul class="bullets">')
        for b in items:
            for line in b["content"].get("lines", []):
                out.append(_bullet_li(line))
        out.append("</ul>")

    return "\n".join(out)


def render_variant_html(profile: dict, blocks: List[dict], variant: dict, photo_src: str) -> str:
    blocks_map = {b.get("id"): b for b in blocks or []}
    parts = [_render_header(profile, variant, photo_src)]
    for section in variant.get("sections", []):
        items = _section_items(section, blocks_map)
        html = _render_section_html(section, items, variant)
        if html:
            parts.append(html)
    return "\n".join(parts)


# ---------------------------------------------------------------- 完整页面

RESUME_CSS = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #fff; font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", Arial, sans-serif; }
.resume { color: #404040; font-size: 10.5pt; line-height: 1.55; word-break: break-word;
          margin: 1.6cm 1.9cm 1.4cm; max-width: 21cm; }
.resume h1 { font-size: 20pt; color: #1E386B; margin: 0 0 4pt; font-weight: 700; letter-spacing: 1px; }
.resume .r-head { display: flex; align-items: flex-start; gap: 14pt; }
.resume .r-head-left { flex: 1; min-width: 0; }
.resume img.photo { width: 2.75cm; height: 3.67cm; object-fit: cover; border: 1px solid #dfe3ec; flex-shrink: 0; }
.resume .intent { margin: 3pt 0; }
.resume .meta { margin: 3pt 0; font-size: 10pt; }
.resume h2 { font-size: 11.5pt; color: #1E386B; font-weight: 700;
             border-bottom: 1.2pt solid #1E386B; padding-bottom: 3pt; margin: 13pt 0 6pt; }
.resume h3 { font-size: 10.5pt; color: #C00000; font-weight: 700; margin: 8pt 0 3pt; }
.resume p { margin: 3pt 0; }
.resume p.label { font-weight: 700; color: #1E386B; font-size: 10pt; margin: 6pt 0 2pt; }
.resume p.work b { color: #262626; }
.resume ul.bullets { margin: 2pt 0; padding-left: 15pt; }
.resume ul.bullets li { margin: 2pt 0; }
.resume ul.bullets li::marker { color: #1E386B; }
.resume ul.bullets b { color: #262626; }
.resume ul.edu { list-style: none; margin: 2pt 0; padding: 0; }
.resume ul.edu li { display: flex; align-items: baseline; gap: 8pt; margin: 3pt 0; }
.resume ul.edu .dates { color: #1E386B; font-weight: 700; min-width: 7.6em; }
.resume ul.edu .school { color: #262626; font-weight: 700; }
.resume ul.edu .deg { margin-left: auto; font-size: 10pt; }
.resume ol.papers { margin: 2pt 0; padding-left: 17pt; }
.resume ol.papers li { margin: 2.5pt 0; }
.resume ol.papers li::marker { color: #1E386B; font-weight: 700; }
.resume ol.papers b { color: #262626; }
.resume h2, .resume h3 { break-after: avoid; }
.resume li, .resume p { break-inside: avoid; }
@media print { @page { size: A4; margin: 1.6cm 1.9cm 1.4cm; } .resume { margin: 0; } }
"""


def render_page(profile: dict, blocks: list, variant: dict, photo_src: str,
                print_mode: bool = False, zoom: float = 1.0) -> str:
    body = render_variant_html(profile, blocks, variant, photo_src)
    title = esc(variant.get("name", "简历"))
    auto_print = (
        "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},450);});</script>"
        if print_mode else ""
    )
    zoom_css = f"<style>body{{zoom:{zoom};}}</style>" if zoom and zoom != 1.0 else ""
    return (
        "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n"
        f"<title>{title}</title>\n<style>{RESUME_CSS}</style>\n{zoom_css}\n</head>\n"
        f"<body>\n<article class=\"resume\">\n{body}\n</article>\n{auto_print}\n</body>\n</html>"
    )


# ---------------------------------------------------------------- Markdown 渲染


def render_markdown(profile: dict, blocks: list, variant: dict) -> str:
    blocks_map = {b.get("id"): b for b in blocks or []}
    lines: List[str] = []
    lines.append(f"# {profile.get('name', '')}")
    lines.append(f"**求职意向：{variant.get('intent', '')}**")
    lines.append(
        f"出生年月：{profile.get('birth', '')}　|　籍贯：{profile.get('hometown', '')}\n"
        f"联系电话：{profile.get('phone', '')}　|　电子邮箱：{profile.get('email', '')}"
    )
    lines.append("---")

    for section in variant.get("sections", []):
        items = _section_items(section, blocks_map)
        if not items:
            continue
        kind = section.get("kind", "bullets")
        title = section.get("title", "")
        block: List[str] = []
        if title:
            block.append(f"## {title}")

        if kind == "paragraph":
            for b in items:
                text = b["content"].get("text", "")
                if b.get("type") == "summary" and variant.get("summaryOverride"):
                    text = variant["summaryOverride"]
                if text:
                    block.append(text)

        elif kind == "education":
            for b in items:
                c = b["content"]
                block.append(f"- **{c.get('dates', '')}**　{c.get('school', '')}　{c.get('degree', '')}")

        elif kind == "bullets":
            for b in items:
                block.append(_bullet_md(b["content"].get("text", "")))

        elif kind == "projects":
            for b in items:
                c = b["content"]
                block.append(f"### {b.get('title', '')}")
                if c.get("work"):
                    block.append(f"**项目工作**：{c['work']}")
                for line in c.get("bullets", []):
                    block.append(_bullet_md(line))

        elif kind in ("publications", "patents"):
            counter = 0
            current_group = None
            default_group = "论文" if kind == "publications" else "专利"
            for b in items:
                group = b.get("group") or default_group
                if group != current_group:
                    block.append(f"**{group}**")
                    current_group = group
                counter += 1
                c = b["content"]
                if kind == "publications":
                    note = c.get("note", "")
                    desc = c.get("desc", "")
                    block.append(f"{counter}. **{b.get('title', '')}**{note}。{desc}。")
                else:
                    block.append(f"{counter}. **{b.get('title', '')}**，{c.get('status', '')}。")

        elif kind == "custom":
            for b in items:
                for line in b["content"].get("lines", []):
                    block.append(_bullet_md(line))

        if len(block) > 1 or (block and not block[0].startswith("##")):
            lines.extend(block)

    return "\n\n".join(lines) + "\n"
