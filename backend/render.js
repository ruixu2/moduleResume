/* moduleResume · 渲染引擎（领域层）
   输入：profile + blocks + variant  →  输出：简历正文 HTML / 完整页面 / Markdown
*/
'use strict';

const themes = require('./themes');

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function splitLead(text) {
  const s = String(text || '');
  for (const colon of ['：', ':']) {
    const pos = s.indexOf(colon);
    if (pos > 0 && pos <= 12 && pos < s.length - 1) {
      return { lead: s.slice(0, pos), colon, rest: s.slice(pos + 1) };
    }
  }
  return null;
}

function bulletLi(text, subitems) {
  const m = splitLead(text);
  const head = m ? `<b>${esc(m.lead)}</b>${m.colon}${esc(m.rest)}` : esc(text);
  const subs = Array.isArray(subitems) ? subitems.map(s => String(s == null ? '' : s).trim()).filter(Boolean) : [];
  const nested = subs.length ? '<ul class="skill-subitems">' + subs.map(s => bulletLi(s)).join('') + '</ul>' : '';
  return `<li>${head}${nested}</li>`;
}

function bulletMd(text, subitems) {
  const m = splitLead(text);
  const head = m ? `- **${m.lead}**${m.colon}${m.rest}` : `- ${text}`;
  const subs = Array.isArray(subitems) ? subitems.map(s => String(s == null ? '' : s).trim()).filter(Boolean) : [];
  if (!subs.length) return head;
  return [head].concat(subs.map(s => '  ' + bulletMd(s))).join('\n');
}

/* 学位论文：学位类型 / 专业名称（兼容旧版合并字段 degree） */
function thesisParts(c) {
  c = c || {};
  let type = c.degreeType || '';
  let major = c.major || '';
  if (!type && !major && c.degree) {
    const raw = String(c.degree);
    const i = raw.indexOf('·');
    if (i > 0) { type = raw.slice(0, i).trim(); major = raw.slice(i + 1).trim(); }
    else type = raw.trim();
  }
  return { type, major };
}

/* 学校 / 学院拆分（兼容旧版用「·」合并的 school 字段） */
function splitSchoolCollege(c) {
  c = c || {};
  let school = c.school || '';
  let college = c.college || '';
  if (!college && school.indexOf('·') > 0) {
    const i = school.indexOf('·');
    college = school.slice(i + 1).trim();
    school = school.slice(0, i).trim();
  }
  return { school: school, college: college };
}

/* 教育经历时间：优先 start/end（年月），兼容旧版 dates 文本 */
function eduDateLine(c) {
  c = c || {};
  const fmt = ym => (ym ? String(ym).replace(/-/g, '.') : '');
  const s = fmt(c.start), e = fmt(c.end);
  if (s || e) return [s, e || '至今'].filter(Boolean).join(' – ');
  return c.dates || '';
}

