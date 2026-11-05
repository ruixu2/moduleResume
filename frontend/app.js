/* ================================================================
   moduleResume · 前端核心：工具 / 状态 / 投递管理 / 版本列表 / 素材块库
   ================================================================ */

/* ---------------- 常量 ---------------- */
const STATUSES = ['准备中', '已投递', '笔试', '面试中', '已完成', '已放弃'];

const TYPES = {
  summary:   { label: '个人总结', color: 't-summary' },
  education: { label: '教育经历', color: 't-education' },
  advisor:   { label: '研究生导师', color: 't-advisor' },
  thesis:    { label: '学位论文', color: 't-thesis' },
  skill:     { label: '技能',     color: 't-skill' },
  project:   { label: '项目',     color: 't-project' },
  internship: { label: '实习经历', color: 't-internship' },
  course:    { label: '学习课程', color: 't-course' },
  academic_service: { label: '学术兼职', color: 't-academic-service' },
  award:     { label: '获奖经历', color: 't-award' },
  paper:     { label: '期刊论文', color: 't-paper' },
  unpublished_paper: { label: '未发表论文', color: 't-unpublished-paper' },
  patent:    { label: '专利',     color: 't-patent' },
  custom:    { label: '自定义',   color: 't-custom' },
};

const KINDS = {
  education:    { label: '教育时间线', types: ['education'] },
  advisors:     { label: '研究生导师（独立板块）', types: ['advisor'] },
  theses:       { label: '学位论文',   types: ['thesis'] },
  paragraph:    { label: '段落文本',   types: ['summary', 'custom'] },
  bullets:      { label: '要点列表',   types: ['skill', 'custom'] },
  projects:     { label: '项目详情',   types: ['project'] },
  internships:  { label: '实习经历',   types: ['internship'] },
  courses:      { label: '学习课程',   types: ['course'] },
  academic_services: { label: '学术兼职', types: ['academic_service'] },
  awards:       { label: '获奖经历',   types: ['award'] },
  publications: { label: '期刊论文列表', types: ['paper'] },
  unpublished:  { label: '未发表论文列表', types: ['unpublished_paper'] },
  patents:      { label: '专利列表',   types: ['patent'] },
  custom:       { label: '自定义要点', types: ['custom', 'skill', 'summary'] },
};

/* ---------------- 状态 ---------------- */
let DB = { profile: {}, blocks: [], variants: [], applications: [], snapshots: [], settings: {} };
let editingVariant = null;   // 编辑器中的工作副本
let THEMES = [];             // 排版主题（由 /api/themes 加载）

/* ---------------- 工具 ---------------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const deepClone = o => JSON.parse(JSON.stringify(o));
const uid = p => (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function debounce(fn, ms) {
  let t = null, lastArgs = null;
  function wrapped() {
    lastArgs = arguments;
    clearTimeout(t);
    t = setTimeout(() => { t = null; const a = lastArgs; lastArgs = null; fn.apply(null, a); }, ms);
  }
  /* 立即执行仍在等待中的一次调用（重启前保存等场景） */
  wrapped.flush = function () {
    if (t == null) return undefined;
    clearTimeout(t); t = null;
    const a = lastArgs; lastArgs = null;
    return fn.apply(null, a);
  };
  wrapped.cancel = function () { clearTimeout(t); t = null; lastArgs = null; };
  return wrapped;
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

let toastTimer = null;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function modal(html, narrow) {
  const root = $('#modal-root');
  root.innerHTML = '<div class="modal-mask"><div class="modal' + (narrow ? ' narrow' : '') + '">' + html + '</div></div>';
  const mask = $('.modal-mask', root);
  mask.addEventListener('click', e => { if (e.target === mask) closeModal(); });
  $$('[data-close]', root).forEach(b => b.onclick = closeModal);
  return $('.modal', root);
}
let modalCloseHook = null;
function closeModal() {
  const hook = modalCloseHook; modalCloseHook = null;
  if (hook) { try { hook(); } catch (e) { /* 关闭前钩子（如兜底保存）不应阻塞关闭 */ } }
  $('#modal-root').innerHTML = '';
}

function download(name, text, mime) {
  const blob = new Blob([text], { type: (mime || 'application/json') + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 600);
}

/* 直接导出 PDF（后端用无头浏览器生成，无需打印对话框） */
async function exportPdfFile(url) {
  try {
    toast('正在生成 PDF…');
    const r = await fetch(url);
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      try { const j = await r.json(); msg = j.error || msg; } catch (e) { /* ignore */ }
      throw new Error(msg);
    }
    const blob = await r.blob();
    let name = 'resume.pdf';
    const cd = r.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename\*=UTF-8''([^;]+)/i);
    if (m) { try { name = decodeURIComponent(m[1]); } catch (e) { /* ignore */ } }
    const a = document.createElement('a');
    const href = URL.createObjectURL(blob);
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(href); a.remove(); }, 1000);
    toast('PDF 已生成：' + name);
  } catch (err) {
    toast('导出 PDF 失败：' + (err && err.message ? err.message : err));
  }
}

/* ---------------- API ---------------- */
const api = {
  async get(p) { const r = await fetch(p); if (!r.ok) throw new Error(p + ' → ' + r.status); return r.json(); },
  async put(p, data) { const r = await fetch(p, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(p + ' → ' + r.status); return r.json(); },
  async post(p, data) { const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(p + ' → ' + r.status); return r.json(); },
};

const saveProfile = debounce(() => api.put('/api/profile', DB.profile), 600);
const saveBlocks = () => api.put('/api/blocks', DB.blocks);
const saveVariants = () => api.put('/api/variants', DB.variants);
const saveApps = () => api.put('/api/applications', DB.applications);

/* ---------------- 版本快照 / 版本级覆盖 ---------------- */
function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || '');
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
/* 判断某条引用是否带版本级覆盖（兼容新旧两种 ov 格式） */
function hasOv(ov) {
  if (!ov) return false;
  if (ov.title || ov.group || ov.text || ov.work || ov.desc) return true;
  if (ov.content && Object.keys(ov.content).length) return true;
  if (ov.bullets && Object.keys(ov.bullets).length) return true;
  return false;
}
function snapshotsOf(variantId) {
  return (DB.snapshots || []).filter(s => s.variantId === variantId)
    .sort((a, b) => String(b.created).localeCompare(String(a.created)));
}
function snapshotById(id) { return (DB.snapshots || []).find(s => s.id === id); }

