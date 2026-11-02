/* moduleResume · 主题包（简历渲染样式）
   每个主题 = 一段 CSS，作用于 render.js 输出的同一套 DOM 结构。
   新增主题：在 THEMES 中追加 { id, name, css }，前端下拉框会自动出现。
*/
'use strict';

/* 公共排版（与主题无关：纸张、间距、结构） */
const BASE_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #e9edf3; font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", Arial, sans-serif; }
.resume { font-size: 10.5pt; line-height: 1.55; word-break: break-word; }
/* 屏幕预览：A4 纸样。宽度 21cm、页边距做内边距 → 内容宽度 = 与打印完全一致（避免换行差异） */
@media screen {
  .resume { width: 21cm; margin: 0.9cm auto 1.2cm; padding: 1.6cm 1.9cm 1.4cm;
            background: #fff; box-shadow: 0 2px 12px rgba(20, 30, 60, .14); }
}
.resume h1 { margin: 0 0 4pt; font-weight: 700; }
.resume h1 .gender { font-size: 10.5pt; font-weight: 500; margin-left: 7pt; }
.resume .r-head { display: flex; align-items: flex-start; gap: 14pt; }
.resume .r-head-left { flex: 1; min-width: 0; }
.resume img.photo { width: 2.75cm; height: 3.67cm; object-fit: cover; flex-shrink: 0; }
.resume p { margin: 3pt 0; }
.resume p.proj-meta { font-size: 10pt; color: #555; margin: 2pt 0; }
.resume h2 { margin: 13pt 0 6pt; font-weight: 700; }
.resume h3 { margin: 8pt 0 3pt; font-weight: 700; }
.resume p.label { font-weight: 700; font-size: 10pt; margin: 6pt 0 2pt; }
.resume p.label { break-after: avoid; }
.resume .section-page-break { break-before: page; }
.resume ul.bullets { margin: 2pt 0; padding-left: 15pt; }
.resume ul.bullets li { margin: 2pt 0; }
.resume ul.edu { list-style: none; margin: 2pt 0; padding: 0; }
.resume ul.edu li { margin: 3pt 0; }
.resume ul.edu .edu-row { display: flex; align-items: baseline; gap: 8pt; }
.resume ul.edu .dates { font-weight: 700; min-width: 7.6em; white-space: nowrap; }
.resume ul.edu .school { font-weight: 700; white-space: nowrap; }
.resume ul.edu .major { min-width: 0; }
.resume ul.edu .deg { margin-left: auto; font-size: 10pt; white-space: nowrap; }
.resume ul.edu .edu-advisor { font-size: 9.5pt; color: #666; margin-top: 1pt; }
.resume .edu-advisor-card { margin: 3pt 0 4pt 7.6em; padding: 4pt 7pt; border-left: 2pt solid #d5deef; background: #f7f9fc; font-size: 9.5pt; line-height: 1.45; }
.resume .advisor-card { margin: 5pt 0 8pt; break-inside: avoid; }
.resume .advisor-card h3 { margin-bottom: 2pt; }
.resume .advisor-relation { color: #1E386B; font-weight: 700; }
.resume .advisor-identity { font-weight: 500; color: #555; }
.resume .advisor-meta { color: #555; font-size: 9.5pt; margin: 1.5pt 0; }
.resume .advisor-brief { margin: 2pt 0; }
.resume ol.papers { margin: 2pt 0; padding-left: 17pt; }
.resume ol.papers li { margin: 2.5pt 0; }
.resume h2, .resume h3 { break-after: avoid; }
.resume li, .resume p { break-inside: avoid; }
@media print {
  body { background: #fff; }
  .resume { width: auto; margin: 0; padding: 0; background: none; box-shadow: none; }
  @page { size: A4; margin: 1.6cm 1.9cm 1.4cm; }
}
`;

/* 藏青学术（默认）：稳重的深藏青 + 学术红点缀，适合高校/科研/央国企 */
const NAVY_CSS = `
.resume { color: #404040; }
.resume h1 { font-size: 20pt; color: #1E386B; letter-spacing: 1px; }
.resume img.photo { border: 1px solid #dfe3ec; }
.resume .intent { margin: 3pt 0; }
.resume .meta { margin: 3pt 0; font-size: 10pt; }
.resume h2 { font-size: 11.5pt; color: #1E386B; border-bottom: 1.2pt solid #1E386B; padding-bottom: 3pt; }
.resume h3 { font-size: 10.5pt; color: #C00000; }
.resume p.label { color: #1E386B; }
.resume p.work b { color: #262626; }
.resume ul.bullets li::marker { color: #1E386B; }
.resume ul.bullets b { color: #262626; }
.resume ul.edu .dates { color: #1E386B; }
.resume ul.edu .school { color: #262626; }
.resume ol.papers li::marker { color: #1E386B; font-weight: 700; }
.resume ol.papers b { color: #262626; }
`;

/* 现代简约：深墨 + 蓝色点缀，左标线标题、意向标签，适合互联网/企业岗 */
const MODERN_CSS = `
.resume { color: #334155; }
.resume h1 { font-size: 21pt; color: #0f172a; letter-spacing: .5px; }
.resume img.photo { border: 1px solid #e2e8f0; border-radius: 8px; }
.resume .intent { display: inline-block; margin: 3pt 0; padding: 2pt 10pt; border-radius: 999px;
                  background: #eff6ff; color: #2563eb; font-weight: 600; font-size: 10pt; }
.resume .meta { margin: 3pt 0; font-size: 10pt; color: #64748b; }
.resume h2 { font-size: 12pt; color: #0f172a; border-left: 3pt solid #2563eb; padding-left: 8pt; }
.resume h3 { font-size: 10.5pt; color: #2563eb; }
.resume p.label { color: #2563eb; }
.resume p.work b { color: #0f172a; }
.resume ul.bullets li::marker { color: #60a5fa; }
.resume ul.bullets b { color: #0f172a; }
.resume ul.edu .dates { color: #2563eb; }
.resume ul.edu .school { color: #0f172a; }
.resume ol.papers li::marker { color: #2563eb; font-weight: 700; }
.resume ol.papers b { color: #0f172a; }
`;

/* 学术红 · 借鉴 Awesome-CV（posquit0/Awesome-CV）：酒红点缀 + 章节下划线 */
const AWESOME_CSS = `
.resume { color: #383838; font-family: "Segoe UI", "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif; }
.resume h1 { font-size: 22pt; color: #9E1B32; letter-spacing: .5px; }
.resume h1 .gender { font-size: 11pt; font-weight: 500; color: #383838; }
.resume .intent { margin: 2pt 0 3pt; color: #9E1B32; font-weight: 600; }
.resume .meta { margin: 2pt 0; font-size: 10pt; color: #555; }
.resume img.photo { border: 2pt solid #9E1B32; border-radius: 2px; }
.resume h2 { font-size: 12pt; color: #9E1B32; letter-spacing: .5px; border-bottom: 1.4pt solid #9E1B32; padding-bottom: 2pt; }
.resume h3 { font-size: 10.5pt; color: #1c1c1c; }
.resume p.label { color: #9E1B32; }
.resume p.work b { color: #1c1c1c; }
.resume ul.bullets li::marker { color: #9E1B32; }
.resume ul.bullets b { color: #1c1c1c; }
.resume ul.edu .dates { color: #9E1B32; }
.resume ul.edu .school { color: #1c1c1c; }
.resume ol.papers li::marker { color: #9E1B32; font-weight: 700; }
.resume ol.papers b { color: #1c1c1c; }
`;

/* 经典黑白 · 借鉴 sb2nov/resume、jakegut/resume：ATS 友好单栏、衬线、黑白、三线表式标题 */
const CLASSIC_CSS = `
.resume { color: #000; font-family: "Times New Roman", "SimSun", "宋体", "Songti SC", serif; }
.resume h1 { font-size: 20pt; text-align: center; letter-spacing: 3px; }
.resume h1 .gender { font-size: 11pt; letter-spacing: 0; font-weight: 400; }
.resume .r-head-left { text-align: center; }
.resume .intent { margin: 1.5pt 0; font-size: 10.5pt; }
.resume .meta { margin: 1.5pt 0; font-size: 10pt; color: #000; }
.resume img.photo { border: 1pt solid #000; filter: grayscale(100%); }
.resume h2 { font-size: 11pt; letter-spacing: 2px; text-transform: uppercase; border-bottom: 1pt solid #000; padding-bottom: 2pt; }
.resume h3 { font-size: 10.5pt; color: #000; }
.resume p.label { color: #000; }
.resume ul.bullets li::marker { color: #000; }
.resume ul.bullets b { color: #000; }
.resume ul.edu .dates { color: #000; }
.resume ul.edu .school { color: #000; }
.resume ol.papers li::marker { color: #000; }
.resume ol.papers b { color: #000; }
`;

/* 宋体典雅 · 借鉴 RenderCV 的 classic 主题：衬线 + 居中双线章节标题 */
const SERIF_CSS = `
.resume { color: #1a1a1a; font-family: "Source Han Serif SC", "Noto Serif CJK SC", "SimSun", "宋体", Georgia, "Times New Roman", serif; }
.resume h1 { font-size: 20pt; font-weight: 600; letter-spacing: 4px; }
.resume h1 .gender { font-size: 11pt; font-weight: 400; letter-spacing: 0; }
.resume .intent { margin: 2pt 0; color: #333; }
.resume .meta { margin: 2pt 0; font-size: 10pt; color: #444; }
.resume img.photo { border: 1pt solid #b3a894; }
.resume h2 { font-size: 11.5pt; letter-spacing: 3px; font-weight: 600; text-align: center;
             border-top: .9pt solid #333; border-bottom: .9pt solid #333; padding: 2.5pt 0; }
.resume h3 { font-size: 10.5pt; color: #000; }
.resume p.label { color: #333; }
.resume p.work b { color: #000; }
.resume ul.bullets li::marker { color: #777; }
.resume ul.edu .dates { color: #333; }
.resume ul.edu .school { color: #000; }
.resume ol.papers li::marker { color: #333; }
.resume ol.papers b { color: #000; }
`;

/* 藏蓝横条 · 借鉴 Deedy-CV：章节标题藏蓝横条 + 深红小标题 */
const DEEDY_CSS = `
.resume { color: #2f2f2f; }
.resume h1 { font-size: 21pt; color: #16365C; }
.resume h1 .gender { font-size: 11pt; font-weight: 500; }
.resume .intent { margin: 2pt 0; color: #16365C; font-weight: 600; }
.resume .meta { margin: 2pt 0; font-size: 10pt; color: #555; }
.resume img.photo { border: 1pt solid #c9d4e4; border-radius: 3px; }
.resume h2 { font-size: 11.5pt; color: #16365C; background: #e9eef6; border-left: 3.5pt solid #16365C; padding: 3pt 8pt; }
.resume h3 { font-size: 10.5pt; color: #B03A2E; }
.resume p.label { color: #16365C; }
.resume p.work b { color: #16365C; }
.resume ul.bullets li::marker { color: #16365C; }
.resume ul.bullets b { color: #16365C; }
.resume ul.edu .dates { color: #16365C; }
.resume ul.edu .school { color: #16365C; }
.resume ol.papers li::marker { color: #16365C; font-weight: 700; }
.resume ol.papers b { color: #16365C; }
`;

/* ---------------- 自定义样式（用户可调入口） ---------------- */
const CUSTOM_DEFAULTS = {
  accent: '#1E386B',
  text: '#404040',
  font: 'sans',
  fontSize: 10.5,
  lineHeight: 1.55,
  section: 'underline',
  margin: 'normal',
  photoPos: 'right',
  photoSize: 'normal',
  density: 'normal',
};

const CUSTOM_FONTS = {
  sans: '"Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif',
  serif: '"Source Han Serif SC", "Noto Serif CJK SC", "SimSun", "宋体", Georgia, serif',
  kai: '"KaiTi", "楷体", "STKaiti", serif',
};

const CUSTOM_MARGINS = {
  compact: { screen: '1.2cm 1.5cm 1.1cm', page: '1.2cm 1.5cm 1.1cm' },
  normal: { screen: '1.6cm 1.9cm 1.4cm', page: '1.6cm 1.9cm 1.4cm' },
  loose: { screen: '2cm 2.3cm 1.8cm', page: '2cm 2.3cm 1.8cm' },
};

function sanitizeColor(v, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : fallback;
}
function mixWithWhite(hex, ratio) {
  const h = sanitizeColor(hex, CUSTOM_DEFAULTS.accent).slice(1);
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const m = c => Math.round(c + (255 - c) * ratio);
  return '#' + [m(r), m(g), m(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* 由用户参数生成一整套主题 CSS（参数全部消毒，防止注入） */
function buildCustomCss(style) {
  const s = Object.assign({}, CUSTOM_DEFAULTS, style || {});
  const accent = sanitizeColor(s.accent, CUSTOM_DEFAULTS.accent);
  const text = sanitizeColor(s.text, CUSTOM_DEFAULTS.text);
  const tint = mixWithWhite(accent, 0.9);
  const font = CUSTOM_FONTS[s.font] || CUSTOM_FONTS.sans;
  const size = Math.min(12.5, Math.max(9, parseFloat(s.fontSize) || CUSTOM_DEFAULTS.fontSize));
  const lh = Math.min(2, Math.max(1.25, parseFloat(s.lineHeight) || CUSTOM_DEFAULTS.lineHeight));
  const margin = CUSTOM_MARGINS[s.margin] || CUSTOM_MARGINS.normal;
  const section = s.section || 'underline';
  let h2;
  if (section === 'bar') h2 = `border-left: 3.5pt solid ${accent}; background: ${tint}; color: ${accent}; padding: 3pt 8pt;`;
  else if (section === 'center') h2 = `text-align: center; letter-spacing: 3px; border-top: .9pt solid ${text}; border-bottom: .9pt solid ${text}; padding: 2.5pt 0; color: ${text};`;
  else if (section === 'leftbar') h2 = `border-left: 3pt solid ${accent}; padding-left: 8pt; color: ${accent};`;
  else h2 = `border-bottom: 1.4pt solid ${accent}; padding-bottom: 2pt; color: ${accent};`;
  /* 版式：照片位置/大小、密度 */
  const photoSizes = { small: [2.3, 3.07], normal: [2.75, 3.67], large: [3.2, 4.27] };
  const psz = photoSizes[s.photoSize] || photoSizes.normal;
  const densities = {
    compact: { h2: 'margin: 10pt 0 4pt;', h3: 'margin: 6pt 0 2pt;', p: 'margin: 2pt 0;', li: 'margin: 1.5pt 0;' },
    normal: { h2: 'margin: 13pt 0 6pt;', h3: 'margin: 8pt 0 3pt;', p: 'margin: 3pt 0;', li: 'margin: 2pt 0;' },
    loose: { h2: 'margin: 16pt 0 8pt;', h3: 'margin: 10pt 0 4pt;', p: 'margin: 4pt 0;', li: 'margin: 3pt 0;' },
  };
  const dn = densities[s.density] || densities.normal;
  const photoPos = s.photoPos || 'right';
  const layout = [
    photoPos === 'left' ? '.resume .r-head { flex-direction: row-reverse; }' : '',
    photoPos === 'none' ? '.resume img.photo { display: none; }' : '',
  ].filter(Boolean).join('\n');
  return `
.resume { color: ${text}; font-family: ${font}; font-size: ${size}pt; line-height: ${lh}; }
@media screen { .resume { padding: ${margin.screen}; } }
.resume h1 { color: ${accent}; }
.resume h1 .gender { font-size: ${Math.max(9, size + 0.5)}pt; font-weight: 500; color: ${text}; }
.resume .intent { color: ${accent}; font-weight: 600; }
.resume .meta { font-size: ${Math.max(8.5, size - 0.5)}pt; }
.resume img.photo { width: ${psz[0]}cm; height: ${psz[1]}cm; border: 1.4pt solid ${accent}; border-radius: 2px; }
.resume h2 { font-size: ${size + 1.5}pt; ${h2} ${dn.h2} }
.resume h3 { color: ${accent}; ${dn.h3} }
.resume p { ${dn.p} }
.resume ul.bullets li { ${dn.li} }
.resume ul.edu li { ${dn.li} }
.resume p.label { color: ${accent}; }
.resume ul.bullets li::marker { color: ${accent}; }
.resume ul.edu .dates { color: ${accent}; }
.resume ol.papers li::marker { color: ${accent}; font-weight: 700; }
${layout}
@media print { @page { margin: ${margin.page}; } }
`;
}

const THEMES = [
  { id: 'theme-navy', name: '藏青学术', css: NAVY_CSS },
  { id: 'theme-modern', name: '现代简约', css: MODERN_CSS },
  { id: 'theme-awesome', name: '学术红', css: AWESOME_CSS },
  { id: 'theme-classic', name: '经典黑白', css: CLASSIC_CSS },
  { id: 'theme-serif', name: '宋体典雅', css: SERIF_CSS },
  { id: 'theme-deedy', name: '藏蓝横条', css: DEEDY_CSS },
  { id: 'theme-custom', name: '自定义样式', css: '' },
];

const DEFAULT_THEME = 'theme-navy';

function themeCss(id, style) {
  if (id === 'theme-custom') return BASE_CSS + buildCustomCss(style);
  const t = THEMES.find(x => x.id === id);
  return BASE_CSS + (t && t.css ? t.css : THEMES[0].css);
}

function list() {
  return THEMES.map(t => ({ id: t.id, name: t.name }));
}

module.exports = { THEMES, DEFAULT_THEME, themeCss, list, CUSTOM_DEFAULTS };