/* 教育经历：学校 / 学院 / 专业 / 学历学位（兼容旧版合并字段 school、degree） */
function eduParts(c) {
  c = c || {};
  const sc = splitSchoolCollege(c);
  let school = sc.school;
  let college = sc.college;
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

/* 研究生导师：独立素材块，可作为板块展示，也可绑定到某条教育经历中 */
function advisorParts(c) {
  c = c || {};
  return {
    name: c.name || '',
    relationship: c.relationship || '研究生导师',
    academicTitle: c.academicTitle || '',
    position: c.position || '',
    organization: c.organization || '',
    college: c.college || '',
    research: c.research || '',
    contact: c.contact || '',
    homepage: c.homepage || '',
    brief: c.brief || '',
  };
}

function advisorOrg(a) {
  return [a.organization, a.college].filter(Boolean).join(' · ');
}

function renderAdvisorHtml(block, embedded) {
  const a = advisorParts(block.content);
  const name = a.name || block.title || '（未填写姓名）';
  const identity = [a.academicTitle, a.position].filter(Boolean).join(' · ');
  const org = advisorOrg(a);
  const details = [];
  if (org) details.push(org);
  if (a.research) details.push('研究方向：' + a.research);
  if (a.contact) details.push('联系方式：' + a.contact);
  if (a.homepage) details.push('个人主页：' + a.homepage);
  if (embedded) {
    return `<div class="edu-advisor-card"><div><span class="advisor-relation">${esc(a.relationship)}：</span><b>${esc(name)}</b>${identity ? `<span class="advisor-identity">　${esc(identity)}</span>` : ''}</div>${details.length ? `<div class="advisor-meta">${details.map(esc).join('　|　')}</div>` : ''}${a.brief ? `<div class="advisor-brief">${esc(a.brief)}</div>` : ''}</div>`;
  }
  return `<div class="advisor-card"><h3>${esc(name)}${identity ? `　<span class="advisor-identity">${esc(identity)}</span>` : ''}</h3><p class="advisor-relation">${esc(a.relationship)}</p>${details.length ? `<p class="advisor-meta">${details.map(esc).join('　|　')}</p>` : ''}${a.brief ? `<p class="advisor-brief">${esc(a.brief)}</p>` : ''}</div>`;
}

function advisorMarkdown(block, embedded) {
  const a = advisorParts(block.content);
  const name = a.name || block.title || '（未填写姓名）';
  const identity = [a.academicTitle, a.position].filter(Boolean).join(' · ');
  const org = advisorOrg(a);
  const lead = `${embedded ? '  - ' : '- '}**${a.relationship}：${name}**${identity ? '　' + identity : ''}`;
  const details = [];
  if (org) details.push(org);
  if (a.research) details.push('研究方向：' + a.research);
  if (a.contact) details.push('联系方式：' + a.contact);
  if (a.homepage) details.push('个人主页：' + a.homepage);
  return [lead, details.length ? (embedded ? '    ' : '  ') + details.join(' ｜ ') : '', a.brief ? (embedded ? '    ' : '  ') + a.brief : ''].filter(Boolean);
}

function applyOverride(block, ov) {
  if (!ov || !Object.keys(ov).length) return block;
  const content = Object.assign({}, block.content || {});
  const merged = {
    id: block.id,
    type: block.type,
    title: (ov.title !== undefined && ov.title !== '') ? ov.title : (block.title || ''),
    group: (ov.group !== undefined && ov.group !== '') ? ov.group : (block.group || ''),
    tags: block.tags || [],
    content,
  };
  for (const key of ['text', 'work', 'desc']) {
    if (ov[key]) content[key] = ov[key];
  }
  if (ov.bullets && typeof ov.bullets === 'object') {
    const bullets = (content.bullets || []).slice();
    for (const [idx, val] of Object.entries(ov.bullets)) {
      const i = parseInt(idx, 10);
      if (i >= 0 && i < bullets.length) bullets[i] = val;
    }
    content.bullets = bullets;
  }
  /* 覆盖格式二：ov.content = { 字段: 值 }，支持任意内容字段（含数组，可增删要点） */
  if (ov.content && typeof ov.content === 'object' && !Array.isArray(ov.content)) {
    for (const [key, val] of Object.entries(ov.content)) {
      if (val === undefined || val === null) continue;
      content[key] = val;
    }
  }
  if (content.text !== (block.content || {}).text) merged._ovText = true;
  return merged;
}

function sectionItems(section, blocksMap) {
  const items = [];
  for (const it of section.items || []) {
    const block = blocksMap[it.bid];
    if (block) {
      let merged = Object.assign({}, applyOverride(block, it.ov || {}));
      merged._showPartition = !it.ov || it.ov.showPartition !== false;
      merged._showImpactFactor = !it.ov || it.ov.showImpactFactor !== false;
      if (block.type === 'education' && Array.isArray(it.advisorIds) && it.advisorIds.length) {
        const advisors = it.advisorIds.map(id => blocksMap[id]).filter(b => b && b.type === 'advisor');
        if (advisors.length) merged = Object.assign({}, merged, { _advisors: advisors });
      }
      items.push(merged);
    }
  }
  return items;
}

function isEnglish(variant) { return variant && variant.locale === 'en'; }
function label(variant, zh, en) { return isEnglish(variant) ? en : zh; }
function paperMetrics(c, variant, opts) {
  const showPartition = !opts || opts.showPartition !== false;
  const showImpactFactor = !opts || opts.showImpactFactor !== false;
  const parts = [
    showPartition ? c.partition : '',
    showImpactFactor && c.impactFactor ? 'IF: ' + c.impactFactor : '',
  ].filter(Boolean);
  return parts.length ? label(variant, '（', '(') + parts.join(label(variant, '，', ', ')) + label(variant, '）', ')') : '';
}
function paperDetail(c, variant, opts) {
  const separator = label(variant, '。', '. ');
  const cite = [c.journal, c.date, c.volume].filter(Boolean).join(', ');
  let detail = [cite, c.note, c.desc].filter(Boolean).join(separator);
  const metrics = paperMetrics(c, variant, opts);
  if (metrics) detail += (detail ? (/[.!?。！？]$/.test(detail) ? label(variant, '', ' ') : separator) : '') + metrics;
  return detail;
}

function conferenceDetail(c, variant, opts) {
  const separator = label(variant, '。', '. ');
  const cite = [c.journal, c.date, c.volume].filter(Boolean).join(', ');
  const showLevel = !opts || opts.showPartition !== false;
  const level = showLevel && c.partition ? label(variant, '会议级别：', 'Level: ') + c.partition : '';
  return [cite, c.note, level, c.desc].filter(Boolean).join(separator);
}
function awardParts(b, variant) {
  const c = b.content || {};
  return {
    title: b.title || label(variant, '获奖经历', 'Award'),
    meta: [c.level, c.rank, c.date, c.organization, c.recipient].filter(Boolean).join(' ｜ '),
    desc: c.desc || '',
  };
}

function courseParts(b, variant) {
  const c = b.content || {};
  return {
    title: b.title || label(variant, '学习课程', 'Course'),
    meta: [
      c.organization ? label(variant, '开课单位：', 'Institution: ') + c.organization : '',
      c.courseType,
      c.dates,
      c.credits ? label(variant, '学分/学时：', 'Credits: ') + c.credits : '',
      c.score ? label(variant, '成绩：', 'Grade: ') + c.score : '',
    ].filter(Boolean).join(' ｜ '),
    desc: c.desc || '',
  };
}
function internshipParts(b, variant) {
  const c = b.content || {};
  const identity = [c.company, c.position].filter(Boolean).join(' · ');
  const dates = (c.start || c.end)
    ? [c.start, c.end || label(variant, '至今', 'Present')].filter(Boolean).map(s => String(s).replace(/-/g, '.')).join(' – ')
    : '';
  return {
    title: b.title || identity || label(variant, '实习经历', 'Internship'),
    meta: [b.title ? identity : '', c.department, c.location, dates].filter(Boolean).join(' ｜ '),
    works: Array.isArray(c.works) ? c.works : [],
  };
}
function academicServiceParts(b, variant) {
  const c = b.content || {};
  const identity = [c.organization, c.position].filter(Boolean).join(' · ');
  const dates = c.start
    ? [c.start, c.end || label(variant, '至今', 'Present')].map(s => String(s).replace(/-/g, '.')).join(' – ')
    : String(c.end || '').replace(/-/g, '.');
  return {
    title: b.title || identity || label(variant, '学术兼职', 'Academic service'),
    meta: [b.title ? identity : '', dates].filter(Boolean).join(' ｜ '),
    desc: c.desc || '',
  };
}
function variantProfile(profile, variant) {
  return Object.assign({}, profile || {}, (variant && variant.profileOverride) || {});
}

function renderHeader(profile, variant, photoSrc) {
  const photo = photoSrc && !variant.hidePhoto ? `<img class="photo" alt="${label(variant, '照片', 'Photo')}" src="${esc(photoSrc)}">` : '';
  const p = profile || {};
  const line1 = [];
  if (p.birth) line1.push(label(variant, '出生年月：', 'Born: ') + p.birth);
  if (p.hometown) line1.push(label(variant, '籍贯：', 'Hometown: ') + p.hometown);
  if (p.political) line1.push(label(variant, '政治面貌：', 'Political affiliation: ') + p.political);
  if (p.ethnicity) line1.push(label(variant, '民族：', 'Ethnicity: ') + p.ethnicity);
  const line2 = [];
  if (p.location) line2.push(label(variant, '现居地：', 'Location: ') + p.location);
  if (p.phone) line2.push(label(variant, '联系电话：', 'Phone: ') + p.phone);
  if (p.email) line2.push(label(variant, '电子邮箱：', 'Email: ') + p.email);
  const line3 = [];
  if (p.wechat) line3.push(label(variant, '微信：', 'WeChat: ') + p.wechat);
  if (p.website) line3.push(label(variant, '个人主页：', 'Website: ') + p.website);
  const gender = p.gender ? `<span class="gender">${esc(p.gender)}</span>` : '';
  const meta = [line1, line2, line3].filter(l => l.length)
    .map(l => `<p class="meta">${esc(l.join('　|　'))}</p>`).join('\n    ');
  return `<header class="r-head">
  <div class="r-head-left">
    <h1>${esc(p.name)}${gender}</h1>
    <p class="intent">${label(variant, '求职意向：', 'Position: ')}${esc(variant.intent)}</p>
    ${meta}
  </div>
  ${photo}
</header>`;
}

function renderSectionHtml(section, items, variant) {
  const kind = section.kind || 'bullets';
  const title = section.title || '';
  if (!items.length) return '';
  const out = [];
  if (title && kind !== 'paragraph') out.push(`<h2>${esc(title)}</h2>`);

  if (kind === 'paragraph') {
    if (title) out.unshift(`<h2>${esc(title)}</h2>`);
    for (const b of items) {
      let t = b.content.text || '';
      if (b.type === 'summary' && variant.summaryOverride && !b._ovText) t = variant.summaryOverride;
      if (t) out.push(`<p>${esc(t)}</p>`);
    }
  } else if (kind === 'education') {
    out.push('<ul class="edu">');
    for (const b of items) {
      const c = b.content;
      const e = eduParts(c);
      const schoolLine = [e.school, e.college].filter(Boolean).join(' · ');
      const embedded = Array.isArray(b._advisors) ? b._advisors : [];
      const legacyAdvisor = !embedded.length && c.advisor ? `<div class="edu-advisor">${label(variant, '导师：', 'Advisor: ')}${esc(c.advisor)}</div>` : '';
      const advisorCards = embedded.map(a => renderAdvisorHtml(a, true)).join('');
      out.push(`<li><div class="edu-row"><b class="dates">${esc(eduDateLine(c))}</b><b class="school">${esc(schoolLine)}</b><span class="major">${esc(e.major)}</span><span class="deg">${esc(e.degreeType)}</span></div>${legacyAdvisor}${advisorCards}</li>`);
    }
    out.push('</ul>');
  } else if (kind === 'advisors') {
    for (const b of items) out.push(renderAdvisorHtml(b, false));
  } else if (kind === 'theses') {
    for (const b of items) {
      const c = b.content;
      const d = thesisParts(c);
      const sc = splitSchoolCollege(c);
      out.push(`<h3>${esc(b.title)}</h3>`);
      const metas = [];
      const dm = [d.type, d.major].filter(Boolean).join(' · ');
      if (dm) metas.push(esc(dm));
      const schoolLine = [sc.school, sc.college].filter(Boolean).join(' · ');
      if (schoolLine) metas.push(esc(schoolLine));
      if (c.dates) metas.push(esc(c.dates));
      if (c.advisor) metas.push(label(variant, '导师：', 'Advisor: ') + esc(c.advisor));
      if (metas.length) out.push(`<p class="work">${metas.join('　|　')}</p>`);
      const brief = c.brief || c.desc;
      if (brief) out.push(`<p>${esc(brief)}</p>`);
      if (Array.isArray(c.works) && c.works.length) {
        out.push(`<p class="label">${label(variant, '主要工作', 'Research contributions')}</p>`);
        out.push('<ul class="bullets">');
        for (const w of c.works) out.push(bulletLi(w));
        out.push('</ul>');
      }
    }
  } else if (kind === 'bullets') {
    out.push('<ul class="bullets">');
    for (const b of items) {
      const subItems = b.type === 'skill' ? (b.content && b.content.items) : null;
      out.push(bulletLi(b.content.text || '', subItems));
    }
    out.push('</ul>');
  } else if (kind === 'projects') {
    for (const b of items) {
      const c = b.content;
      out.push(`<h3>${esc(b.title)}</h3>`);
      const metas = [];
      if (c.source) metas.push(label(variant, '项目来源：', 'Funder: ') + esc(c.source));
      if (c.projType) metas.push(label(variant, '项目类型：', 'Type: ') + esc(c.projType));
      if (c.funding) metas.push(label(variant, '经费/编号：', 'Funding/ID: ') + esc(c.funding));
      if (metas.length) out.push(`<p class="proj-meta">${metas.join('　|　')}</p>`);
      if (c.work) out.push(`<p class="work"><b>${label(variant, '项目工作', 'Role')}</b>${label(variant, '：', ': ')}${esc(c.work)}</p>`);
      const works = Array.isArray(c.works) ? c.works : (Array.isArray(c.bullets) ? c.bullets : []);
      out.push('<ul class="bullets">');
      for (const line of works) out.push(bulletLi(line));
      out.push('</ul>');
    }
  } else if (kind === 'academic_services') {
    for (const b of items) {
      const entry = academicServiceParts(b, variant);
      out.push(`<h3>${esc(entry.title)}</h3>`);
      if (entry.meta) out.push(`<p class="proj-meta">${esc(entry.meta)}</p>`);
      if (entry.desc) out.push(`<p>${esc(entry.desc)}</p>`);
    }
  } else if (kind === 'awards') {
    for (const b of items) {
      const entry = awardParts(b, variant);
      out.push(`<h3>${esc(entry.title)}</h3>`);
      if (entry.meta) out.push(`<p class="proj-meta">${esc(entry.meta)}</p>`);
      if (entry.desc) out.push(`<p>${esc(entry.desc)}</p>`);
    }
  } else if (kind === 'courses') {
    out.push('<ul class="bullets courses">');
    for (const b of items) {
      const entry = courseParts(b, variant);
      out.push(`<li><b>${esc(entry.title)}</b>${entry.meta ? '　' + esc(entry.meta) : ''}</li>`);
    }
    out.push('</ul>');
  } else if (kind === 'internships') {
    for (const b of items) {
      const entry = internshipParts(b, variant);
      out.push(`<h3>${esc(entry.title)}</h3>`);
      if (entry.meta) out.push(`<p class="proj-meta">${esc(entry.meta)}</p>`);
      if (entry.works.length) out.push('<ul class="bullets">' + entry.works.map(bulletLi).join('') + '</ul>');
    }
  } else if (kind === 'unpublished') {
    let counter = 0, currentGroup = null, openList = false;
    for (const b of items) {
      const group = b.group || '';
      if (group !== currentGroup) {
        if (openList) out.push('</ol>');
        if (group) out.push(`<p class="label">${esc(group)}</p>`);
        out.push(`<ol class="papers" start="${counter + 1}">`);
        openList = true;
        currentGroup = group;
      }
      counter += 1;
      const c = b.content || {};
      const details = [];
      if (c.authors) details.push(esc(c.authors));
      details.push(label(variant, '稿件状态：', 'Status: ') + esc(c.status || label(variant, '未发表', 'Unpublished')));
      if (c.targetJournal) details.push(label(variant, '拟投/投稿期刊：', 'Target/submitted journal: ') + esc(c.targetJournal));
      if (c.note) details.push(esc(c.note));
      if (c.desc) details.push(esc(c.desc));
      const ending = /[.!?。！？]$/.test(details[details.length - 1]) ? '' : (isEnglish(variant) ? '.' : '。');
      out.push(`<li><b>${esc(b.title)}</b>${isEnglish(variant) ? '. ' : '。'}${details.join(isEnglish(variant) ? '; ' : '；')}${ending}</li>`);
    }
    if (openList) out.push('</ol>');
  } else if (kind === 'publications' || kind === 'conferences' || kind === 'patents') {
    let counter = 0, currentGroup = null, openList = false;
    const isPatents = kind === 'patents';
    const isConferences = kind === 'conferences';
    const defaultGroup = isPatents
      ? label(variant, '专利', 'Patents')
      : isConferences ? label(variant, '会议论文', 'Conference papers') : label(variant, '期刊论文', 'Research papers');
    for (const b of items) {
      const group = b.group || defaultGroup;
      if (group !== currentGroup) {
        if (openList) out.push('</ol>');
        out.push(`<p class="label">${esc(group)}</p>`);
        out.push(`<ol class="papers" start="${counter + 1}">`);
        openList = true;
        currentGroup = group;
      }
      counter += 1;
      const c = b.content;
      if (isPatents) {
        out.push(`<li><b>${esc(b.title)}</b>${isEnglish(variant) ? ', ' : '，'}${esc(c.status || '')}${isEnglish(variant) ? '.' : '。'}</li>`);
      } else {
        const flags = { showPartition: b._showPartition, showImpactFactor: b._showImpactFactor };
        const detail = isConferences ? conferenceDetail(c, variant, flags) : paperDetail(c, variant, flags);
        const ending = /[.!?。！？]$/.test(detail) ? '' : (isEnglish(variant) ? '.' : '。');
        out.push(`<li><b>${esc(b.title)}</b>${detail ? (isEnglish(variant) ? '. ' : '。') + esc(detail) : ''}${ending}</li>`);
      }
    }
    if (openList) out.push('</ol>');
  } else if (kind === 'custom') {
    out.push('<ul class="bullets">');
    for (const b of items) for (const line of b.content.lines || []) out.push(bulletLi(line));
    out.push('</ul>');
  }
  return out.join('\n');
}

function renderVariantHtml(profile, blocks, variant, photoSrc) {
  const blocksMap = {};
  for (const b of blocks || []) blocksMap[b.id] = b;
  const parts = [renderHeader(variantProfile(profile, variant), variant || {}, photoSrc)];
  for (const section of (variant || {}).sections || []) {
    const items = sectionItems(section, blocksMap);
    const html = renderSectionHtml(section, items, variant);
    if (html) parts.push(variant.pageBreakBeforeSection === section.id ? `<div class="section-page-break">${html}</div>` : html);
  }
  return parts.join('\n');
}

function renderPage(profile, blocks, variant, photoSrc, opts) {
  opts = opts || {};
  const body = renderVariantHtml(profile, blocks, variant, photoSrc);
  const title = esc(variant.name || '简历');
  const autoPrint = opts.printMode
    ? "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},450);});</script>"
    : '';
  const zoomCss = (opts.zoom && opts.zoom !== 1) ? `<style>body{zoom:${opts.zoom};}</style>` : '';
  const themeId = opts.themeId || (variant && variant.themeId) || themes.DEFAULT_THEME;
  const css = themes.themeCss(themeId, variant && variant.style);
  return `<!DOCTYPE html>
<html lang="${isEnglish(variant) ? 'en' : 'zh-CN'}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${css}</style>
${zoomCss}
</head>
<body>
<article class="resume">
${body}
</article>
${autoPrint}
</body>
</html>`;
}

function renderMarkdown(profile, blocks, variant) {
  profile = variantProfile(profile, variant);
  const blocksMap = {};
  for (const b of blocks || []) blocksMap[b.id] = b;
  const lines = [];
  lines.push(`# ${profile.name || ''}${profile.gender ? '　' + profile.gender : ''}`);
  lines.push(`**${label(variant, '求职意向：', 'Position: ')}${variant.intent || ''}**`);
  const m1 = [];
  if (profile.birth) m1.push(label(variant, '出生年月：', 'Born: ') + profile.birth);
  if (profile.hometown) m1.push(label(variant, '籍贯：', 'Hometown: ') + profile.hometown);
  if (profile.political) m1.push(label(variant, '政治面貌：', 'Political affiliation: ') + profile.political);
  if (profile.ethnicity) m1.push(label(variant, '民族：', 'Ethnicity: ') + profile.ethnicity);
  const m2 = [];
  if (profile.location) m2.push(label(variant, '现居地：', 'Location: ') + profile.location);
  if (profile.phone) m2.push(label(variant, '联系电话：', 'Phone: ') + profile.phone);
  if (profile.email) m2.push(label(variant, '电子邮箱：', 'Email: ') + profile.email);
  const m3 = [];
  if (profile.wechat) m3.push(label(variant, '微信：', 'WeChat: ') + profile.wechat);
  if (profile.website) m3.push(label(variant, '个人主页：', 'Website: ') + profile.website);
  const metas = [m1, m2, m3].filter(l => l.length).map(l => l.join('　|　'));
  if (metas.length) lines.push(metas.join('\n'));
  lines.push('---');

  for (const section of variant.sections || []) {
    const items = sectionItems(section, blocksMap);
    if (!items.length) continue;
    const kind = section.kind || 'bullets';
    const title = section.title || '';
    const block = [];
    if (title) block.push(`## ${title}`);

    if (kind === 'paragraph') {
      for (const b of items) {
        let t = b.content.text || '';
        if (b.type === 'summary' && variant.summaryOverride && !b._ovText) t = variant.summaryOverride;
        if (t) block.push(t);
      }
    } else if (kind === 'education') {
      for (const b of items) {
        const c = b.content;
        const e = eduParts(c);
        const schoolLine = [e.school, e.college].filter(Boolean).join(' · ');
        const embedded = Array.isArray(b._advisors) ? b._advisors : [];
        block.push(`- **${eduDateLine(c)}**　${schoolLine}${e.major ? '　' + e.major : ''}${!embedded.length && c.advisor ? '　' + label(variant, '导师：', 'Advisor: ') + c.advisor : ''}${e.degreeType ? '　' + e.degreeType : ''}`);
        for (const a of embedded) block.push(...advisorMarkdown(a, true));
      }
    } else if (kind === 'advisors') {
      for (const b of items) block.push(...advisorMarkdown(b, false));
    } else if (kind === 'theses') {
      for (const b of items) {
        const c = b.content;
        const d = thesisParts(c);
        const sc = splitSchoolCollege(c);
        block.push(`### ${b.title || ''}`);
        const metas = [];
        const dm = [d.type, d.major].filter(Boolean).join(' · ');
        if (dm) metas.push(dm);
        const schoolLine = [sc.school, sc.college].filter(Boolean).join(' · ');
        if (schoolLine) metas.push(schoolLine);
        if (c.dates) metas.push(c.dates);
        if (c.advisor) metas.push(label(variant, '导师：', 'Advisor: ') + c.advisor);
        if (metas.length) block.push(metas.join(' ｜ '));
        const brief = c.brief || c.desc;
        if (brief) block.push(brief);
        if (Array.isArray(c.works) && c.works.length) {
          block.push(`**${label(variant, '主要工作', 'Research contributions')}**`);
          for (const w of c.works) block.push(bulletMd(w));
        }
      }
    } else if (kind === 'bullets') {
      for (const b of items) {
        const subItems = b.type === 'skill' ? (b.content && b.content.items) : null;
        block.push(bulletMd(b.content.text || '', subItems));
      }
    } else if (kind === 'projects') {
      for (const b of items) {
        const c = b.content;
        block.push(`### ${b.title || ''}`);
        const metas = [];
        if (c.source) metas.push(label(variant, '项目来源：', 'Funder: ') + c.source);
        if (c.projType) metas.push(label(variant, '项目类型：', 'Type: ') + c.projType);
        if (c.funding) metas.push(label(variant, '经费/编号：', 'Funding/ID: ') + c.funding);
        if (metas.length) block.push(metas.join(' ｜ '));
        if (c.work) block.push(`**${label(variant, '项目工作', 'Role')}**${label(variant, '：', ': ')}${c.work}`);
        const works = Array.isArray(c.works) ? c.works : (Array.isArray(c.bullets) ? c.bullets : []);
        for (const line of works) block.push(bulletMd(line));
      }
    } else if (kind === 'academic_services') {
      for (const b of items) {
        const entry = academicServiceParts(b, variant);
        block.push(`### ${entry.title}`);
        if (entry.meta) block.push(entry.meta);
        if (entry.desc) block.push(entry.desc);
      }
    } else if (kind === 'awards') {
      for (const b of items) {
        const entry = awardParts(b, variant);
        block.push(`### ${entry.title}`);
        if (entry.meta) block.push(entry.meta);
        if (entry.desc) block.push(entry.desc);
      }
    } else if (kind === 'courses') {
      for (const b of items) {
        const entry = courseParts(b, variant);
        block.push(`- **${entry.title}**${entry.meta ? '　' + entry.meta : ''}`);
      }
    } else if (kind === 'internships') {
      for (const b of items) {
        const entry = internshipParts(b, variant);
        block.push(`### ${entry.title}`);
        if (entry.meta) block.push(entry.meta);
        for (const work of entry.works) block.push(bulletMd(work));
      }
    } else if (kind === 'unpublished') {
      let counter = 0, currentGroup = null;
      for (const b of items) {
        const group = b.group || '';
        if (group !== currentGroup) {
          if (group) block.push(`**${group}**`);
          currentGroup = group;
        }
        counter += 1;
        const c = b.content || {};
        const details = [];
        if (c.authors) details.push(c.authors);
        details.push(label(variant, '稿件状态：', 'Status: ') + (c.status || label(variant, '未发表', 'Unpublished')));
        if (c.targetJournal) details.push(label(variant, '拟投/投稿期刊：', 'Target/submitted journal: ') + c.targetJournal);
        if (c.note) details.push(c.note);
        if (c.desc) details.push(c.desc);
        const ending = /[.!?。！？]$/.test(details[details.length - 1]) ? '' : (isEnglish(variant) ? '.' : '。');
        block.push(`${counter}. **${b.title || ''}**${isEnglish(variant) ? '. ' : '。'}${details.join(isEnglish(variant) ? '; ' : '；')}${ending}`);
      }
    } else if (kind === 'publications' || kind === 'conferences' || kind === 'patents') {
      let counter = 0, currentGroup = null;
      const isPatents = kind === 'patents';
      const isConferences = kind === 'conferences';
      const defaultGroup = isPatents
        ? label(variant, '专利', 'Patents')
        : isConferences ? label(variant, '会议论文', 'Conference papers') : label(variant, '期刊论文', 'Research papers');
      for (const b of items) {
        const group = b.group || defaultGroup;
        if (group !== currentGroup) {
          block.push(`**${group}**`);
          currentGroup = group;
        }
        counter += 1;
        const c = b.content;
        if (isPatents) {
          block.push(`${counter}. **${b.title || ''}**${isEnglish(variant) ? ', ' : '，'}${c.status || ''}${isEnglish(variant) ? '.' : '。'}`);
        } else {
          const flags = { showPartition: b._showPartition, showImpactFactor: b._showImpactFactor };
          const detail = isConferences ? conferenceDetail(c, variant, flags) : paperDetail(c, variant, flags);
          const ending = /[.!?。！？]$/.test(detail) ? '' : (isEnglish(variant) ? '.' : '。');
          block.push(`${counter}. **${b.title || ''}**${detail ? (isEnglish(variant) ? '. ' : '。') + detail : ''}${ending}`);
        }
      }
    } else if (kind === 'custom') {
      for (const b of items) for (const line of b.content.lines || []) block.push(bulletMd(line));
    }

    if (block.length > 1 || (block.length === 1 && !block[0].startsWith('##'))) {
      lines.push(...block);
    }
  }
  return lines.join('\n\n') + '\n';
}

module.exports = { esc, renderVariantHtml, renderPage, renderMarkdown };