async function createSnapshot(variantId) {
  const meta = await api.post('/api/snapshots', { variantId });
  DB.snapshots = [meta].concat(DB.snapshots || []);
  toast('已创建快照（冻结当前版本）');
  return meta;
}
async function deleteSnapshot(id) {
  const r = await fetch('/api/snapshots/' + encodeURIComponent(id), { method: 'DELETE' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  DB.snapshots = (DB.snapshots || []).filter(s => s.id !== id);
}

/* ---------------- 素材块辅助 ---------------- */
function blockTitle(b) {
  if (b.title) return b.title;
  const c = b.content || {};
  if (b.type === 'education') {
    const e = eduParts(c);
    const line = [[e.school, e.college].filter(Boolean).join(' · '), e.major].filter(Boolean).join('　');
    if (line.trim()) return line.slice(0, 50);
  }
  if (b.type === 'advisor') {
    const line = [c.relationship || '研究生导师', c.name, c.academicTitle].filter(Boolean).join(' · ');
    if (line.trim()) return line.slice(0, 50);
  }
  if (b.type === 'thesis') {
    const d = thesisDegree(c);
    const line = [d.type, d.major].filter(Boolean).join(' · ');
    if (line.trim()) return line.slice(0, 50);
  }
  if (b.type === 'internship' || b.type === 'academic_service') {
    const line = [b.type === 'internship' ? c.company : c.organization, c.position].filter(Boolean).join(' · ');
    if (line) return line;
  }
  const fallback = c.text || (Array.isArray(c.items) && c.items[0]) || (c.lines && c.lines[0]) || (c.bullets && c.bullets[0]) || c.status || '（未命名素材块）';
  return String(fallback).slice(0, 50);
}
function blockSub(b) {
  const c = b.content || {};
  if (b.type === 'award') {
    return [c.level, c.rank, c.date, c.organization, c.recipient, c.desc].filter(Boolean).join('　').slice(0, 100);
  }
  if (b.type === 'academic_service') {
    return [c.organization, c.position, eduDateLine(c), c.desc].filter(Boolean).join('　').slice(0, 100);
  }
  if (b.type === 'internship') {
    return [eduDateLine(c), c.company, c.position, c.department, c.location, (c.works || [])[0]].filter(Boolean).join('　').slice(0, 100);
  }
  if (b.type === 'course') {
    return [c.organization, c.courseType, c.dates, c.credits, c.score, c.desc].filter(Boolean).join('　').slice(0, 100);
  }
  if (b.type === 'project') {
    const meta = [c.source, c.projType, c.funding].filter(Boolean).join('　');
    const first = (Array.isArray(c.works) && c.works[0]) || (Array.isArray(c.bullets) && c.bullets[0]) || c.work || '';
    if (meta) return meta + (first ? '　' + String(first).slice(0, 40) : '');
    return String(first).slice(0, 60);
  }
  if (b.type === 'paper') {
    const metrics = [c.partition, c.impactFactor ? 'IF: ' + c.impactFactor : ''].filter(Boolean).join('，');
    const line = [c.journal, c.date, metrics ? '（' + metrics + '）' : ''].filter(Boolean).join('　');
    return line || String(c.desc || '').slice(0, 70);
  }
  if (b.type === 'unpublished_paper') {
    return [c.status, c.targetJournal, c.authors].filter(Boolean).join('　') || String(c.desc || '').slice(0, 70);
  }
  if (b.type === 'patent') return c.status || '';
  if (b.type === 'education') {
    const e = eduParts(c);
    return [[e.school, e.college].filter(Boolean).join(' · '), e.major || e.degreeType].filter(Boolean).join('　');
  }
  if (b.type === 'advisor') {
    const org = [c.organization, c.college].filter(Boolean).join(' · ');
    return [org, c.position, c.research].filter(Boolean).join('　').slice(0, 70);
  }
  if (b.type === 'thesis') {
    const d = thesisDegree(c);
    const e = eduParts(c);
    const schoolLine = [e.school, e.college].filter(Boolean).join(' · ');
    const line = [d.type, d.major, schoolLine, c.dates].filter(Boolean).join('　');
    return line || String(c.brief || c.desc || '').slice(0, 70);
  }
  if (b.type === 'summary' || b.type === 'skill') {
    if (b.type === 'skill' && Array.isArray(c.items) && c.items.length) {
      return (String(c.text || '').slice(0, 40) + '　·　子项 ' + c.items.length + ' 条').trim();
    }
    return String(c.text || '').slice(0, 70);
  }
  return (c.lines || []).join(' / ').slice(0, 70);
}
/* 学位论文：学位类型 / 专业名称（兼容旧版合并字段 degree） */
function thesisDegree(c) {
  c = c || {};
  if (c.degreeType || c.major) return { type: c.degreeType || '', major: c.major || '' };
  const raw = String(c.degree || '');
  const i = raw.indexOf('·');
  if (i > 0) return { type: raw.slice(0, i).trim(), major: raw.slice(i + 1).trim() };
  return { type: raw.trim(), major: '' };
}
/* 教育经历时间：年月选择（start/end）→ 展示串；兼容旧版 dates 文本 */
function eduDateLine(c) {
  c = c || {};
  const fmt = ym => (ym ? String(ym).replace(/-/g, '.') : '');
  const s = fmt(c.start), e = fmt(c.end);
  if (s || e) return [s, e || '至今'].filter(Boolean).join(' – ');
  return c.dates || '';
}
/* 解析旧版「2020.09 – 2026.09 / 至今」为 { start:'2020-09', end:'2026-09' } */
function parseEduDates(dates) {
  const raw = String(dates || '');
  const out = [];
  const re = /(\d{4})(?:[.\-/](\d{1,2}))?/g;
  let m;
  while ((m = re.exec(raw)) && out.length < 2) {
    out.push(m[1] + '-' + String(m[2] || '1').padStart(2, '0'));
  }
  const end = /至今/.test(raw) ? '' : (out[1] || '');
  return { start: out[0] || '', end: end };
}

/* 教育经历：学校 / 学院 / 专业 / 学历学位（兼容旧版合并字段 school、degree） */
function eduParts(c) {
  c = c || {};
  let school = c.school || '';
  let college = c.college || '';
  if (!college && school.indexOf('·') > 0) {
    const i = school.indexOf('·');
    college = school.slice(i + 1).trim();
    school = school.slice(0, i).trim();
  }
  let major = c.major || '';
  let degreeType = c.degreeType || '';
  if (!major && !degreeType && c.degree) {
    const raw = String(c.degree);
    const i = raw.indexOf('/');
    if (i > 0) { major = raw.slice(0, i).trim(); degreeType = raw.slice(i + 1).trim(); }
    else {
      const m = raw.match(/[（(]([^）)]*)[）)]\s*$/);
      if (m) { degreeType = m[1].trim(); major = raw.slice(0, m.index).trim(); }
      else major = raw.trim();
    }
  }
  return { school: school, college: college, major: major, degreeType: degreeType };
}
function badge(b) {
  const t = TYPES[b.type] || { label: b.type, color: '' };
  return '<span class="block-badge ' + t.color + '">' + esc(t.label) + '</span>';
}

/* ---------------- 视图切换 ---------------- */
function showView(name) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  window.scrollTo(0, 0);
}

/* ---------------- 投递管理 ---------------- */
/* 投递进度条：6 个阶段 + 各阶段到达时间；点击节点更新（回退需确认，见事件绑定） */
function nowStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function fmtStageTime(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/);
  if (!m) return String(t);
  return m[4] ? (m[2] + '-' + m[3] + ' ' + m[4]) : (m[2] + '-' + m[3]);
}
function statusBarHtml(a) {
  const abandoned = a.status === '已放弃';
  const idx = STATUSES.indexOf(a.status || STATUSES[0]);
  const times = a.statusAt || {};
  const steps = STATUSES.map((s, i) => {
    let cls = 'st-step';
    if (s === '已放弃') {
      if (abandoned) cls += ' active drop';
    } else if (!abandoned && idx >= i) {
      cls += (idx === i ? ' done active' : ' done');
    }
    const t = times[s];
    return '<div class="' + cls + '" data-setstatus="' + esc(a.id) + '" data-status="' + esc(s) + '" title="点击更新进度">' +
      '<span>' + esc(s) + '</span>' +
      (t ? '<em class="st-time">' + esc(fmtStageTime(t)) + '</em>' : '') +
      '</div>';
  }).join('');
  return '<div class="status-bar">' + steps + '</div>';
}

function renderDashboard() {
  const el = $('#appList');
  if (!DB.applications.length) {
    el.innerHTML = '<div class="empty">还没有投递记录。点「+ 新增投递」，记录公司和岗位，并关联简历版本。</div>';
    return;
  }
  el.innerHTML = DB.applications.map(a => {
    const v = DB.variants.find(x => x.id === a.versionId);
    const snap = a.snapshotId ? snapshotById(a.snapshotId) : null;
    return '<div class="app-card" data-id="' + esc(a.id) + '">' +
      '<div class="app-main">' +
      '<div class="app-title">' + esc(a.company || '（未填公司）') + '<span class="pos"> · ' + esc(a.position || '（未填岗位）') + '</span></div>' +
      '<div class="app-meta">简历版本：' + (v ? esc(v.name) : '（未关联）') +
      (snap ? ' ｜ <span class="frozen">🧊 已冻结 ' + esc(fmtDateTime(snap.created)) + '</span>' : (a.snapshotId ? ' ｜ 快照已删除' : '')) +
      ' ｜ 更新：' + esc(a.updated || '') + '</div>' +
      (a.jd ? '<details class="jd"><summary>查看岗位 JD</summary><pre>' + esc(a.jd) + '</pre></details>' : '') +
      (a.notes ? '<div class="app-meta">备注：' + esc(a.notes) + '</div>' : '') +
      '</div>' +
      '<div class="app-side">' +
      (v ? '<button class="btn small" data-openver="' + esc(v.id) + '">打开简历</button>' : '') +
      (snap ? '<button class="btn small" data-opensnap="' + esc(snap.id) + '">查看冻结版</button>' : '') +
      '<button class="btn small" data-editapp="' + esc(a.id) + '">编辑</button>' +
      '<button class="btn small" data-dupapp="' + esc(a.id) + '">复制</button>' +
      '<button class="btn small danger" data-delapp="' + esc(a.id) + '">删除</button>' +
      '</div>' +
      statusBarHtml(a) +
      '</div>';
  }).join('');
}

async function duplicateApplication(id) {
  const a = DB.applications.find(x => x.id === id); if (!a) return;
  const copy = deepClone(a);
  copy.id = uid('app');
  copy.updated = today();
  DB.applications.unshift(copy);
  await saveApps();
  renderDashboard();
  toast('已复制投递记录');
}

function openAppModal(id) {
  const a = id ? DB.applications.find(x => x.id === id) : null;
  const oldSnap = a && a.snapshotId ? snapshotById(a.snapshotId) : null;
  const vopts = DB.variants.map(v =>
    '<option value="' + esc(v.id) + '"' + (a && a.versionId === v.id ? ' selected' : '') + '>' +
    esc(v.name) + '（' + esc(v.company || '') + '）</option>').join('');
  modal(
    '<h3>' + (a ? '编辑投递' : '新增投递') + '</h3>' +
    '<label>公司<input id="mCompany" value="' + esc(a ? a.company : '') + '"></label>' +
    '<label>岗位<input id="mPosition" value="' + esc(a ? a.position : '') + '"></label>' +
    '<label>使用简历版本<select id="mVersion"><option value="">（暂不关联）</option>' + vopts + '</select></label>' +
    '<label>状态<select id="mStatus">' + STATUSES.map(s => '<option' + (a && a.status === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label>' +
    '<label>岗位 JD（可粘贴保存，便于对照定制）<textarea id="mJd" rows="6">' + esc(a ? a.jd : '') + '</textarea></label>' +
    '<label>备注<textarea id="mNotes" rows="2">' + esc(a ? a.notes : '') + '</textarea></label>' +
    (oldSnap ? '<p class="muted" style="margin:2px 0 8px">已关联快照：' + esc(fmtDateTime(oldSnap.created)) + '</p>' : '') +
    '<div class="checkline"><input type="checkbox" id="mSnap"' + (oldSnap ? '' : ' checked') + '>' +
    '<span>' + (oldSnap ? '保存时重新创建快照（更新冻结版）' : '同时创建版本快照（冻结当前素材，推荐）') + '</span></div>' +
    '<p class="muted" style="margin:4px 0 0">快照 = 投递时把该版素材、排版与照片冻结存档，之后改素材块库不影响它。</p>' +
    '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="mOk">保存</button></div>'
  );
  $('#mOk').onclick = async () => {
    const statusVal = $('#mStatus').value;
    const obj = {
      company: $('#mCompany').value.trim(), position: $('#mPosition').value.trim(),
      versionId: $('#mVersion').value, status: statusVal,
      jd: $('#mJd').value, notes: $('#mNotes').value.trim(), updated: today(),
    };
    let target;
    if (a) {
      const prevStatus = a.status;
      Object.assign(a, obj);
      target = a;
      if (prevStatus !== statusVal) {
        target.statusAt = target.statusAt || {};
        target.statusAt[statusVal] = nowStamp();
      }
    } else {
      target = Object.assign({ id: uid('app'), statusAt: {} }, obj);
      target.statusAt[statusVal] = nowStamp();
      DB.applications.unshift(target);
    }
    await saveApps();
    const wantSnap = $('#mSnap') && $('#mSnap').checked;
    if (wantSnap && obj.versionId) {
      try {
        const meta = await api.post('/api/snapshots', { variantId: obj.versionId });
        DB.snapshots = [meta].concat(DB.snapshots || []);
        target.snapshotId = meta.id;
        await saveApps();
        toast('已保存，并冻结当前版本');
      } catch (err) { toast('已保存；快照创建失败：' + err.message); }
    } else {
      toast('已保存');
    }
    closeModal(); renderDashboard();
  };
}

/* ---------------- 简历版本 ---------------- */
function defaultSections() {
  return [
    { id: uid('sec'), title: '教育背景', kind: 'education', items: [] },
    { id: uid('sec'), title: '学位论文', kind: 'theses', items: [] },
    { id: uid('sec'), title: '个人总结', kind: 'paragraph', items: [] },
    { id: uid('sec'), title: '核心技能', kind: 'bullets', items: [] },
    { id: uid('sec'), title: '实习经历', kind: 'internships', items: [] },
    { id: uid('sec'), title: '学习课程', kind: 'courses', items: [] },
    { id: uid('sec'), title: '学术兼职', kind: 'academic_services', items: [] },
    { id: uid('sec'), title: '获奖经历', kind: 'awards', items: [] },
    { id: uid('sec'), title: '科研项目经历', kind: 'projects', items: [] },
    { id: uid('sec'), title: '论文成果', kind: 'publications', items: [] },
    { id: uid('sec'), title: '未发表论文', kind: 'unpublished', items: [] },
    { id: uid('sec'), title: '专利成果', kind: 'patents', items: [] },
  ];
}

function versionCategory(v) {
  return typeof v.category === 'string' ? v.category.trim() : '';
}

function versionCategories() {
  return Array.from(new Set(DB.variants.map(versionCategory).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function updateVersionCategorySuggestions() {
  $('#versionCategorySuggestions').innerHTML = versionCategories()
    .map(c => '<option value="' + esc(c) + '"></option>').join('');
}

function renderVersions() {
  const el = $('#verList');
  const filter = $('#versionCategoryFilter');
  const selected = filter.value || 'all';
  const categories = versionCategories();
  filter.innerHTML = '<option value="all">全部分类</option><option value="uncategorized">未分类</option>' +
    categories.map(c => '<option value="' + esc('category:' + c) + '">' + esc(c) + '</option>').join('');
  filter.value = Array.from(filter.options).some(o => o.value === selected) ? selected : 'all';
  updateVersionCategorySuggestions();
  if (!DB.variants.length) {
    el.innerHTML = '<div class="empty">还没有简历版本。点「+ 新建定制版本」，然后从素材块库挑选素材组装。</div>';
    return;
  }
  const shown = DB.variants.filter(v => filter.value === 'all' ||
    (filter.value === 'uncategorized' ? !versionCategory(v) : 'category:' + versionCategory(v) === filter.value));
  if (!shown.length) {
    el.innerHTML = '<div class="empty">此分类下暂无简历版本。</div>';
    return;
  }
  el.innerHTML = shown.map(v => {
    const snaps = snapshotsOf(v.id);
    return '<div class="ver-card" data-id="' + esc(v.id) + '">' +
      '<div class="ver-name">' + esc(v.name) + '</div>' +
      '<div class="ver-sub">' + esc(v.company || '（未填公司）') + ' · ' + esc(v.position || '（未填岗位）') + '</div>' +
      '<div class="ver-sub">分类：' + esc(versionCategory(v) || '未分类') + '</div>' +
      '<div class="ver-sub">素材 ' + v.sections.reduce((n, s) => n + s.items.length, 0) + ' 块 ｜ 更新：' + esc(v.updated || v.created || '') + '</div>' +
      '<div class="ver-actions">' +
      '<button class="btn small primary" data-openver="' + esc(v.id) + '">打开编辑</button>' +
      '<button class="btn small" data-snapver="' + esc(v.id) + '">📌 快照' + (snaps.length ? ' (' + snaps.length + ')' : '') + '</button>' +
      '<button class="btn small" data-dupver="' + esc(v.id) + '">复制</button>' +
      '<button class="btn small" data-categoryver="' + esc(v.id) + '">设置分类</button>' +
      '<button class="btn small" data-mdver="' + esc(v.id) + '">导出MD</button>' +
      '<button class="btn small" data-pdfver="' + esc(v.id) + '">PDF</button>' +
      '<button class="btn small danger" data-delver="' + esc(v.id) + '">删除</button>' +
      '</div></div>';
  }).join('');
}

function openCreateVersion() {
  updateVersionCategorySuggestions();
  modal(
    '<h3>新建定制版本</h3>' +
    '<label>版本名<input id="nvName" placeholder="如：示例版本"></label>' +
    '<label>公司<input id="nvCompany" placeholder="如：示例科技公司"></label>' +
    '<label>岗位<input id="nvPosition" placeholder="如：软件工程师"></label>' +
    '<label>版本分类<input id="nvCategory" list="versionCategorySuggestions" maxlength="40" placeholder="可输入新分类，留空为未分类"></label>' +
    '<label>求职意向（显示在简历头部；留空则使用岗位名）<input id="nvIntent"></label>' +
    '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="nvOk">创建并打开</button></div>'
  );
  $('#nvOk').onclick = async () => {
    const company = $('#nvCompany').value.trim();
    const position = $('#nvPosition').value.trim();
    const v = {
      id: uid('var'),
      name: $('#nvName').value.trim() || ((company || '新') + '版'),
      company: company, position: position, category: $('#nvCategory').value.trim(),
      intent: $('#nvIntent').value.trim() || position,
      summaryOverride: '', created: today(), updated: today(),
      sections: defaultSections(),
    };
    DB.variants.unshift(v);
    await saveVariants(); closeModal(); renderVersions();
    openEditor(v.id);
  };
}

function openVersionCategory(id) {
  const v = DB.variants.find(x => x.id === id); if (!v) return;
  updateVersionCategorySuggestions();
  modal('<h3>设置版本分类</h3>' +
    '<label>分类<input id="versionCategoryInput" list="versionCategorySuggestions" maxlength="40" value="' + esc(versionCategory(v)) + '" placeholder="输入或选择分类；留空为未分类"></label>' +
    '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="versionCategorySave">保存</button></div>', true);
  $('#versionCategorySave').onclick = async () => {
    const previous = v.category;
    v.category = $('#versionCategoryInput').value.trim();
    try {
      await saveVariants(); closeModal(); renderVersions(); toast('分类已保存');
    } catch (e) {
      if (previous === undefined) delete v.category; else v.category = previous;
      toast('保存分类失败：' + e.message);
    }
  };
}

async function duplicateVersion(id) {
  const v = DB.variants.find(x => x.id === id); if (!v) return;
  const c = deepClone(v); c.id = uid('var'); c.name = v.name + ' 变体'; c.created = today(); c.updated = today();
  DB.variants.unshift(c); await saveVariants(); renderVersions(); toast('已复制为「' + c.name + '」');
}

async function deleteVersion(id) {
  const v = DB.variants.find(x => x.id === id); if (!v) return;
  if (!confirm('删除版本「' + v.name + '」？关联的投递记录将解除关联。')) return;
  DB.variants = DB.variants.filter(x => x.id !== id);
  DB.applications.forEach(a => { if (a.versionId === id) a.versionId = ''; });
  await saveVariants(); await saveApps();
  renderVersions(); renderDashboard();
}

/* ---------------- 素材块库（按分类分组展示） ---------------- */
let collapsedGroups = {};   // 分类折叠状态（会话内有效）

function blockCardHtml(b) {
  const t = TYPES[b.type] || { label: b.type, color: '' };
  const tags = (b.tags || []).map(tg => '#' + esc(tg)).join(' ');
  const foot = (b.group ? '<span class="card-group">' + esc(b.group) + '</span>' : '') +
    (tags ? '<span class="block-tags">' + tags + '</span>' : '');
  return '<div class="block-card ' + (t.color || '') + '" data-id="' + esc(b.id) + '" title="点击编辑素材块">' +
    '<div class="block-card-head">' + badge(b) +
    '<span class="block-actions">' +
    '<button class="btn tiny" data-editblock="' + esc(b.id) + '">编辑</button>' +
    '<button class="btn tiny" data-dupblock="' + esc(b.id) + '">复制</button>' +
    '<button class="btn tiny danger" data-delblock="' + esc(b.id) + '">删除</button>' +
    '</span></div>' +
    '<div class="block-title">' + esc(blockTitle(b)) + '</div>' +
    '<div class="block-sub">' + esc(blockSub(b)) + '</div>' +
    (foot ? '<div class="block-card-foot">' + foot + '</div>' : '') +
    '</div>';
}

function renderBlocks() {
  const tf = $('#blockTypeFilter').value;
  const q = $('#blockSearch').value.trim().toLowerCase();
  let list = DB.blocks.slice();
  if (tf) list = list.filter(b => b.type === tf);
  if (q) list = list.filter(b =>
    String(b.title || '').toLowerCase().includes(q) ||
    (b.tags || []).join(' ').toLowerCase().includes(q) ||
    JSON.stringify(b.content || {}).toLowerCase().includes(q) ||
    String(b.group || '').toLowerCase().includes(q));

  /* 按类型分组（TYPES 声明顺序；未知类型归入「其他」） */
  const order = Object.keys(TYPES);
  const groups = [];
  for (const t of order) {
    const items = list.filter(b => b.type === t);
    if (items.length || (['unpublished_paper', 'internship', 'academic_service', 'award'].includes(t) && (!tf || tf === t) && !q)) groups.push({ type: t, items: items });
  }
  const known = new Set(order);
  const others = list.filter(b => !known.has(b.type));
  if (others.length) groups.push({ type: '', items: others, label: '其他' });

  const el = $('#blockList');
  if (!groups.length) { el.innerHTML = '<div class="empty">没有匹配的素材块。</div>'; return; }

  el.innerHTML = groups.map(g => {
    const t = TYPES[g.type] || { label: g.label || g.type, color: '' };
    /* 搜索/筛选时始终展开，便于直接看到命中结果 */
    const collapsed = !q && !tf && collapsedGroups[g.type] === true;
    const cards = g.items.map(blockCardHtml).join('');
    return '<section class="block-group" data-group="' + esc(g.type) + '">' +
      '<div class="block-group-head">' +
      '<span class="block-badge ' + (t.color || '') + '">' + esc(t.label) + '</span>' +
      '<span class="group-count">' + g.items.length + ' 块</span>' +
      '<span class="group-spacer"></span>' +
      (g.type ? '<button class="btn tiny" data-addblock="' + esc(g.type) + '" title="在该分类下新增素材块">+ 新增</button>' : '') +
      '<button class="btn tiny" data-toggle-group="' + esc(g.type) + '">' + (collapsed ? '展开 ▾' : '收起 ▴') + '</button>' +
      '</div>' +
      (collapsed ? '' : '<div class="block-list">' + (cards || '<div class="sec-empty">暂无' + esc(t.label) + '。点击“+ 新增”添加素材。</div>') + '</div>') +
      '</section>';
  }).join('');
}

let blockModalSeq = 0;  // 素材块弹窗令牌：防止旧防抖回调写入新弹窗

function openBlockModal(id, presetType) {
  const b = id ? DB.blocks.find(x => x.id === id) : null;
  const type = b ? b.type : (presetType && TYPES[presetType] ? presetType : 'project');
  const token = ++blockModalSeq;
  let blockId = b ? b.id : null;   // 新块在首次自动保存时落库
  let blockType = type;
  const m = modal(
    '<h3>' + (b ? '编辑素材块' : '新增素材块') + '</h3>' +
    (b ? '<p class="muted" style="margin:-8px 0 12px">类型：' + (TYPES[type] || {}).label + '（类型不可修改）　·　内容自动保存</p>'
       : '<p class="muted" style="margin:-8px 0 12px">内容自动保存：首次输入后自动创建素材块，无需手动提交</p>' +
         '<label>类型<select id="bmType">' + Object.keys(TYPES).map(k => '<option value="' + k + '"' + (k === type ? ' selected' : '') + '>' + TYPES[k].label + '</option>').join('') + '</select></label>') +
    '<div id="bmFields"></div>' +
    '<label>标签（逗号分隔，用于搜索与筛选）<input id="bmTags" value="' + esc(b ? (b.tags || []).join(', ') : '') + '"></label>' +
    '<div class="modal-actions"><span id="bmSaveState" class="muted" style="margin-right:auto"></span>' +
    '<button class="btn" data-close>关闭</button><button class="btn primary" id="bmOk">完成</button></div>'
  );
  modalCloseHook = () => { if (token === blockModalSeq) autosaveBlock(); };
  m.addEventListener('input', e => { if (e.target.id === 'bmType') return; markDirty(); });
  function renderFields(t, cur) {
    const c = (cur && cur.content) || {};
    let html = '';
    if (t === 'summary') {
      html += '<label>总结内容<textarea id="fText" rows="5">' + esc(c.text || '') + '</textarea></label>';
    } else if (t === 'education') {
      const e = cur ? eduParts(c) : { school: '', college: '', major: '', degreeType: '' };
      let startVal = c.start || '', endVal = c.end || '';
      if (!startVal && !endVal && c.dates) { const p = parseEduDates(c.dates); startVal = p.start; endVal = p.end; }
      html += '<div class="grid2">' +
        '<label>起始时间（年月）<input type="month" id="fStart" value="' + esc(startVal) + '"></label>' +
        '<label>结束时间（年月；留空 = 至今）<input type="month" id="fEnd" value="' + esc(endVal) + '"></label></div>' +
        '<div class="grid2">' +
        '<label>学历/学位（如：博士（硕博连读）、本科）<input id="fDegreeType" value="' + esc(e.degreeType) + '"></label>' +
        '<label>学校（如：示例大学）<input id="fSchool" value="' + esc(e.school) + '"></label></div>' +
        '<div class="grid2">' +
        '<label>学院（可空，如：示例学院）<input id="fCollege" value="' + esc(e.college) + '"></label>' +
        '<label>专业（方向）（如：计算机科学与技术）<input id="fMajor" value="' + esc(e.major) + '"></label></div>' +
        '<label>导师（旧版简写，可空；如需完整信息请使用“研究生导师”素材块）<input id="fAdvisor" value="' + esc(c.advisor || '') + '"></label>';
    } else if (t === 'advisor') {
      html += '<div class="grid2">' +
        '<label>导师姓名<input id="fAdvisorName" value="' + esc(c.name || '') + '" placeholder="如：张三"></label>' +
        '<label>培养关系<input id="fRelationship" value="' + esc(c.relationship || '研究生导师') + '" placeholder="如：博士阶段导师"></label></div>' +
        '<div class="grid2">' +
        '<label>职称<input id="fAcademicTitle" value="' + esc(c.academicTitle || '') + '" placeholder="如：教授 / 研究员"></label>' +
        '<label>职务<input id="fPosition" value="' + esc(c.position || '') + '" placeholder="如：院长 / 实验室主任"></label></div>' +
        '<div class="grid2">' +
        '<label>学校 / 单位<input id="fOrganization" value="' + esc(c.organization || '') + '"></label>' +
        '<label>学院 / 机构<input id="fAdvisorCollege" value="' + esc(c.college || '') + '"></label></div>' +
        '<label>研究方向<textarea id="fResearch" rows="2" placeholder="多个方向可用顿号或分号分隔">' + esc(c.research || '') + '</textarea></label>' +
        '<div class="grid2">' +
        '<label>联系方式（可空）<input id="fContact" value="' + esc(c.contact || '') + '"></label>' +
        '<label>个人主页（可空）<input id="fHomepage" value="' + esc(c.homepage || '') + '"></label></div>' +
        '<label>简介 / 与本人合作情况（可空）<textarea id="fAdvisorBrief" rows="3">' + esc(c.brief || '') + '</textarea></label>';
    } else if (t === 'thesis') {
      const d = cur ? thesisDegree(c) : { type: '', major: '' };
      const e = cur ? eduParts(c) : { school: '', college: '' };
      html += '<label>论文题目<input id="fTitle" value="' + esc(cur ? cur.title : '') + '"></label>' +
        '<div class="grid2">' +
        '<label>学位类型（如：工学博士）<input id="fDegreeType" value="' + esc(d.type) + '"></label>' +
        '<label>专业名称（如：计算机科学与技术）<input id="fMajor" value="' + esc(d.major) + '"></label></div>' +
        '<div class="grid2">' +
        '<label>完成/答辩时间<input id="fDates" value="' + esc(c.dates || '') + '"></label>' +
        '<label>学校（如：示例大学）<input id="fSchool" value="' + esc(e.school) + '"></label></div>' +
        '<div class="grid2">' +
        '<label>学院（可空，如：示例学院）<input id="fCollege" value="' + esc(e.college) + '"></label>' +
        '<label>导师<input id="fAdvisor" value="' + esc(c.advisor || '') + '"></label></div>' +
        '<label>论文简要内容（一两句话概括研究内容，可空）<textarea id="fBrief" rows="3">' + esc(c.brief || c.desc || '') + '</textarea></label>' +
        '<label style="margin-bottom:4px">主要工作（可自定义增删，每项一条）</label>' +
        '<div id="fWorks"></div>' +
        '<button class="btn tiny" id="fWorksAdd" type="button" style="margin:2px 0 12px">+ 添加一项工作</button>';
    } else if (t === 'skill') {
      html += '<label>技能概览（支持「引导词：内容」加粗）<input id="fText" value="' + esc(c.text || '') + '" placeholder="如：编程与工具：Python / PyTorch / SQL"></label>' +
        '<label>子项（每行一条，具体说明掌握的工具、方法、熟练程度或应用场景）<textarea id="fSkillItems" rows="5">' + esc((Array.isArray(c.items) ? c.items : []).join('\n')) + '</textarea></label>';
    } else if (t === 'project') {
      html += '<label>项目名称<input id="fTitle" value="' + esc(cur ? cur.title : '') + '"></label>' +
        '<div class="grid2">' +
        '<label>项目来源（如：国家自然科学基金 / 广州市生态环境局）<input id="fSource" value="' + esc(c.source || '') + '"></label>' +
        '<label>项目类型（如：面上项目 / 政府委托项目 / 横向项目）<input id="fProjType" value="' + esc(c.projType || '') + '"></label></div>' +
        '<label>经费 / 项目编号（可空，如：1090万）<input id="fFunding" value="' + esc(c.funding || '') + '"></label>' +
        '<label>项目工作（可空，一句话概述）<input id="fWork" value="' + esc(c.work || '') + '"></label>' +
        '<label style="margin-bottom:4px">主要工作（可自定义增删，每项一条）</label>' +
        '<div id="fWorks"></div>' +
        '<button class="btn tiny" id="fWorksAdd" type="button" style="margin:2px 0 12px">+ 添加一项工作</button>';
    } else if (t === 'internship') {
      html += '<label>经历标题（可空，默认显示公司与岗位）<input id="fTitle" value="' + esc(cur ? cur.title : '') + '"></label>' +
        '<div class="grid2">' +
        '<label>公司 / 单位<input id="fCompany" value="' + esc(c.company || '') + '"></label>' +
        '<label>实习岗位<input id="fPosition" value="' + esc(c.position || '') + '" placeholder="如：算法实习生"></label></div>' +
        '<div class="grid2">' +
        '<label>部门（可空）<input id="fDepartment" value="' + esc(c.department || '') + '"></label>' +
        '<label>工作地点（可空）<input id="fLocation" value="' + esc(c.location || '') + '"></label></div>' +
        '<div class="grid2">' +
        '<label>起始时间（年月）<input type="month" id="fStart" value="' + esc(c.start || '') + '"></label>' +
        '<label>结束时间（年月；留空 = 至今）<input type="month" id="fEnd" value="' + esc(c.end || '') + '"></label></div>' +
        '<label style="margin-bottom:4px">实习工作与成果（可自定义增删，每项一条）</label>' +
        '<div id="fWorks"></div>' +
        '<button class="btn tiny" id="fWorksAdd" type="button" style="margin:2px 0 12px">+ 添加一项工作 / 成果</button>';
    } else if (t === 'course') {
      html += '<label>课程名称<input id="fTitle" value="' + esc(cur ? cur.title : '') + '" placeholder="如：机器学习 / 最优化方法"></label>' +
        '<div class="grid2">' +
        '<label>开课单位（可空）<input id="fOrganization" value="' + esc(c.organization || '') + '" placeholder="如：示例大学 / 在线课程平台"></label>' +
        '<label>课程类型（可空）<input id="fCourseType" value="' + esc(c.courseType || '') + '" placeholder="如：专业必修 / 专业选修 / 公开课"></label></div>' +
        '<div class="grid2">' +
        '<label>学习时间（可空）<input id="fDates" value="' + esc(c.dates || '') + '" placeholder="如：2024.09 – 2024.12"></label>' +
        '<label>学分 / 学时（可空）<input id="fCredits" value="' + esc(c.credits || '') + '" placeholder="如：3 学分 / 48 学时"></label></div>' +
        '<label>成绩（可空）<input id="fScore" value="' + esc(c.score || '') + '" placeholder="如：92 / 优秀 / Pass"></label>' +
        '<label>课程内容与收获（可空）<textarea id="fDesc" rows="3" placeholder="课程主题、核心内容、项目实践或个人收获">' + esc(c.desc || '') + '</textarea></label>';
    } else if (t === 'academic_service') {
      html += '<label>兼职标题（可空，默认显示机构与职务）<input id="fTitle" value="' + esc(cur ? cur.title : '') + '"></label>' +
        '<div class="grid2">' +
        '<label>机构 / 期刊 / 学术组织<input id="fOrganization" value="' + esc(c.organization || '') + '" placeholder="如：某学术期刊 / 学会"></label>' +
        '<label>职务 / 角色<input id="fPosition" value="' + esc(c.position || '') + '" placeholder="如：审稿人 / 编委 / 委员"></label></div>' +
        '<div class="grid2">' +
        '<label>起始时间（年月，可空）<input type="month" id="fStart" value="' + esc(c.start || '') + '"></label>' +
        '<label>结束时间（年月；留空 = 至今）<input type="month" id="fEnd" value="' + esc(c.end || '') + '"></label></div>' +
        '<label>职责与成果（可空）<textarea id="fDesc" rows="3">' + esc(c.desc || '') + '</textarea></label>';
    } else if (t === 'award') {
      html += '<label>奖项名称<input id="fTitle" value="' + esc(cur ? cur.title : '') + '" placeholder="如：全国大学生数学建模竞赛"></label>' +
        '<div class="grid2">' +
        '<label>获奖级别（可空）<input id="fLevel" value="' + esc(c.level || '') + '" placeholder="如：国家级 / 省部级 / 校级"></label>' +
        '<label>奖项等级（可空）<input id="fRank" value="' + esc(c.rank || '') + '" placeholder="如：一等奖 / 金奖"></label></div>' +
        '<div class="grid2">' +
        '<label>获奖时间（可空）<input id="fDate" value="' + esc(c.date || '') + '" placeholder="如：2025.10"></label>' +
        '<label>颁奖单位（可空）<input id="fOrganization" value="' + esc(c.organization || '') + '"></label></div>' +
        '<label>获奖身份 / 排名（可空）<input id="fRecipient" value="' + esc(c.recipient || '') + '" placeholder="如：个人 / 团队负责人 / 排名 2/5"></label>' +
        '<label>获奖说明 / 个人贡献（可空）<textarea id="fDesc" rows="3">' + esc(c.desc || '') + '</textarea></label>';
    } else if (t === 'paper') {
      html += '<label>论文题目<input id="fTitle" value="' + esc(cur ? cur.title : '') + '"></label>' +
        '<div class="grid2">' +
        '<label>分组（渲染为小标题，如：第一作者）<input id="fGroup" value="' + esc(cur ? cur.group : '第一作者') + '"></label>' +
        '<label>作者位次备注（可空，如：（第二作者））<input id="fNote" value="' + esc(c.note || '') + '"></label></div>' +
        '<div class="grid2">' +
        '<label>期刊名称（可空）<input id="fJournal" value="' + esc(c.journal || '') + '"></label>' +
        '<label>发表时间（可空，如：2024.06）<input id="fDate" value="' + esc(c.date || '') + '"></label></div>' +
        '<div class="grid2">' +
        '<label>分区（可空）<input id="fPartition" value="' + esc(c.partition || '') + '" placeholder="如：中科院 1 区 / JCR Q1"></label>' +
        '<label>影响因子（可空）<input id="fImpactFactor" value="' + esc(c.impactFactor || '') + '" placeholder="如：5.2（2024）"></label></div>' +
        '<label>卷期页码（可空，如：41(6): 1234-1245）<input id="fVolume" value="' + esc(c.volume || '') + '"></label>' +
        '<label>简介<textarea id="fDesc" rows="2">' + esc(c.desc || '') + '</textarea></label>';
    } else if (t === 'unpublished_paper') {
      html += '<label>论文题目<input id="fTitle" value="' + esc(cur ? cur.title : '') + '"></label>' +
        '<div class="grid2">' +
        '<label>作者（可空）<input id="fAuthors" value="' + esc(c.authors || '') + '" placeholder="按稿件顺序填写"></label>' +
        '<label>分组（可空，如：第一作者）<input id="fGroup" value="' + esc(cur ? cur.group : '') + '"></label></div>' +
        '<div class="grid2">' +
        '<label>稿件状态（可空）<input id="fStatus" value="' + esc(c.status || '') + '" placeholder="撰写中 / 已投稿 / 审稿中 / 已接收待发表"></label>' +
        '<label>拟投 / 投稿期刊（可空）<input id="fTargetJournal" value="' + esc(c.targetJournal || '') + '"></label></div>' +
        '<label>作者贡献或备注（可空）<input id="fNote" value="' + esc(c.note || '') + '"></label>' +
        '<label>研究简介（可空）<textarea id="fDesc" rows="2">' + esc(c.desc || '') + '</textarea></label>';
    } else if (t === 'patent') {
      html += '<label>专利名称<input id="fTitle" value="' + esc(cur ? cur.title : '') + '"></label>' +
        '<div class="grid2">' +
        '<label>分组<input id="fGroup" value="' + esc(cur ? cur.group : '第二发明人') + '"></label>' +
        '<label>状态<input id="fStatus" value="' + esc(c.status || '已授权，授权公告号：') + '"></label></div>';
    } else {
      html += '<label>标题<input id="fTitle" value="' + esc(cur ? cur.title : '') + '"></label>' +
        '<label>内容行（每行一条）<textarea id="fRows" rows="4">' + esc((c.lines || []).join('\n')) + '</textarea></label>';
    }
    $('#bmFields').innerHTML = html;
    if (['thesis', 'project', 'internship'].includes(t)) setupWorksEditor(cur);
  }
  /* 主要工作：动态增删（学位论文 / 项目 / 实习共用；项目兼容旧版 bullets 字段） */
  function setupWorksEditor(cur) {
    const wrap = $('#fWorks');
    if (!wrap) return;
    const seed = (cur && cur.content)
      ? (Array.isArray(cur.content.works) ? cur.content.works
        : (Array.isArray(cur.content.bullets) ? cur.content.bullets : []))
      : [];
    function addRow(val) {
      const row = document.createElement('div');
      row.className = 'work-row';
      row.innerHTML = '<textarea class="fWorkItem" rows="2" placeholder="如：构建 XX 模型 / 完成 XX 实验，处理 XX 万条数据"></textarea>' +
        '<button type="button" class="btn tiny danger" data-wdel>删除</button>';
      row.querySelector('textarea').value = val || '';
      row.querySelector('[data-wdel]').onclick = () => { row.remove(); markDirty(); };
      wrap.appendChild(row);
    }
    if (seed.length) seed.forEach(addRow); else addRow('');
    $('#fWorksAdd').onclick = () => { addRow(''); markDirty(); };
  }
  /* ---------------- 自动保存（编辑素材块） ---------------- */
  let saveTimer = null;
  function markDirty() {
    if (token !== blockModalSeq) return;
    const st = $('#bmSaveState');
    if (st) st.textContent = '编辑中…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(autosaveBlock, 900);
  }
  /* 从表单收集一“块”素材（与手动保存同一套逻辑） */
  function collectBlock() {
    const bt = blockId ? ((DB.blocks.find(x => x.id === blockId) || {}).type || blockType) : ($('#bmType') ? $('#bmType').value : blockType);
    blockType = bt;
    const get = sel => { const el = $(sel); return el ? el.value : ''; };
    const content = {};
    const cur = blockId ? DB.blocks.find(x => x.id === blockId) : null;
    let title = cur ? (cur.title || '') : '', group = cur ? (cur.group || '') : '';
    if (bt === 'summary') content.text = get('#fText');
    else if (bt === 'education') { content.start = get('#fStart').trim(); content.end = get('#fEnd').trim(); content.dates = eduDateLine(content); content.school = get('#fSchool').trim(); content.college = get('#fCollege').trim(); content.major = get('#fMajor').trim(); content.degreeType = get('#fDegreeType').trim(); content.advisor = get('#fAdvisor').trim(); }
    else if (bt === 'advisor') { content.name = get('#fAdvisorName').trim(); content.relationship = get('#fRelationship').trim() || '研究生导师'; content.academicTitle = get('#fAcademicTitle').trim(); content.position = get('#fPosition').trim(); content.organization = get('#fOrganization').trim(); content.college = get('#fAdvisorCollege').trim(); content.research = get('#fResearch').trim(); content.contact = get('#fContact').trim(); content.homepage = get('#fHomepage').trim(); content.brief = get('#fAdvisorBrief').trim(); title = [content.relationship, content.name].filter(Boolean).join(' · '); }
    else if (bt === 'thesis') { title = get('#fTitle').trim(); content.degreeType = get('#fDegreeType').trim(); content.major = get('#fMajor').trim(); content.dates = get('#fDates').trim(); content.school = get('#fSchool').trim(); content.college = get('#fCollege').trim(); content.advisor = get('#fAdvisor').trim(); content.brief = get('#fBrief'); content.works = $$('#fWorks textarea').map(el => el.value.trim()).filter(Boolean); }
    else if (bt === 'skill') {
      content.text = get('#fText').trim();
      content.items = get('#fSkillItems').split('\n').map(s => s.trim()).filter(Boolean);
      title = (content.text.split('：')[0] || content.items[0] || '').slice(0, 20);
    }
    else if (bt === 'project') { title = get('#fTitle').trim(); content.source = get('#fSource').trim(); content.projType = get('#fProjType').trim(); content.funding = get('#fFunding').trim(); content.work = get('#fWork').trim(); content.works = $$('#fWorks textarea').map(el => el.value.trim()).filter(Boolean); }
    else if (bt === 'internship') { title = get('#fTitle').trim(); content.company = get('#fCompany').trim(); content.position = get('#fPosition').trim(); content.department = get('#fDepartment').trim(); content.location = get('#fLocation').trim(); content.start = get('#fStart').trim(); content.end = get('#fEnd').trim(); content.works = $$('#fWorks textarea').map(el => el.value.trim()).filter(Boolean); }
    else if (bt === 'course') { title = get('#fTitle').trim(); content.organization = get('#fOrganization').trim(); content.courseType = get('#fCourseType').trim(); content.dates = get('#fDates').trim(); content.credits = get('#fCredits').trim(); content.score = get('#fScore').trim(); content.desc = get('#fDesc').trim(); }
    else if (bt === 'academic_service') { title = get('#fTitle').trim(); content.organization = get('#fOrganization').trim(); content.position = get('#fPosition').trim(); content.start = get('#fStart').trim(); content.end = get('#fEnd').trim(); content.desc = get('#fDesc').trim(); }
    else if (bt === 'award') { title = get('#fTitle').trim(); content.level = get('#fLevel').trim(); content.rank = get('#fRank').trim(); content.date = get('#fDate').trim(); content.organization = get('#fOrganization').trim(); content.recipient = get('#fRecipient').trim(); content.desc = get('#fDesc').trim(); }
    else if (bt === 'paper') { title = get('#fTitle').trim(); group = get('#fGroup').trim(); content.note = get('#fNote').trim(); content.journal = get('#fJournal').trim(); content.partition = get('#fPartition').trim(); content.impactFactor = get('#fImpactFactor').trim(); content.date = get('#fDate').trim(); content.volume = get('#fVolume').trim(); content.desc = get('#fDesc'); }
    else if (bt === 'unpublished_paper') { title = get('#fTitle').trim(); group = get('#fGroup').trim(); content.authors = get('#fAuthors').trim(); content.status = get('#fStatus').trim(); content.targetJournal = get('#fTargetJournal').trim(); content.note = get('#fNote').trim(); content.desc = get('#fDesc'); }
    else if (bt === 'patent') { title = get('#fTitle').trim(); group = get('#fGroup').trim(); content.status = get('#fStatus').trim(); }
    else { title = get('#fTitle').trim(); content.lines = get('#fRows').split('\n').map(s => s.trim()).filter(Boolean); }
    const tags = get('#bmTags').split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const hasContent = !!(title || group || tags.length || Object.keys(content).some(k => {
      const v = content[k];
      return Array.isArray(v) ? v.length > 0 : String(v == null ? '' : v).trim() !== '';
    }));
    return { title: title, group: group, tags: tags, content: content, hasContent: hasContent, type: bt };
  }
  async function autosaveBlock() {
    if (token !== blockModalSeq || !document.getElementById('bmOk')) return;
    const data = collectBlock();
    if (!data) return;
    if (!blockId) {
      if (!data.hasContent) { const st = $('#bmSaveState'); if (st) st.textContent = ''; return; }
      blockId = uid('blk');
      DB.blocks.push({ id: blockId, type: data.type, title: data.title, group: data.group, tags: data.tags, content: data.content, updated: today() });
      /* 新块已创建：锁定类型，切换为“编辑”态 */
      const sel = $('#bmType');
      if (sel) {
        const lab = sel.closest('label');
        if (lab) lab.outerHTML = '<p class="muted" style="margin:-8px 0 12px">类型：' + esc((TYPES[data.type] || {}).label || data.type) + '（类型不可修改）　·　内容自动保存</p>';
      }
      const h3 = $('#modal-root .modal h3');
      if (h3) h3.textContent = '编辑素材块';
    } else {
      const blk = DB.blocks.find(x => x.id === blockId);
      if (!blk) return;
      Object.assign(blk, { title: data.title, group: data.group, tags: data.tags, content: data.content, updated: today() });
    }
    try {
      await saveBlocks();
      if (token !== blockModalSeq) return;
      const st = $('#bmSaveState');
      if (st) st.textContent = '已自动保存 ✓ ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
      renderBlocks();
    } catch (err) {
      const st = $('#bmSaveState');
      if (st) st.textContent = '保存失败：' + (err && err.message ? err.message : err);
    }
  }

  renderFields(type, b);
  if (!b) $('#bmType').onchange = e => renderFields(e.target.value, null);

  $('#bmOk').onclick = async () => {
    await autosaveBlock();
    modalCloseHook = null;
    closeModal();
  };
}

/* ---------------- 批量添加学习课程 ---------------- */
function openBatchCourseModal() {
  if (typeof CourseBatch === 'undefined') { toast('批量课程组件未加载，请重启软件后重试'); return; }
  const example = [
    '机器学习 | 示例大学 | 专业必修 | 2024.09 – 2024.12 | 3 学分 | 92 | 监督学习、无监督学习与模型评估',
    '最优化方法 | 示例大学 | 专业选修 | 2023.02 – 2023.06 | 2 学分 | 优秀 | 凸优化与数值实现',
  ].join('\n');
  modal(
    '<h3>批量添加学习课程</h3>' +
    '<p class="muted" style="margin:-8px 0 10px">每行一门课程，字段用 <b>|</b> 或制表符分隔；只有课程名称必填。<br>' +
    '顺序：课程名称 | 开课单位 | 课程类型 | 学习时间 | 学分/学时 | 成绩 | 课程内容与收获。<br>' +
    '空行和 # 开头的行会忽略，表头行会自动跳过。</p>' +
    '<textarea id="bcText" rows="9" placeholder="机器学习 | 示例大学 | 专业必修 | 2024.09 – 2024.12 | 3 学分 | 92 | 监督学习与模型评估"></textarea>' +
    '<div id="bcPreview" class="muted" style="margin-top:8px"></div>' +
    '<div class="modal-actions"><button class="btn" id="bcExample" type="button" style="margin-right:auto">填入示例</button>' +
    '<button class="btn" data-close>取消</button><button class="btn primary" id="bcOk" disabled>添加课程</button></div>'
  );
  const ta = $('#bcText');
  const ok = $('#bcOk');
  const preview = $('#bcPreview');
  function renderPreview() {
    const rows = CourseBatch.parse(ta.value);
    const max = CourseBatch.MAX_COURSES;
    preview.textContent = rows.length
      ? '将添加 ' + rows.length + ' 门课程：' + rows.slice(0, 5).map(r => r.title).join('、') +
        (rows.length > 5 ? ' 等' : '') + (rows.length >= max ? '（单次最多 ' + max + ' 门）' : '')
      : '尚未识别到课程。每行一门，至少填写课程名称。';
    ok.disabled = !rows.length;
    ok.textContent = rows.length ? '添加 ' + rows.length + ' 门课程' : '添加课程';
  }
  ta.addEventListener('input', renderPreview);
  $('#bcExample').onclick = () => { ta.value = example; ta.focus(); renderPreview(); };
  ok.onclick = async () => {
    const rows = CourseBatch.parse(ta.value);
    if (!rows.length) return;
    const stamp = today();
    const created = rows.map(r => ({
      id: uid('blk'), type: 'course', title: r.title, group: '', tags: [],
      content: {
        organization: r.organization, courseType: r.courseType, dates: r.dates,
        credits: r.credits, score: r.score, desc: r.desc,
      },
      updated: stamp,
    }));
    DB.blocks.push(...created);
    try {
      await saveBlocks();
      closeModal();
      const filter = $('#blockTypeFilter');
      if (filter) filter.value = 'course';
      const search = $('#blockSearch');
      if (search) search.value = '';
      renderBlocks();
      toast('已添加 ' + created.length + ' 门课程');
    } catch (err) {
      DB.blocks = DB.blocks.filter(b => !created.some(c => c.id === b.id));
      toast('批量添加失败：' + (err && err.message ? err.message : err));
    }
  };
  renderPreview();
  ta.focus();
}

async function duplicateBlock(id) {
  const b = DB.blocks.find(x => x.id === id); if (!b) return;
  const copy = deepClone(b);
  copy.id = uid('blk');
  if (b.title && String(b.title).trim()) copy.title = b.title + '（副本）';
  copy.updated = today();
  const i = DB.blocks.findIndex(x => x.id === id);
  DB.blocks.splice(i >= 0 ? i + 1 : DB.blocks.length, 0, copy);
  await saveBlocks();
  renderBlocks();
  toast('已复制素材块');
}

async function deleteBlock(id) {
  const b = DB.blocks.find(x => x.id === id); if (!b) return;
  const used = DB.variants.filter(v => v.sections.some(s => s.items.some(it => it.bid === id)));
  let msg = '删除素材块「' + blockTitle(b) + '」？';
  if (used.length) msg += '\n注意：它有 ' + used.length + ' 个版本仍在使用（' + used.map(v => v.name).join('、') + '），删除后这些版本将不再显示该素材。';
  if (!confirm(msg)) return;
  DB.blocks = DB.blocks.filter(x => x.id !== id);
  await saveBlocks(); renderBlocks();
}

/* ---------------- 个人材料（简历以外的证件/证明） ---------------- */
const MATERIAL_CATEGORIES = ['身份证明', '学历学位', '论文', '专利', '科研业绩', '资格证书', '荣誉奖励', '其他'];
const MATERIAL_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.pdf';
let materialUploadBusy = false;

function materialFileMime(file) {
  if (file.size > 50 * 1024 * 1024) throw new Error('文件过大（单个限 50MB）');
  const byExt = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };
  let mime = String(file.type || '').toLowerCase();
  if (!mime || mime === 'application/octet-stream') mime = byExt[String(file.name || '').split('.').pop().toLowerCase()] || '';
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (!Object.values(byExt).includes(mime)) throw new Error('仅支持 JPG、PNG、WebP、GIF 图片或 PDF');
  return mime;
}

async function uploadMaterialFile(file, metadata) {
  const mime = materialFileMime(file);
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('无法读取文件，请重试'));
    reader.onabort = () => reject(new Error('文件读取已取消'));
    reader.readAsDataURL(new Blob([file], { type: mime }));
  });
  return api.post('/api/materials', {
    dataUrl: dataUrl,
    name: metadata.name || String(file.name || '').replace(/\.[^.]+$/, '') || '未命名材料',
    category: metadata.category || '其他', note: metadata.note || '',
  });
}

function updateMaterialDropHint() {
  const category = $('#materialCategoryFilter').value;
  $('#materialDropCategory').textContent = '新材料归入“' + (category || '其他') + '”，名称自动取自文件名';
}

async function uploadDroppedMaterials(files) {
  const list = Array.from(files || []);
  if (!list.length) return;
  if (materialUploadBusy) { toast('正在上传材料，请完成后再添加文件'); return; }
  materialUploadBusy = true;
  const category = $('#materialCategoryFilter').value || '其他';
  const status = $('#materialUploadStatus');
  status.hidden = false;
  const controls = ['#materialDropZone', '#materialDropFiles', '#materialCategoryFilter', '#addMaterialBtn', '#projectSel', '#projectNew', '#projectManage'].map(sel => $(sel)).filter(Boolean);
  const previousDisabled = controls.map(el => el.disabled);
  controls.forEach(el => { el.disabled = true; });
  const failed = [];
  let uploaded = 0;
  try {
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      status.textContent = '正在上传 ' + (i + 1) + '/' + list.length + '：' + file.name;
      try {
        const entry = await uploadMaterialFile(file, { category: category });
        DB.materials = [entry].concat(DB.materials || []);
        uploaded++;
        renderMaterials();
      } catch (err) { failed.push(file.name + '：' + err.message); }
    }
    if (uploaded) { $('#materialSearch').value = ''; renderMaterials(); }
    const summary = '已新建 ' + uploaded + ' 份材料（' + category + '）' + (failed.length ? '，失败 ' + failed.length + ' 份' : '');
    status.textContent = summary + (failed.length ? '\n' + failed.join('\n') : '。可在材料卡片中编辑名称、类别和备注。');
    toast(summary);
  } finally {
    materialUploadBusy = false;
    controls.forEach((el, i) => { el.disabled = previousDisabled[i]; });
  }
}

function bindMaterialDropEvents() {
  const zone = $('#materialDropZone');
  const input = $('#materialDropFiles');
  let depth = 0;
  const reset = () => { depth = 0; zone.classList.remove('drag-over'); };
  const isFileDrag = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  const isActive = () => $('#view-materials').classList.contains('active');
  zone.onclick = () => input.click();
  input.onchange = () => { const files = Array.from(input.files || []); input.value = ''; uploadDroppedMaterials(files); };
  document.addEventListener('dragenter', e => {
    if (!isActive() || !isFileDrag(e)) return;
    e.preventDefault(); depth++;
    if (!materialUploadBusy) zone.classList.add('drag-over');
  });
  document.addEventListener('dragover', e => {
    if (!isActive() || !isFileDrag(e)) return;
    e.preventDefault(); e.dataTransfer.dropEffect = materialUploadBusy ? 'none' : 'copy';
  });
  document.addEventListener('dragleave', e => {
    if (!depth) return;
    depth = Math.max(0, depth - 1);
    if (!depth) reset();
  });
  document.addEventListener('drop', e => {
    if (!isActive() || !isFileDrag(e)) { reset(); return; }
    e.preventDefault(); reset();
    if ($('#modal-root').children.length) { toast('请先关闭弹窗，再拖入文件'); return; }
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) { toast('请拖入图片或 PDF 文件，不支持文件夹'); return; }
    uploadDroppedMaterials(files);
  });
  window.addEventListener('blur', reset);
  document.addEventListener('dragend', reset);
  updateMaterialDropHint();
}

function fmtSize(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
function isImageMaterial(m) { return String(m.mime || '').indexOf('image/') === 0; }
function materialUrl(m) { return '/assets/materials/' + encodeURIComponent(m.file); }
function materialDownloadName(m) {
  const ext = ((m.file || '').match(/\.[a-z0-9]+$/i) || [''])[0];
  const name = m.name || '未命名材料';
  return ext && !name.toLowerCase().endsWith(ext.toLowerCase()) ? name + ext : name;
}

function renderMaterials() {
  const cf = $('#materialCategoryFilter').value;
  const q = $('#materialSearch').value.trim().toLowerCase();
  let list = (DB.materials || []).slice();
  if (cf) list = list.filter(m => (m.category || '其他') === cf);
  if (q) list = list.filter(m =>
    String(m.name || '').toLowerCase().includes(q) ||
    String(m.note || '').toLowerCase().includes(q) ||
    String(m.category || '').toLowerCase().includes(q));
  const el = $('#materialList');
  if (!list.length) {
    el.innerHTML = '<div class="empty">' + ((DB.materials || []).length
      ? '没有匹配的材料。'
      : '还没有材料。将图片 / PDF 拖入此页直接新建，或点「+ 添加材料」上传。') + '</div>';
    return;
  }
  el.innerHTML = list.map(m =>
    '<div class="material-card" data-id="' + esc(m.id) + '">' +
    '<div class="mat-thumb">' + (isImageMaterial(m)
      ? '<img src="' + materialUrl(m) + '" alt="" loading="lazy">'
      : '<div class="mat-pdf">PDF</div>') + '</div>' +
    '<div class="mat-name" title="' + esc(m.name) + '">' + esc(m.name) + '</div>' +
    '<div class="mat-meta"><span class="mat-cat">' + esc(m.category || '其他') + '</span>' + fmtSize(m.size) + ' ｜ ' + esc(m.created || '') + '</div>' +
    (m.note ? '<div class="mat-note" title="' + esc(m.note) + '">' + esc(m.note) + '</div>' : '') +
    '<div class="mat-actions">' +
    '<button class="btn tiny" data-matopen="' + esc(m.id) + '">打开</button>' +
    '<button class="btn tiny" data-matdl="' + esc(m.id) + '">下载</button>' +
    '<button class="btn tiny" data-matrename="' + esc(m.id) + '">重命名</button>' +
    '<button class="btn tiny" data-matedit="' + esc(m.id) + '">编辑</button>' +
    '<button class="btn tiny danger" data-matdel="' + esc(m.id) + '">删除</button>' +
    '</div></div>').join('');
}

function openMaterialRename(id) {
  const material = (DB.materials || []).find(x => x.id === id);
  if (!material) return;
  const dialog = modal(
    '<h3>重命名材料</h3>' +
    '<label>材料名称（最多 60 字，下载时沿用）<input id="matRenameName" maxlength="60" value="' + esc(material.name) + '"></label>' +
    '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="matRenameSave">保存名称</button></div>', true
  );
  const input = $('#matRenameName', dialog);
  const button = $('#matRenameSave', dialog);
  input.focus(); input.select();
  button.onclick = async () => {
    if (button.disabled) return;
    const name = input.value.trim();
    if (!name) { toast('材料名称不能为空'); input.focus(); return; }
    if (name === material.name) { closeModal(); return; }
    button.disabled = true; input.disabled = true; button.textContent = '保存中…';
    try {
      const updated = await api.put('/api/materials/' + encodeURIComponent(id), { name: name });
      Object.assign(material, updated);
      if (dialog.isConnected) closeModal();
      renderMaterials(); toast('已重命名为：' + updated.name);
    } catch (err) { toast('重命名失败：' + err.message); }
    finally { button.disabled = false; input.disabled = false; button.textContent = '保存名称'; }
  };
  input.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); button.onclick(); } };
}

function openMaterialModal(id) {
  const m = id ? (DB.materials || []).find(x => x.id === id) : null;
  modal(
    '<h3>' + (m ? '编辑材料信息' : '添加材料') + '</h3>' +
    (m ? '<p class="muted" style="margin:-8px 0 12px">文件：' + esc(m.file) + '（' + fmtSize(m.size) + '）</p>'
       : '<label>选择文件（图片或 PDF，≤50MB）<input type="file" id="matFile" accept="' + MATERIAL_FILE_ACCEPT + '"></label>') +
    '<label>名称<input id="matName" value="' + esc(m ? m.name : '') + '" placeholder="如：身份证（正面）"></label>' +
    '<label>类别<select id="matCategory">' + MATERIAL_CATEGORIES.map(c => '<option' + (m && m.category === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>' +
    '<label>备注（可空）<input id="matNote" value="' + esc(m ? (m.note || '') : '') + '" placeholder="如：扫描件 / 正反面 / 有效期…"></label>' +
    '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="matOk">' + (m ? '保存' : '上传') + '</button></div>'
  );
  $('#matOk').onclick = async () => {
    const name = $('#matName').value.trim();
    const category = $('#matCategory').value || '其他';
    const note = $('#matNote').value.trim();
    if (m) {
      try {
        const updated = await api.put('/api/materials/' + encodeURIComponent(m.id), { name: name, category: category, note: note });
        Object.assign(m, updated);
        closeModal(); renderMaterials(); toast('已保存');
      } catch (err) { toast('保存失败：' + err.message); }
      return;
    }
    const f = $('#matFile').files[0];
    if (!f) { toast('请先选择文件'); return; }
    const button = $('#matOk');
    if (button.disabled) return;
    button.disabled = true; button.textContent = '上传中…';
    try {
      const entry = await uploadMaterialFile(f, { name: name, category: category, note: note });
      DB.materials = [entry].concat(DB.materials || []);
      closeModal(); renderMaterials(); toast('已添加材料：' + entry.name);
    } catch (err) { toast('上传失败：' + err.message); }
    finally { button.disabled = false; button.textContent = '上传'; }
  };
}

async function deleteMaterial(id) {
  const m = (DB.materials || []).find(x => x.id === id); if (!m) return;
  if (!confirm('删除材料「' + m.name + '」？文件将一并删除。')) return;
  try {
    const r = await fetch('/api/materials/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    DB.materials = (DB.materials || []).filter(x => x.id !== id);
    renderMaterials();
    toast('已删除');
  } catch (err) { toast('删除失败：' + err.message); }
}

