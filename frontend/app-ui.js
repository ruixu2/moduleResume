/* ================================================================
   moduleResume · 前端 UI（二）：基础信息 / 版本编辑器 / 导入导出 / 初始化
   ================================================================ */

/* ---------------- 基础信息 ---------------- */
function renderProfile() {
  const p = DB.profile;
  const val = k => esc(p[k] == null ? '' : p[k]);
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const defaultId = p.photoId || (photos[0] ? photos[0].id : '');
  const gallery = photos.map(ph => {
    const isDef = ph.id === defaultId;
    return '<div class="photo-card' + (isDef ? ' default' : '') + '">' +
      (isDef ? '<span class="pbadge">默认</span>' : '') +
      '<img src="/assets/photos/' + encodeURIComponent(ph.file) + '" alt="' + esc(ph.name) + '">' +
      '<div class="pname" title="' + esc(ph.name) + '">' + esc(ph.name) + '</div>' +
      '<div class="pacts">' +
      (isDef ? '' : '<button class="btn tiny" data-setphoto="' + esc(ph.id) + '">设为默认</button>') +
      '<button class="btn tiny danger" data-delphoto="' + esc(ph.id) + '">删除</button>' +
      '</div></div>';
  }).join('');
  const field = (k, label, placeholder, span) =>
    '<label class="pfield"' + (span ? ' style="grid-column:1 / -1"' : '') + '>' +
    '<span class="plab">' + label + '</span>' +
    '<input class="pf inp" data-k="' + k + '" value="' + val(k) + '"' +
    (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '>' +
    '</label>';

  $('#profileEditor').innerHTML =
    '<div class="card">' +
    '<h3 style="margin:0 0 4px;color:var(--navy);font-size:16px">基本信息（修改自动保存）</h3>' +
    '<div class="pf-section">基本资料</div>' +
    '<div class="pf-grid">' +
    field('name', '姓名') + field('gender', '性别', '男 / 女') +
    field('birth', '出生年月') + field('hometown', '籍贯') +
    field('political', '政治面貌', '中共党员 / 共青团员 / 群众') + field('ethnicity', '民族', '可空，如：汉族') +
    '</div>' +
    '<div class="pf-section">联系方式与主页</div>' +
    '<div class="pf-grid">' +
    field('phone', '联系电话') + field('email', '电子邮箱') +
    field('wechat', '微信号', '可空') + field('location', '现居地', '如：北京') +
    field('website', '个人主页', '可空，如：github.com/xxx', true) +
    '</div>' +
    '<div class="pf-section">证件照（可上传多张；每个简历版本可单独选用）</div>' +
    '<div class="photo-gallery">' + gallery +
    '<div class="photo-upload" id="pfPhotoUpload"><div>＋<br>上传照片</div></div>' +
    '<input type="file" id="pfPhotoFile" accept="image/*" hidden>' +
    '</div>' +
    '</div>' +
    '<div class="hint">所有字段均可空，填写后自动出现在简历头部与 Markdown 导出中；删除 / 切换默认照片不影响已冻结的快照。</div>';
}

function bindProfileEvents() {
  $('#profileEditor').addEventListener('input', e => {
    const el = e.target;
    if (el.classList.contains('pf')) {
      DB.profile[el.dataset.k] = el.value;
      saveProfile();
    }
  });
  $('#profileEditor').addEventListener('change', e => {
    if (e.target.id !== 'pfPhotoFile') return;
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const max = 480;
        let w = img.width, h = img.height;
        if (w > max || h > max) { const s = Math.min(max / w, max / h); w = Math.round(w * s); h = Math.round(h * s); }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = cv.toDataURL('image/jpeg', 0.88);
        try {
          const entry = await api.post('/api/photo', {
            dataUrl: dataUrl,
            name: (f.name || '').replace(/\.[^.]+$/, '') || ('证件照 ' + ((DB.profile.photos || []).length + 1)),
          });
          DB.profile.photos = (DB.profile.photos || []).concat([entry]);
          DB.profile.photoId = entry.id;
          await api.put('/api/profile', DB.profile);
          renderProfile();
          toast('已添加照片「' + entry.name + '」并设为默认');
        } catch (err) { toast('上传失败：' + err.message); }
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
    e.target.value = '';
  });
  $('#profileEditor').addEventListener('click', async e => {
    if (e.target.closest('#pfPhotoUpload')) { $('#pfPhotoFile').click(); return; }
    const setDef = e.target.closest('[data-setphoto]');
    if (setDef) {
      DB.profile.photoId = setDef.dataset.setphoto;
      await api.put('/api/profile', DB.profile);
      renderProfile();
      toast('已设为默认照片');
      return;
    }
    const del = e.target.closest('[data-delphoto]');
    if (del) {
      const id = del.dataset.delphoto;
      const entry = (DB.profile.photos || []).find(x => x.id === id);
      if (!confirm('删除照片「' + ((entry && entry.name) || id) + '」？此操作不可恢复。')) return;
      try {
        DB.profile = await fetch('/api/photos/' + encodeURIComponent(id), { method: 'DELETE' }).then(r => r.json());
        renderProfile();
        toast('照片已删除');
      } catch (err) { toast('删除失败：' + err.message); }
    }
  });
}

/* ---------------- 版本编辑器 ---------------- */
function photoAsJpeg(file) {
  if (!file || file.size > 10 * 1024 * 1024) return Promise.reject(new Error('请选择不超过 10 MB 的照片。'));
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || '') && !/\.(jpe?g|png|webp)$/i.test(file.name || '')) {
    return Promise.reject(new Error('请选择 JPG、PNG 或 WebP 照片。'));
  }
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('无法读取图片，请重新选择。')); };
    img.onload = () => {
      try {
        let width = img.width, height = img.height;
        if (!width || !height) throw new Error('照片尺寸无效。');
        const scale = Math.min(1, 480 / width, 480 / height);
        width = Math.max(1, Math.round(width * scale)); height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
        context.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      } catch (err) { reject(err); }
      finally { URL.revokeObjectURL(src); }
    };
    img.src = src;
  });
}

/* ---------------- 版本证件照：从基础信息导入 ---------------- */
async function applyVersionPhoto(photoId) {
  if (!editingVariant) return;
  editingVariant.photoId = photoId || '';
  if (editingVariant.style && editingVariant.style.photoPos === 'none') {
    editingVariant.style.photoPos = 'right';
    const posSel = $('#stPhotoPos');
    if (posSel) posSel.value = 'right';
  }
  fillPhotoOptions();
  const sel = $('#edPhoto');
  if (sel) sel.value = editingVariant.photoId || '';
  await saveEditor(true);
  refreshPreview();
  closeModal();
  toast(photoId ? '已使用基础信息中的证件照' : '已改为跟随基础信息默认照片');
}

function openPhotoPicker() {
  if (!editingVariant) return;
  const photos = (DB.profile && Array.isArray(DB.profile.photos)) ? DB.profile.photos : [];
  const selected = editingVariant.photoId || '';
  const defaultId = DB.profile.photoId || (photos[0] ? photos[0].id : '');
  const followCurrent = !selected;
  const cards = photos.map(ph => {
    const isCurrent = selected ? ph.id === selected : ph.id === defaultId;
    return '<div class="photo-card' + (isCurrent ? ' default' : '') + '" data-pick-photo="' + esc(ph.id) + '" style="cursor:pointer">' +
      (isCurrent ? '<span class="pbadge">' + (selected ? '当前' : '跟随中') + '</span>' : '') +
      '<img src="/assets/photos/' + encodeURIComponent(ph.file) + '" alt="' + esc(ph.name) + '">' +
      '<div class="pname" title="' + esc(ph.name) + '">' + esc(ph.name) + '</div>' +
      '<div class="pacts"><button type="button" class="btn tiny">使用</button></div>' +
      '</div>';
  }).join('');
  const followCard = '<div class="photo-card' + (followCurrent ? ' default' : '') + '" data-pick-photo="" style="cursor:pointer">' +
    (followCurrent ? '<span class="pbadge">当前</span>' : '') +
    '<div style="width:92px;height:122px;display:flex;align-items:center;justify-content:center;text-align:center;border:1px dashed #b9c4dc;border-radius:4px;background:#fafbfd;color:#7a8499;font-size:12px;line-height:1.6">跟随<br>主档</div>' +
    '<div class="pname">基础信息默认照片</div>' +
    '<div class="pacts"><button type="button" class="btn tiny">使用</button></div>' +
    '</div>';
  modal(
    '<h3>加入证件照</h3>' +
    '<p class="muted" style="margin:-8px 0 12px">从基础信息中已有的证件照选择，或上传本机图片。选中的照片只用于当前简历版本。</p>' +
    '<div class="photo-gallery">' + followCard + cards + '</div>' +
    (photos.length ? '' : '<div class="empty" style="padding:16px 0">基础信息中还没有证件照，可点击下方按钮上传。</div>') +
    '<div class="modal-actions"><button class="btn" id="photoPickUpload" type="button">＋ 上传本机图片</button>' +
    '<span style="flex:1"></span><button class="btn" data-close>取消</button></div>'
  );
  $$('[data-pick-photo]', $('#modal-root')).forEach(card => {
    card.onclick = () => applyVersionPhoto(card.getAttribute('data-pick-photo') || '');
  });
  const upload = $('#photoPickUpload');
  if (upload) upload.onclick = () => { closeModal(); $('#edPhotoFile').click(); };
}

function openEditor(id) {
  const v = DB.variants.find(x => x.id === id);
  if (!v) return;
  editingVariant = deepClone(v);
  if (!editingVariant.themeId) editingVariant.themeId = THEMES[0] ? THEMES[0].id : 'theme-navy';
  if (!editingVariant.photoId) editingVariant.photoId = '';
  fillEditorOptions();
  $('#edName').value = editingVariant.name || '';
  $('#edCompany').value = editingVariant.company || '';
  $('#edPosition').value = editingVariant.position || '';
  updateVersionCategorySuggestions();
  $('#edCategory').value = versionCategory(editingVariant);
  $('#edIntent').value = editingVariant.intent || '';
  $('#edSummaryOverride').value = editingVariant.summaryOverride || '';
  const themeSel = $('#edTheme');
  if (themeSel) themeSel.value = editingVariant.themeId;
  const photoSel = $('#edPhoto');
  if (photoSel) photoSel.value = editingVariant.photoId || '';
  fillStylePanel();
  toggleStylePanel();
  renderSections();
  showView('editor');
  refreshPreview();
}

const autosaveEditor = debounce(() => saveEditor(true), 1200);

async function saveEditor(silent) {
  if (!editingVariant) return;
  editingVariant.name = $('#edName').value.trim() || editingVariant.name;
  editingVariant.company = $('#edCompany').value.trim();
  editingVariant.position = $('#edPosition').value.trim();
  editingVariant.category = $('#edCategory').value.trim();
  editingVariant.intent = $('#edIntent').value.trim();
  editingVariant.summaryOverride = $('#edSummaryOverride').value;
  editingVariant.themeId = ($('#edTheme') && $('#edTheme').value) || editingVariant.themeId || 'theme-navy';
  editingVariant.photoId = ($('#edPhoto') && $('#edPhoto').value) || '';
  editingVariant.updated = today();
  const i = DB.variants.findIndex(x => x.id === editingVariant.id);
  if (i >= 0) DB.variants[i] = editingVariant;
  await saveVariants();
  if (!silent) { toast('已保存 ✓'); refreshPreview(); }
}

function refreshPreview() {
  if (!editingVariant) return;
  const right = $('.editor-right');
  const w = right ? right.clientWidth : 640;
  /* A4 纸样宽 21cm ≈ 794px（含页边距内衬），按可用宽度等比缩放 */
  const zoom = Math.max(0.35, Math.min(1, (w - 26) / 800)).toFixed(3);
  $('#previewFrame').src = '/render/' + editingVariant.id + '?zoom=' + zoom + '&_=' + Date.now();
}

/* 预览页没有证件照时，在简历照片位置显示“手动加入证件照”入口。
   只作用于编辑器内的预览 iframe，不影响打印、HTML 导出和 PDF。 */
function decoratePreviewPhoto() {
  const frame = $('#previewFrame');
  if (!frame || !editingVariant) return;
  let doc;
  try { doc = frame.contentDocument; } catch (e) { return; }
  if (!doc) return;
  const head = doc.querySelector('.r-head');
  if (!head) return;
  const old = doc.querySelector('.preview-photo-action');
  if (old) old.remove();
  if (doc.querySelector('img.photo')) return;
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'preview-photo-action';
  btn.innerHTML = '＋<br>加入<br>证件照';
  btn.title = '从基础信息选择或上传本机照片';
  btn.style.cssText = 'width:2.75cm;height:3.67cm;flex:0 0 auto;display:flex;align-items:center;justify-content:center;' +
    'text-align:center;padding:0 6pt;border:1.5pt dashed #9db3d8;border-radius:4pt;background:#f7f9fc;' +
    'color:#1E386B;font:inherit;font-size:9.5pt;line-height:1.5;cursor:pointer';
  btn.addEventListener('mouseenter', () => { btn.style.background = '#eef4ff'; btn.style.borderColor = '#1E386B'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#f7f9fc'; btn.style.borderColor = '#9db3d8'; });
  btn.addEventListener('click', e => {
    e.preventDefault();
    openPhotoPicker();
  });
  head.appendChild(btn);
}

function renderSections() {
  const wrap = $('#sectionList');
  wrap.innerHTML = editingVariant.sections.map((sec, si) => {
    const items = sec.items.map((it, ii) => {
      const b = DB.blocks.find(x => x.id === it.bid);
      const label = b ? blockTitle(b) : '（素材块已被删除）';
      const customized = hasOv(it.ov);
      const embeddedAdvisors = (Array.isArray(it.advisorIds) ? it.advisorIds : [])
        .map(id => DB.blocks.find(x => x.id === id)).filter(Boolean);
      const advisorButton = b && b.type === 'education'
        ? '<button class="btn tiny ov' + (embeddedAdvisors.length ? ' on' : '') + '" data-act="advisor" data-si="' + si + '" data-ii="' + ii + '" title="选择嵌入到这条学历下方的研究生导师">' + (embeddedAdvisors.length ? '导师 ' + embeddedAdvisors.length + ' ✓' : '嵌入导师') + '</button>'
        : '';
      return '<div class="sec-item">' +
        '<span class="ord">' + (ii + 1) + '</span>' +
        (b ? badge(b) : '<span class="block-badge">已删</span>') +
        '<span class="block-title" title="' + esc(label) + '">' + esc(label) + '</span>' +
        advisorButton +
        '<button class="btn tiny ov' + (customized ? ' on' : '') + '" data-act="custom" data-si="' + si + '" data-ii="' + ii + '" title="版本级定制：只改这个版本，不动素材块库">' + (customized ? '已定制 ✓' : '定制') + '</button>' +
        '<button class="btn tiny" data-act="up" data-si="' + si + '" data-ii="' + ii + '" title="上移">↑</button>' +
        '<button class="btn tiny" data-act="down" data-si="' + si + '" data-ii="' + ii + '" title="下移">↓</button>' +
        '<button class="btn tiny danger" data-act="rm" data-si="' + si + '" data-ii="' + ii + '">移除</button>' +
        '</div>';
    }).join('');
    return '<div class="sec-card" data-si="' + si + '">' +
      '<div class="sec-head">' +
      '<input class="sec-title" value="' + esc(sec.title) + '" data-si="' + si + '" title="板块标题（可直接改）">' +
      '<span class="sec-kind">' + esc((KINDS[sec.kind] || {}).label || sec.kind) + '</span>' +
      '<button class="btn tiny" data-act="upsec" data-si="' + si + '" title="板块上移">↑</button>' +
      '<button class="btn tiny" data-act="downsec" data-si="' + si + '" title="板块下移">↓</button>' +
      '<button class="btn tiny danger" data-act="rmsec" data-si="' + si + '">删除板块</button>' +
      '</div>' +
      '<div class="sec-items">' + (items || '<div class="sec-empty">（空板块——从下面按钮添加素材）</div>') + '</div>' +
      '<div class="sec-actions">' +
      '<button class="btn tiny" data-act="pick" data-si="' + si + '">+ 从块库添加</button>' +
      '<button class="btn tiny" data-act="fillall" data-si="' + si + '">＋全部兼容素材</button>' +
      '</div></div>';
  }).join('');
}

function bindSectionList() {
  const wrap = $('#sectionList');
  wrap.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const si = parseInt(btn.dataset.si, 10);
    const ii = parseInt(btn.dataset.ii, 10);
    const sec = editingVariant.sections[si];
    if (!sec) return;
    if (act === 'up' && ii > 0) { const t = sec.items[ii - 1]; sec.items[ii - 1] = sec.items[ii]; sec.items[ii] = t; renderSections(); autosaveEditor(); }
    else if (act === 'down' && ii < sec.items.length - 1) { const t = sec.items[ii + 1]; sec.items[ii + 1] = sec.items[ii]; sec.items[ii] = t; renderSections(); autosaveEditor(); }
    else if (act === 'rm') { sec.items.splice(ii, 1); renderSections(); autosaveEditor(); }
    else if (act === 'rmsec') {
      if (confirm('删除板块「' + sec.title + '」？（素材块本身不受影响）')) {
        editingVariant.sections.splice(si, 1); renderSections(); autosaveEditor();
      }
    }
    else if (act === 'upsec' && si > 0) {
      const arr = editingVariant.sections;
      const t = arr[si - 1]; arr[si - 1] = arr[si]; arr[si] = t;
      renderSections(); autosaveEditor();
    }
    else if (act === 'downsec' && si < editingVariant.sections.length - 1) {
      const arr = editingVariant.sections;
      const t = arr[si + 1]; arr[si + 1] = arr[si]; arr[si] = t;
      renderSections(); autosaveEditor();
    }
    else if (act === 'pick') { openPicker(si); }
    else if (act === 'advisor') { openAdvisorEmbedPicker(si, ii); }
    else if (act === 'custom') { openOverrideEditor(si, ii); }
    else if (act === 'fillall') {
      const compat = (KINDS[sec.kind] || {}).types || [];
      let added = 0;
      DB.blocks.filter(b => compat.includes(b.type)).forEach(b => {
        if (!sec.items.some(it => it.bid === b.id)) { sec.items.push({ bid: b.id, ov: {} }); added++; }
      });
      renderSections(); autosaveEditor();
      toast(added ? '添加了 ' + added + ' 个素材块' : '没有新的兼容素材');
    }
  });
  wrap.addEventListener('input', e => {
    if (e.target.classList.contains('sec-title')) {
      const si = parseInt(e.target.dataset.si, 10);
      editingVariant.sections[si].title = e.target.value;
      autosaveEditor();
    }
  });
}

/* ---------------- 版本级定制（ov） ---------------- */
const OV_FIELDS = {
  summary:   [{ k: 'text', l: '总结内容', big: true }],
  skill:     [{ k: 'text', l: '技能概览（「引导词：内容」会加粗引导词）' }, { k: 'items', l: '子项（每行一条）', big: true, list: true }],
  education: [{ k: 'start', l: '起始（年月）', month: true }, { k: 'end', l: '结束（年月，可空=至今）', month: true }, { k: 'degreeType', l: '学历/学位' }, { k: 'school', l: '学校' }, { k: 'college', l: '学院' }, { k: 'major', l: '专业（方向）' }, { k: 'advisor', l: '导师' }],
  advisor:   [{ k: 'name', l: '导师姓名' }, { k: 'relationship', l: '培养关系' }, { k: 'academicTitle', l: '职称' }, { k: 'position', l: '职务' }, { k: 'organization', l: '学校 / 单位' }, { k: 'college', l: '学院 / 机构' }, { k: 'research', l: '研究方向', big: true }, { k: 'contact', l: '联系方式' }, { k: 'homepage', l: '个人主页' }, { k: 'brief', l: '简介 / 与本人合作情况', big: true }],
  thesis:    [{ k: 'degreeType', l: '学位类型' }, { k: 'major', l: '专业名称' }, { k: 'school', l: '学校' }, { k: 'college', l: '学院' }, { k: 'dates', l: '完成/答辩时间' }, { k: 'advisor', l: '导师' }, { k: 'brief', l: '论文简要内容', big: true }, { k: 'works', l: '主要工作（每行一条）', big: true, list: true }],
  project:   [{ k: 'source', l: '项目来源' }, { k: 'projType', l: '项目类型' }, { k: 'funding', l: '经费/编号' }, { k: 'work', l: '项目工作' }, { k: 'works', l: '主要工作（每行一条）', big: true, list: true }],
  internship: [{ k: 'company', l: '公司 / 单位' }, { k: 'position', l: '实习岗位' }, { k: 'department', l: '部门' }, { k: 'location', l: '工作地点' }, { k: 'start', l: '起始（年月）', month: true }, { k: 'end', l: '结束（年月，可空=至今）', month: true }, { k: 'works', l: '实习工作与成果（每行一条）', big: true, list: true }],
  course:    [{ k: 'organization', l: '开课单位' }, { k: 'courseType', l: '课程类型' }, { k: 'dates', l: '学习时间' }, { k: 'credits', l: '学分 / 学时' }, { k: 'score', l: '成绩' }, { k: 'desc', l: '课程内容与收获', big: true }],
  academic_service: [{ k: 'organization', l: '机构 / 期刊 / 学术组织' }, { k: 'position', l: '职务 / 角色' }, { k: 'start', l: '起始（年月）', month: true }, { k: 'end', l: '结束（年月，可空=至今）', month: true }, { k: 'desc', l: '职责与成果', big: true }],
  award:     [{ k: 'level', l: '获奖级别' }, { k: 'rank', l: '奖项等级' }, { k: 'date', l: '获奖时间' }, { k: 'organization', l: '颁奖单位' }, { k: 'recipient', l: '获奖身份 / 排名' }, { k: 'desc', l: '获奖说明 / 个人贡献', big: true }],
  paper:     [{ k: 'journal', l: '期刊名称' }, { k: 'partition', l: '分区' }, { k: 'impactFactor', l: '影响因子' }, { k: 'date', l: '发表时间' }, { k: 'volume', l: '卷期页码' }, { k: 'note', l: '作者位次备注' }, { k: 'desc', l: '简介', big: true }],
  conference_paper: [{ k: 'journal', l: '会议名称' }, { k: 'partition', l: '会议级别 / 索引' }, { k: 'date', l: '会议时间' }, { k: 'volume', l: '会议地点 / 页码' }, { k: 'note', l: '作者位次备注' }, { k: 'desc', l: '简介', big: true }],
  unpublished_paper: [{ k: 'authors', l: '作者' }, { k: 'status', l: '稿件状态' }, { k: 'targetJournal', l: '拟投 / 投稿期刊' }, { k: 'note', l: '作者贡献或备注' }, { k: 'desc', l: '研究简介', big: true }],
  patent:    [{ k: 'status', l: '状态' }],
  custom:    [{ k: 'lines', l: '内容行（每行一条）', big: true, list: true }],
};

/* 取某字段的当前生效值（优先新版 ov.content，其次旧版扁平 ov，最后素材块原文） */
function ovOriginal(b, key) {
  const content = b.content || {};
  if (b.type === 'project' && key === 'works' && !Array.isArray(content.works)) {
    return Array.isArray(content.bullets) ? content.bullets : [];
  }
  return content[key];
}
function ovEffective(it, b, key) {
  const ov = it.ov || {};
  if (ov.content && ov.content[key] !== undefined) return ov.content[key];
  if (typeof ov[key] === 'string' || Array.isArray(ov[key])) return ov[key];
  if (b.type === 'project' && key === 'works' && ov.bullets && typeof ov.bullets === 'object') {
    const rows = (ovOriginal(b, key) || []).slice();
    for (const [index, value] of Object.entries(ov.bullets)) {
      const i = Number(index);
      if (Number.isInteger(i) && i >= 0 && i < rows.length) rows[i] = value;
    }
    return rows;
  }
  return ovOriginal(b, key);
}

function openOverrideEditor(si, ii) {
  const sec = editingVariant.sections[si];
  if (!sec) return;
  const it = sec.items[ii]; if (!it) return;
  const b = DB.blocks.find(x => x.id === it.bid);
  if (!b) { toast('素材块已被删除，无法定制'); return; }
  it.ov = it.ov || {};
  const fields = OV_FIELDS[b.type] || [{ k: 'text', l: '内容', big: true }];
  const hasTitle = ['project', 'internship', 'academic_service', 'award', 'paper', 'conference_paper', 'unpublished_paper', 'patent', 'custom', 'thesis', 'course'].indexOf(b.type) >= 0;
  const hasGroup = ['paper', 'conference_paper', 'unpublished_paper', 'patent'].indexOf(b.type) >= 0;

  let html = '<h3>版本级定制 · ' + esc((TYPES[b.type] || {}).label || b.type) + '</h3>' +
    '<p class="muted" style="margin:-8px 0 12px">只对「' + esc(editingVariant.name || '当前版本') + '」生效，不改动素材块库；保持原文 = 不覆盖。</p>';
  if (hasTitle) html += '<label>标题<input id="ovTitle" value="' + esc(it.ov.title || b.title || '') + '"></label>';
  if (hasGroup) html += '<label>分组（渲染为小标题）<input id="ovGroup" value="' + esc(it.ov.group || b.group || '') + '"></label>';
  for (const f of fields) {
    const v = ovEffective(it, b, f.k);
    const val = f.list ? (Array.isArray(v) ? v.join('\n') : (v == null ? '' : String(v))) : (v == null ? '' : String(v));
    if (b.type === 'project' && f.k === 'works') {
      html += '<label style="margin-bottom:4px">主要工作（勾选显示，可逐条修改、增删和调整顺序）</label>' +
        '<div id="ovWorksRows"></div><button class="btn tiny" id="ovWorksAdd" type="button">+ 添加主要工作</button>';
      continue;
    }
    html += '<label>' + esc(f.l) +
      (f.big
        ? '<textarea id="ov_' + f.k + '" rows="' + (f.list ? 6 : 4) + '">' + esc(val) + '</textarea>'
        : '<input' + (f.month ? ' type="month"' : '') + ' id="ov_' + f.k + '" value="' + esc(val) + '">') +
      '</label>';
  }
  html += '<div class="modal-actions">' +
    (hasOv(it.ov) ? '<button class="btn danger" id="ovClear">清除定制</button>' : '') +
    '<span style="flex:1"></span>' +
    '<button class="btn" data-close>取消</button><button class="btn primary" id="ovOk">保存定制</button></div>';
  modal(html);

  if (b.type === 'project') {
    const rows = $('#ovWorksRows');
    function addWork(value, enabled) {
      const row = document.createElement('div');
      row.className = 'work-row override-work-row';
      row.innerHTML = '<label class="project-work-select"><input type="checkbox" data-work-enabled aria-label="在本简历中显示此项"><span>显示</span></label>' +
        '<textarea rows="2" aria-label="项目主要工作"></textarea>' +
        '<button type="button" class="btn tiny" data-work-up title="上移">↑</button>' +
        '<button type="button" class="btn tiny" data-work-down title="下移">↓</button>' +
        '<button type="button" class="btn tiny danger" data-work-delete>删除</button>';
      row.querySelector('textarea').value = value || '';
      row.querySelector('[data-work-enabled]').checked = enabled !== false;
      row.querySelector('[data-work-up]').onclick = () => { if (row.previousElementSibling) rows.insertBefore(row, row.previousElementSibling); };
      row.querySelector('[data-work-down]').onclick = () => { if (row.nextElementSibling) rows.insertBefore(row.nextElementSibling, row); };
      row.querySelector('[data-work-delete]').onclick = () => row.remove();
      rows.appendChild(row);
    }
    const works = ovEffective(it, b, 'works');
    if (Array.isArray(it.ov.projectWorks)) {
      it.ov.projectWorks.forEach(work => addWork(work && work.text, !(work && work.enabled === false)));
    } else {
      const selected = Array.isArray(works) ? works : [];
      selected.forEach(work => addWork(work, true));
      // Reconstruct deselected original rows for older versions that only saved content.works.
      if (it.ov.content && Array.isArray(it.ov.content.works)) {
        const counts = new Map();
        selected.forEach(work => counts.set(work, (counts.get(work) || 0) + 1));
        (ovOriginal(b, 'works') || []).forEach(work => {
          if ((counts.get(work) || 0) > 0) counts.set(work, counts.get(work) - 1);
          else addWork(work, false);
        });
      }
    }
    $('#ovWorksAdd').onclick = () => { addWork(''); const inputs = rows.querySelectorAll('textarea'); inputs[inputs.length - 1].focus(); };
  }

  const clearBtn = $('#ovClear');
  if (clearBtn) clearBtn.onclick = async () => {
    it.ov = {};
    closeModal(); renderSections(); await saveEditor(true); refreshPreview();
    toast('已恢复为素材库原文');
  };
  $('#ovOk').onclick = async () => {
    const next = {};
    const titleEl = $('#ovTitle');
    if (titleEl) { const v = titleEl.value.trim(); if (v && v !== (b.title || '')) next.title = v; }
    const gEl = $('#ovGroup');
    if (gEl) { const v = gEl.value.trim(); if (v && v !== (b.group || '')) next.group = v; }
    const content = {};
    for (const f of fields) {
      const isProjectWorks = b.type === 'project' && f.k === 'works';
      const el = isProjectWorks ? $('#ovWorksRows') : $('#ov_' + f.k); if (!el) continue;
      const orig = ovOriginal(b, f.k);
      if (f.list) {
        const rows = isProjectWorks ? Array.from(el.children).map(row => ({
          text: row.querySelector('textarea').value.trim(), enabled: row.querySelector('[data-work-enabled]').checked,
        })).filter(row => row.text) : [];
        const arr = isProjectWorks ? rows.filter(row => row.enabled).map(row => row.text)
          : el.value.split('\n').map(s => s.trim()).filter(Boolean);
        const o = Array.isArray(orig) ? orig : [];
        const neutralRows = !isProjectWorks || (rows.length === o.length && rows.every((row, i) => row.enabled && row.text === o[i]));
        if (JSON.stringify(arr) !== JSON.stringify(o) || !neutralRows) {
          content[f.k] = arr;
          if (isProjectWorks) next.projectWorks = rows;
        }
      } else {
        const v = el.value.trim();
        const allowEmpty = (['internship', 'academic_service'].includes(b.type) && f.k === 'end') ||
          (b.type === 'project' && f.k === 'work');
        if ((v !== '' || allowEmpty) && v !== String(orig == null ? '' : orig)) content[f.k] = v;
      }
    }
    if (Object.keys(content).length) next.content = content;
    it.ov = next;
    closeModal(); renderSections(); await saveEditor(true); refreshPreview();
    toast(hasOv(next) ? '定制已保存（仅本版本）' : '未做覆盖（与原文一致）');
  };
}

/* ---------------- 版本快照 ---------------- */
function fillThemeOptions() {
  const sel = $('#edTheme'); if (!sel) return;
  sel.innerHTML = (THEMES.length ? THEMES : [{ id: 'theme-navy', name: '藏青学术' }])
    .map(t => '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>').join('');
}
function fillPhotoOptions() {
  const sel = $('#edPhoto'); if (!sel) return;
  const photos = (DB.profile && Array.isArray(DB.profile.photos)) ? DB.profile.photos : [];
  sel.innerHTML = '<option value="">跟随主档' + (photos.length ? '' : '（暂无照片）') + '</option>' +
    photos.map(ph => '<option value="' + esc(ph.id) + '">' + esc(ph.name) + '</option>').join('');
}
function fillEditorOptions() { fillThemeOptions(); fillPhotoOptions(); }

/* ---------------- 自定义样式（用户可调入口） ---------------- */
const CUSTOM_STYLE_DEFAULTS = {
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
function currentCustomStyle() {
  return Object.assign({}, CUSTOM_STYLE_DEFAULTS,
    (editingVariant && editingVariant.style) ? editingVariant.style : {});
}
function fillStylePanel() {
  const s = currentCustomStyle();
  const set = (id, v) => { const el = $('#' + id); if (el) el.value = v; };
  set('stAccent', s.accent);
  set('stText', s.text);
  set('stFont', s.font);
  set('stSection', s.section);
  set('stMargin', s.margin);
  set('stFontSize', s.fontSize);
  set('stLineHeight', s.lineHeight);
  set('stPhotoPos', s.photoPos);
  set('stPhotoSize', s.photoSize);
  set('stDensity', s.density);
  const fs = $('#stFontSizeVal'); if (fs) fs.textContent = s.fontSize + 'pt';
  const lh = $('#stLineHeightVal'); if (lh) lh.textContent = Number(s.lineHeight).toFixed(2);
}
function toggleStylePanel() {
  const panel = $('#edStylePanel');
  if (!panel) return;
  const on = !!(editingVariant && editingVariant.themeId === 'theme-custom');
  panel.style.display = on ? '' : 'none';
}
function collectCustomStyle() {
  const val = id => { const el = $('#' + id); return el ? el.value : ''; };
  const style = {
    accent: val('stAccent') || CUSTOM_STYLE_DEFAULTS.accent,
    text: val('stText') || CUSTOM_STYLE_DEFAULTS.text,
    font: val('stFont') || 'sans',
    fontSize: parseFloat(val('stFontSize')) || CUSTOM_STYLE_DEFAULTS.fontSize,
    lineHeight: parseFloat(val('stLineHeight')) || CUSTOM_STYLE_DEFAULTS.lineHeight,
    section: val('stSection') || 'underline',
    margin: val('stMargin') || 'normal',
    photoPos: val('stPhotoPos') || 'right',
    photoSize: val('stPhotoSize') || 'normal',
    density: val('stDensity') || 'normal',
  };
  const fs = $('#stFontSizeVal'); if (fs) fs.textContent = style.fontSize + 'pt';
  const lh = $('#stLineHeightVal'); if (lh) lh.textContent = Number(style.lineHeight).toFixed(2);
  return style;
}
const applyStyleChange = debounce(async () => {
  if (!editingVariant) return;
  editingVariant.style = collectCustomStyle();
  await saveEditor(true);
  refreshPreview();
}, 450);
function bindStylePanel() {
  ['#stAccent', '#stText', '#stFont', '#stSection', '#stMargin', '#stFontSize', '#stLineHeight', '#stPhotoPos', '#stPhotoSize', '#stDensity'].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('input', () => applyStyleChange());
    el.addEventListener('change', () => applyStyleChange());
  });
  const reset = $('#stReset');
  if (reset) reset.onclick = () => {
    editingVariant.style = Object.assign({}, CUSTOM_STYLE_DEFAULTS);
    fillStylePanel();
    applyStyleChange();
    toast('已恢复默认样式');
  };
}

function openSnapshotList(variantId) {
  const v = DB.variants.find(x => x.id === variantId);
  if (!v) return;
  const m = modal(
    '<h3>版本快照 · ' + esc(v.name) + '</h3>' +
    '<p class="muted" style="margin:-8px 0 12px">快照会冻结当时的素材内容、排版主题与照片；之后再改素材块库，已冻结版本不受影响。</p>' +
    '<div id="snapList"></div>' +
    '<div class="modal-actions"><button class="btn primary" id="snapNew">+ 创建新快照</button><button class="btn" data-close>关闭</button></div>'
  );
  function renderList() {
    const list = snapshotsOf(variantId);
    $('#snapList', m).innerHTML = list.length ? list.map(s =>
      '<div class="snap-row">' +
      '<div class="grow"><div class="snap-name">' + esc(s.name || '') + '</div>' +
      '<div class="snap-time">' + esc(fmtDateTime(s.created)) + (s.note ? ' · ' + esc(s.note) : '') + '</div></div>' +
      '<button class="btn tiny" data-snapopen="' + esc(s.id) + '">预览</button>' +
      '<button class="btn tiny" data-snapexp="' + esc(s.id) + '" data-ext="pdf">PDF</button>' +
      '<button class="btn tiny" data-snapexp="' + esc(s.id) + '" data-ext="html">HTML</button>' +
      '<button class="btn tiny" data-snapexp="' + esc(s.id) + '" data-ext="md">MD</button>' +
      '<button class="btn tiny danger" data-snapdel="' + esc(s.id) + '">删除</button>' +
      '</div>').join('')
      : '<div class="sec-empty">还没有快照。创建后即可随时回看「当时发出去的那一版」。</div>';
  }
  renderList();
  $('#snapNew', m).onclick = async () => {
    try { await createSnapshot(variantId); renderList(); renderVersions(); }
    catch (err) { toast('创建失败：' + err.message); }
  };
  m.addEventListener('click', async e => {
    const open = e.target.closest('[data-snapopen]');
    const exp = e.target.closest('[data-snapexp]');
    const del = e.target.closest('[data-snapdel]');
    if (open) { window.open('/render/snap/' + open.dataset.snapopen, '_blank'); return; }
    if (exp) {
      const url = '/api/export/snap/' + exp.dataset.snapexp + '.' + exp.dataset.ext;
      if (exp.dataset.ext === 'pdf') exportPdfFile(url);
      else location.href = url;
      return;
    }
    if (del) {
      if (!confirm('删除该快照？此操作不可恢复。')) return;
      try { await deleteSnapshot(del.dataset.snapdel); renderList(); renderVersions(); renderDashboard(); }
      catch (err) { toast('删除失败：' + err.message); }
    }
  });
}


function openPicker(si) {
  const sec = editingVariant.sections[si];
  if (!sec) return;
  const compat = (KINDS[sec.kind] || {}).types || Object.keys(TYPES);
  const m = modal(
    '<h3>从块库添加到「' + esc(sec.title) + '」</h3>' +
    '<input id="pkSearch" class="inp" style="width:100%;margin-bottom:10px" placeholder="搜索素材（标题 / 标签 / 内容）">' +
    '<div class="pick-list" id="pkList"></div>' +
    '<div class="modal-actions"><button class="btn primary" data-close>完成</button></div>'
  );
  function renderList() {
    const q = $('#pkSearch', m).value.trim().toLowerCase();
    let list = DB.blocks.filter(b => compat.includes(b.type));
    if (q) list = list.filter(b =>
      String(b.title || '').toLowerCase().includes(q) ||
      (b.tags || []).join(' ').toLowerCase().includes(q) ||
      JSON.stringify(b.content || {}).toLowerCase().includes(q));
    $('#pkList', m).innerHTML = list.length ? list.map(b => {
      const added = sec.items.some(it => it.bid === b.id);
      return '<div class="pick-row' + (added ? ' added' : '') + '" data-bid="' + esc(b.id) + '">' +
        '<span class="check">' + (added ? '✓' : '') + '</span>' + badge(b) +
        '<div class="block-main"><div class="block-title">' + esc(blockTitle(b)) + '</div>' +
        '<div class="block-sub">' + esc(blockSub(b)) + '</div></div></div>';
    }).join('') : '<div class="sec-empty" style="padding:14px">没有找到兼容类型的素材块。</div>';
  }
  renderList();
  $('#pkSearch', m).addEventListener('input', renderList);
  $('#pkList', m).addEventListener('click', e => {
    const row = e.target.closest('.pick-row'); if (!row) return;
    const bid = row.dataset.bid;
    if (sec.items.some(it => it.bid === bid)) return;
    sec.items.push({ bid: bid, ov: {} });
    renderSections(); autosaveEditor(); renderList();
  });
}

/* 每条教育经历可按版本绑定导师；清空选择即为“不嵌入” */
function openAdvisorEmbedPicker(si, ii) {
  const sec = editingVariant.sections[si];
  const it = sec && sec.items[ii];
  if (!it) return;
  const edu = DB.blocks.find(x => x.id === it.bid);
  if (!edu || edu.type !== 'education') return;
  const advisors = DB.blocks.filter(b => b.type === 'advisor');
  it.advisorIds = Array.isArray(it.advisorIds) ? it.advisorIds : [];
  const m = modal(
    '<h3>嵌入研究生导师</h3>' +
    '<p class="muted" style="margin:-8px 0 12px">当前学历：' + esc(blockTitle(edu)) + '。勾选后显示在该学历下方；全部取消则不嵌入。导师素材也可通过独立的“研究生导师”板块展示。</p>' +
    '<div class="pick-list" id="advisorEmbedList"></div>' +
    '<div class="modal-actions"><button class="btn danger" id="advisorEmbedClear">全部取消嵌入</button><span style="flex:1"></span><button class="btn primary" data-close>完成</button></div>'
  );
  function renderList() {
    $('#advisorEmbedList', m).innerHTML = advisors.length ? advisors.map(b => {
      const selected = it.advisorIds.includes(b.id);
      return '<div class="pick-row' + (selected ? ' added' : '') + '" data-advisor-id="' + esc(b.id) + '">' +
        '<span class="check">' + (selected ? '✓' : '') + '</span>' + badge(b) +
        '<div class="block-main"><div class="block-title">' + esc(blockTitle(b)) + '</div>' +
        '<div class="block-sub">' + esc(blockSub(b)) + '</div></div></div>';
    }).join('') : '<div class="sec-empty" style="padding:14px">导师素材库为空。请先到“素材块库”新增“研究生导师”。</div>';
  }
  renderList();
  $('#advisorEmbedList', m).addEventListener('click', e => {
    const row = e.target.closest('[data-advisor-id]'); if (!row) return;
    const id = row.dataset.advisorId;
    if (it.advisorIds.includes(id)) it.advisorIds = it.advisorIds.filter(x => x !== id);
    else it.advisorIds.push(id);
    renderList(); renderSections(); autosaveEditor();
  });
  $('#advisorEmbedClear', m).onclick = () => {
    it.advisorIds = [];
    renderList(); renderSections(); autosaveEditor();
    toast('该学历已设置为不嵌入导师');
  };
}

function openAddSectionModal() {
  modal(
    '<h3>添加板块</h3>' +
    '<label>板块标题<input id="asTitle" placeholder="如：实习经历"></label>' +
    '<label>呈现方式<select id="asKind">' +
    Object.keys(KINDS).map(k => '<option value="' + k + '">' + KINDS[k].label + '</option>').join('') +
    '</select></label>' +
    '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="asOk">添加</button></div>'
  );
  $('#asOk').onclick = () => {
    const title = $('#asTitle').value.trim() || '新板块';
    editingVariant.sections.push({ id: uid('sec'), title: title, kind: $('#asKind').value, items: [] });
    closeModal(); renderSections(); autosaveEditor();
  };
}

/* 编辑器工具条 */
function bindEditorBar() {
  $('#edBack').onclick = async () => { await saveEditor(true); renderVersions(); renderDashboard(); showView('versions'); };
  $('#edSave').onclick = () => saveEditor(false);
  $('#edMd').onclick = async () => { await saveEditor(true); location.href = '/api/export/' + editingVariant.id + '.md'; };
  $('#edHtml').onclick = async () => { await saveEditor(true); location.href = '/api/export/' + editingVariant.id + '.html'; };
  $('#edPdf').onclick = async () => { await saveEditor(true); exportPdfFile('/api/export/' + editingVariant.id + '.pdf'); };
  $('#edPrint').onclick = async () => { await saveEditor(true); window.open('/render/' + editingVariant.id + '?print=1', '_blank'); };
  $('#edStyle').onclick = async () => {
    if (!editingVariant) return;
    if (editingVariant.themeId !== 'theme-custom') {
      const sel = $('#edTheme');
      sel.value = 'theme-custom';
      sel.dispatchEvent(new Event('change'));
      toast('已切换到「自定义样式」');
    }
    const panel = $('#edStylePanel');
    if (panel) {
      panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
      panel.classList.remove('flash');
      void panel.offsetWidth;
      panel.classList.add('flash');
      setTimeout(() => panel.classList.remove('flash'), 1400);
    }
  };
  $('#edDup').onclick = async () => {
    await saveEditor(true);
    const c = deepClone(editingVariant); c.id = uid('var'); c.name = c.name + ' 变体'; c.created = today(); c.updated = today();
    DB.variants.unshift(c); await saveVariants();
    toast('已复制为「' + c.name + '」'); openEditor(c.id); renderVersions();
  };
  $('#edDel').onclick = async () => {
    if (!confirm('删除版本「' + editingVariant.name + '」？')) return;
    DB.variants = DB.variants.filter(x => x.id !== editingVariant.id);
    DB.applications.forEach(a => { if (a.versionId === editingVariant.id) a.versionId = ''; });
    await saveVariants(); await saveApps();
    renderVersions(); renderDashboard(); showView('versions');
  };
  $('#previewRefresh').onclick = () => refreshPreview();
  $('#previewOpen').onclick = () => window.open('/render/' + editingVariant.id, '_blank');
  $('#edPhotoImport').onclick = openPhotoPicker;
  $('#edPhotoUpload').onclick = () => $('#edPhotoFile').click();
  $('#edPhotoFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file || !editingVariant) return;
    const projectId = PROJECTS.current, variantId = editingVariant.id;
    const button = $('#edPhotoUpload');
    button.disabled = true;
    try {
      const dataUrl = await photoAsJpeg(file);
      if (PROJECTS.current !== projectId || !editingVariant || editingVariant.id !== variantId) throw new Error('当前项目或简历已切换，请重新选择照片。');
      await saveEditor(true);
      const response = await fetch('/api/photos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, variantId, dataUrl, name: (file.name || '').replace(/\.[^.]+$/, '') }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '上传失败');
      if (PROJECTS.current === projectId) {
        DB.profile = result.profile;
        const saved = DB.variants.find(v => v.id === variantId);
        if (saved) saved.photoId = result.entry.id;
        renderProfile();
        let positionAdjusted = false;
        if (editingVariant && editingVariant.id === variantId) {
          editingVariant.photoId = result.entry.id;
          /* 自定义样式若设置为“不显示照片”，加入照片后自动改为右上，确保能看到结果 */
          if (editingVariant.style && editingVariant.style.photoPos === 'none') {
            editingVariant.style.photoPos = 'right';
            const posSel = $('#stPhotoPos');
            if (posSel) posSel.value = 'right';
            positionAdjusted = true;
          }
          fillPhotoOptions();
          $('#edPhoto').value = result.entry.id;
          await saveEditor(true);
          refreshPreview();
        }
        toast(positionAdjusted ? '证件照已加入，照片位置已切换为右上' : '证件照已加入并用于当前简历');
      } else {
        toast('照片已保存到原项目，请重新打开当前简历查看');
      }
    } catch (err) { toast('照片上传失败：' + err.message); }
    finally { button.disabled = false; e.target.value = ''; }
  });
  fillEditorOptions();
  $('#previewFrame').addEventListener('load', decoratePreviewPhoto);
  bindStylePanel();
  $('#edTheme').addEventListener('change', async () => {
    editingVariant.themeId = $('#edTheme').value;
    await saveEditor(true);
    refreshPreview();
    toggleStylePanel();
    if (editingVariant.themeId === 'theme-custom') fillStylePanel();
    toast('主题已切换：' + ($('#edTheme').selectedOptions[0] ? $('#edTheme').selectedOptions[0].textContent : ''));
  });
  $('#edPhoto').addEventListener('change', async () => {
    editingVariant.photoId = $('#edPhoto').value;
    await saveEditor(true);
    refreshPreview();
    toast('证件照已切换');
  });
  $('#edSnap').onclick = async () => {
    await saveEditor(true);
    openSnapshotList(editingVariant.id);
  };
  ['#edName', '#edCompany', '#edPosition', '#edCategory', '#edIntent', '#edSummaryOverride'].forEach(sel => {
    $(sel).addEventListener('input', autosaveEditor);
  });
  $('#addSectionBtn').onclick = openAddSectionModal;
}

/* ---------------- 个人项目（多工作区，每人一套数据） ---------------- */
let PROJECTS = { current: '', list: [] };

async function loadProjects() {
  try { PROJECTS = await api.get('/api/projects'); }
  catch (e) { PROJECTS = { current: '', list: [] }; }
  renderProjectSelect();
}
function renderProjectSelect() {
  const sel = $('#projectSel'); if (!sel) return;
  sel.innerHTML = (PROJECTS.list || []).map(p =>
    '<option value="' + esc(p.id) + '"' + (p.id === PROJECTS.current ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
}
async function reloadWorkspace() {
  await loadAll();
  editingVariant = null;
  renderDashboard();
  renderVersions();
  renderBlocks();
  renderMaterials();
  renderProfile();
  showView('dashboard');
}
async function switchProject(id) {
  if (!id || id === PROJECTS.current) return;
  try {
    PROJECTS = await api.post('/api/projects/switch', { id: id });
    await reloadWorkspace();
    renderProjectSelect();
    const p = (PROJECTS.list || []).find(x => x.id === id);
    toast('已切换到项目：' + (p ? p.name : ''));
  } catch (err) { toast('切换失败：' + err.message); }
}
function openNewProject() {
  modal(
    '<h3>新建个人项目</h3>' +
    '<p class="muted" style="margin:-8px 0 12px">每个项目保存一位求职者的完整数据：基础信息 / 素材块库 / 简历版本 / 投递记录，互相独立。</p>' +
    '<label>姓名（项目名）<input id="npName" placeholder="如：张三"></label>' +
    '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="npOk">创建并切换</button></div>'
  );
  $('#npOk').onclick = async () => {
    const name = $('#npName').value.trim();
    if (!name) { toast('请填写姓名'); return; }
    try {
      const r = await api.post('/api/projects', { name: name });
      closeModal();
      PROJECTS = r.info || (await api.get('/api/projects'));
      await reloadWorkspace();
      renderProjectSelect();
      showView('profile');
      toast('已创建项目「' + name + '」，去完善基础信息吧');
    } catch (err) { toast('创建失败：' + err.message); }
  };
}
function openProjectManager() {
  let renamingId = '';
  const m = modal(
    '<h3>项目管理</h3>' +
    '<p class="muted" style="margin:-8px 0 10px">可重命名或删除个人项目；当前项目不可删除。</p>' +
    '<div id="projList"></div>' +
    '<div class="modal-actions"><button class="btn" data-close>关闭</button></div>'
  );
  function renderList() {
    $('#projList', m).innerHTML = (PROJECTS.list || []).map(p => {
      if (p.id === renamingId) {
        return '<div class="snap-row" data-id="' + esc(p.id) + '">' +
          '<div class="grow"><input class="inp ren-input" style="width:100%" value="' + esc(p.name) + '" maxlength="40"></div>' +
          '<button class="btn tiny primary" data-rensave="' + esc(p.id) + '">保存</button>' +
          '<button class="btn tiny" data-rencancel="1">取消</button>' +
          '</div>';
      }
      return '<div class="snap-row" data-id="' + esc(p.id) + '">' +
        '<div class="grow"><div class="snap-name">' + esc(p.name) +
        (p.id === PROJECTS.current ? ' <span class="frozen">（当前）</span>' : '') +
        '</div><div class="snap-time">创建：' + esc(p.created || '') + '</div></div>' +
        '<button class="btn tiny" data-renproj="' + esc(p.id) + '">重命名</button>' +
        (p.id === PROJECTS.current ? '' : '<button class="btn tiny danger" data-delproj="' + esc(p.id) + '">删除</button>') +
        '</div>';
    }).join('');
    const inp = $('#projList .ren-input', m);
    if (inp) { inp.focus(); inp.select(); }
  }
  async function saveRename(id) {
    const inp = $('#projList .ren-input', m);
    const name = inp ? inp.value.trim() : '';
    if (!name) { toast('名称不能为空'); return; }
    try {
      await api.put('/api/projects/' + encodeURIComponent(id), { name: name });
      renamingId = '';
      await loadProjects();
      renderList();
      renderProjectSelect();
      toast('已重命名为「' + name + '」');
    } catch (err) { toast('重命名失败：' + err.message); }
  }
  renderList();
  m.addEventListener('click', async e => {
    const ren = e.target.closest('[data-renproj]');
    const save = e.target.closest('[data-rensave]');
    const cancel = e.target.closest('[data-rencancel]');
    const del = e.target.closest('[data-delproj]');
    if (ren) { renamingId = ren.dataset.renproj; renderList(); return; }
    if (cancel) { renamingId = ''; renderList(); return; }
    if (save) { await saveRename(save.dataset.rensave); return; }
    if (del) {
      const p = (PROJECTS.list || []).find(x => x.id === del.dataset.delproj);
      if (!confirm('删除项目「' + (p ? p.name : '') + '」？\n该项目的全部数据将被删除，不可恢复。')) return;
      try {
        const r = await fetch('/api/projects/' + encodeURIComponent(del.dataset.delproj), { method: 'DELETE' });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || ('HTTP ' + r.status)); }
        await loadProjects();
        renderList();
        renderProjectSelect();
        toast('项目已删除');
      } catch (err) { toast('删除失败：' + err.message); }
    }
  });
  m.addEventListener('keydown', e => {
    if (e.key === 'Enter' && renamingId) { e.preventDefault(); saveRename(renamingId); }
    if (e.key === 'Escape' && renamingId) { renamingId = ''; renderList(); }
  });
}

/* ---------------- 全局事件 ---------------- */
function bindEvents() {
  $$('.tab').forEach(t => t.onclick = () => showView(t.dataset.view));
  $('#aiResumeImport').onclick = openAiResumeImport;

  // 个人项目
  $('#projectSel').addEventListener('change', e => switchProject(e.target.value));
  $('#projectNew').onclick = openNewProject;
  $('#projectManage').onclick = openProjectManager;

  // 投递管理
  $('#addAppBtn').onclick = () => openAppModal(null);
  $('#appList').addEventListener('click', async e => {
    const open = e.target.closest('[data-openver]');
    const opensnap = e.target.closest('[data-opensnap]');
    const edit = e.target.closest('[data-editapp]');
    const dup = e.target.closest('[data-dupapp]');
    const del = e.target.closest('[data-delapp]');
    const step = e.target.closest('[data-setstatus]');
    if (open) { openEditor(open.dataset.openver); return; }
    if (opensnap) { window.open('/render/snap/' + opensnap.dataset.opensnap, '_blank'); return; }
    if (edit) { openAppModal(edit.dataset.editapp); return; }
    if (dup) { duplicateApplication(dup.dataset.dupapp); return; }
    if (step) {
      const a = DB.applications.find(x => x.id === step.dataset.setstatus);
      const st = step.dataset.status;
      if (a && a.status !== st) {
        const cur = STATUSES.indexOf(a.status);
        const next = STATUSES.indexOf(st);
        if (next < cur) {
          if (!confirm('进度回退：「' + a.status + '」→「' + st + '」？\n（各阶段已记录的时间会保留）')) return;
        }
        a.status = st;
        a.statusAt = a.statusAt || {};
        a.statusAt[st] = nowStamp();
        a.updated = today();
        await saveApps();
        renderDashboard();
        toast('进度已更新：' + st);
      }
      return;
    }
    if (del) {
      const a = DB.applications.find(x => x.id === del.dataset.delapp);
      if (a && confirm('删除投递记录「' + a.company + ' · ' + a.position + '」？')) {
        DB.applications = DB.applications.filter(x => x.id !== a.id);
        await saveApps(); renderDashboard();
      }
    }
  });

  // 简历版本
  $('#addVerBtn').onclick = openCreateVersion;
  $('#versionCategoryFilter').onchange = renderVersions;
  $('#verList').addEventListener('click', e => {
    const open = e.target.closest('[data-openver]');
    const snap = e.target.closest('[data-snapver]');
    const dup = e.target.closest('[data-dupver]');
    const category = e.target.closest('[data-categoryver]');
    const del = e.target.closest('[data-delver]');
    const md = e.target.closest('[data-mdver]');
    const pdfv = e.target.closest('[data-pdfver]');
    if (open) { openEditor(open.dataset.openver); return; }
    if (snap) { openSnapshotList(snap.dataset.snapver); return; }
    if (dup) { duplicateVersion(dup.dataset.dupver); return; }
    if (category) { openVersionCategory(category.dataset.categoryver); return; }
    if (del) { deleteVersion(del.dataset.delver); return; }
    if (md) { location.href = '/api/export/' + md.dataset.mdver + '.md'; return; }
    if (pdfv) { exportPdfFile('/api/export/' + pdfv.dataset.pdfver + '.pdf'); return; }
  });

  // 素材块库
  const typeSel = $('#blockTypeFilter');
  Object.keys(TYPES).forEach(k => {
    const o = document.createElement('option');
    o.value = k; o.textContent = TYPES[k].label;
    typeSel.appendChild(o);
  });
  typeSel.onchange = renderBlocks;
  $('#blockSearch').oninput = debounce(renderBlocks, 200);
  $('#addBlockBtn').onclick = () => openBlockModal(null);
  $('#batchCourseBtn').onclick = openBatchCourseModal;
  $('#blockList').addEventListener('click', e => {
    const edit = e.target.closest('[data-editblock]');
    const dup = e.target.closest('[data-dupblock]');
    const del = e.target.closest('[data-delblock]');
    const toggle = e.target.closest('[data-toggle-group]');
    const add = e.target.closest('[data-addblock]');
    if (edit) { openBlockModal(edit.dataset.editblock); return; }
    if (dup) { duplicateBlock(dup.dataset.dupblock); return; }
    if (del) { deleteBlock(del.dataset.delblock); return; }
    if (toggle) {
      const g = toggle.dataset.toggleGroup;
      collapsedGroups[g] = collapsedGroups[g] !== true;
      renderBlocks();
      return;
    }
    if (add) { openBlockModal(null, add.dataset.addblock); return; }
    const card = e.target.closest('.block-card');
    if (card && card.dataset.id) openBlockModal(card.dataset.id);
  });

  // 个人材料
  const matCatSel = $('#materialCategoryFilter');
  MATERIAL_CATEGORIES.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    matCatSel.appendChild(o);
  });
  matCatSel.onchange = () => { renderMaterials(); updateMaterialDropHint(); };
  $('#materialSearch').oninput = debounce(renderMaterials, 200);
  $('#addMaterialBtn').onclick = () => openMaterialModal(null);
  bindMaterialDropEvents();
  $('#materialList').addEventListener('click', e => {
    const open = e.target.closest('[data-matopen]');
    const dl = e.target.closest('[data-matdl]');
    const rename = e.target.closest('[data-matrename]');
    const edit = e.target.closest('[data-matedit]');
    const del = e.target.closest('[data-matdel]');
    if (open) {
      const m = (DB.materials || []).find(x => x.id === open.dataset.matopen);
      if (m) window.open(materialUrl(m), '_blank');
      return;
    }
    if (dl) {
      const m = (DB.materials || []).find(x => x.id === dl.dataset.matdl);
      if (m) {
        const a = document.createElement('a');
        a.href = materialUrl(m);
        a.download = materialDownloadName(m);
        document.body.appendChild(a); a.click();
        setTimeout(() => a.remove(), 500);
      }
      return;
    }
    if (rename) { openMaterialRename(rename.dataset.matrename); return; }
    if (edit) { openMaterialModal(edit.dataset.matedit); return; }
    if (del) { deleteMaterial(del.dataset.matdel); return; }
  });

  bindProfileEvents();
  bindSectionList();
  bindEditorBar();

  // 数据导入导出
  $('#exportAll').onclick = async () => {
    const all = await api.get('/api/workspace');
    download('moduleResume-data-' + today() + '.json', JSON.stringify(all, null, 2));
    toast('已导出全部数据');
  };
  $('#importAll').onclick = () => $('#importFile').click();
  $('#importFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const obj = JSON.parse(rd.result);
        if (!obj || !obj.profile || !Array.isArray(obj.blocks)) throw new Error('数据格式不正确');
        if (!confirm('导入将覆盖当前全部数据，确定继续？')) return;
        await api.put('/api/workspace', obj);
        await loadAll();
        renderDashboard(); renderVersions(); renderBlocks(); renderProfile();
        toast('导入成功');
      } catch (err) { alert('导入失败：' + err.message); }
    };
    rd.readAsText(f, 'utf-8');
    e.target.value = '';
  };

  // 重启软件
  $('#restartApp').onclick = restartApplication;

  // Ctrl+S 保存（编辑器内）
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && $('#view-editor').classList.contains('active')) {
      e.preventDefault(); saveEditor(false);
    }
  });
}

/* ---------------- 重启软件 ---------------- */
let restartPending = false;

/* 重启前把仍在防抖队列里的编辑立即落盘 */
async function flushBeforeRestart() {
  const bmOk = $('#bmOk');
  if (bmOk && typeof bmOk.onclick === 'function') await bmOk.onclick();
  if (typeof applyStyleChange.flush === 'function') await applyStyleChange.flush();
  if (typeof autosaveEditor.flush === 'function') await autosaveEditor.flush();
  if (typeof saveProfile.flush === 'function') await saveProfile.flush();
  if (editingVariant && $('#view-editor').classList.contains('active')) await saveEditor(true);
}

function showRestartOverlay() {
  const el = $('#restartOverlay');
  if (!el) return;
  el.hidden = false;
  const hint = $('#restartHint');
  if (hint) hint.textContent = '正在保存编辑并重新启动，请稍候。';
  const reload = $('#restartReload');
  if (reload) reload.hidden = true;
  const spinner = $('.restart-spinner', el);
  if (spinner) spinner.hidden = false;
}

/* 等待新进程接管端口：started 变化才算真正重启完成 */
function waitForServerRestart(prevStarted) {
  const deadline = Date.now() + 45000;
  let sawDown = false;
  return new Promise(resolve => {
    const tick = async () => {
      try {
        const r = await fetch('/api/health', { cache: 'no-store' });
        if (r.ok) {
          const h = await r.json();
          if (h && h.ok) {
            const changed = prevStarted ? String(h.started) !== String(prevStarted) : sawDown;
            if (changed) { resolve(true); return; }
          }
        } else {
          sawDown = true;
        }
      } catch (e) { sawDown = true; }
      if (Date.now() > deadline) { resolve(false); return; }
      setTimeout(tick, 400);
    };
    setTimeout(tick, 500);
  });
}

async function restartApplication() {
  if (restartPending) return;
  if (!confirm('重启软件会重新启动当前程序，桌面窗口将关闭后重新打开。\n当前编辑会先自动保存，确定继续？')) return;
  restartPending = true;
  const btn = $('#restartApp');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 正在重启…'; }
  let prevStarted = '';
  try {
    const h = await api.get('/api/health');
    prevStarted = h && h.started ? String(h.started) : '';
  } catch (e) { /* 取不到旧启动标识时退回“先断开再连上”的判断 */ }
  try {
    await flushBeforeRestart();
  } catch (err) {
    restartPending = false;
    if (btn) { btn.disabled = false; btn.textContent = '🔄 重启软件'; }
    alert('保存当前编辑失败，已取消重启：\n' + (err && err.message ? err.message : err));
    return;
  }
  showRestartOverlay();
  let mode = '';
  try {
    const r = await fetch('/api/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    mode = (data && data.mode) || '';
  } catch (err) {
    /* 服务开始退出时连接可能被中断，继续等待恢复；明确的 4xx 才视为失败 */
    if (err && /^HTTP 4\d\d$/.test(err.message || '')) {
      restartPending = false;
      if (btn) { btn.disabled = false; btn.textContent = '🔄 重启软件'; }
      const overlay = $('#restartOverlay'); if (overlay) overlay.hidden = true;
      alert('重启失败：' + err.message);
      return;
    }
  }
  /* Electron 桌面版：旧窗口随进程退出，主进程会自动打开新窗口 */
  if (mode === 'electron') {
    setTimeout(() => {
      restartPending = false;
      if (btn) { btn.disabled = false; btn.textContent = '🔄 重启软件'; }
      const hint = $('#restartHint');
      if (hint) hint.textContent = '重启未完成。请关闭本窗口后重新打开 moduleResume。';
      const spinner = $('#restartOverlay .restart-spinner');
      if (spinner) spinner.hidden = true;
    }, 10000);
    return;
  }
  const ok = await waitForServerRestart(prevStarted);
  if (ok) { location.reload(); return; }
  restartPending = false;
  if (btn) { btn.disabled = false; btn.textContent = '🔄 重启软件'; }
  const hint = $('#restartHint');
  if (hint) hint.textContent = '等待服务恢复超时。可点击下方按钮重试，或手动重新打开 moduleResume。';
  const spinner = $('#restartOverlay .restart-spinner');
  if (spinner) spinner.hidden = true;
  const reload = $('#restartReload');
  if (reload) { reload.hidden = false; reload.onclick = () => location.reload(); }
}

/* ---------------- 启动 ---------------- */
async function loadAll() {
  DB = await api.get('/api/workspace');
}

window.addEventListener('resize', debounce(() => {
  if ($('#view-editor') && $('#view-editor').classList.contains('active')) refreshPreview();
}, 400));

async function init() {
  try {
    const health = await api.get('/api/health');
    if (health.version) $('#appVersion').textContent = 'v' + health.version;
  } catch (e) { /* 版本信息不可用时不影响主界面 */ }
  try {
    await loadAll();
  } catch (err) {
    document.body.innerHTML = '<div style="padding:60px;font-family:sans-serif">无法连接 moduleResume 服务：' + err.message + '</div>';
    return;
  }
  try { THEMES = await api.get('/api/themes'); }
  catch (e) { THEMES = [{ id: 'theme-navy', name: '藏青学术' }]; }
  bindEvents();
  await loadProjects();
  renderDashboard();
  renderVersions();
  renderBlocks();
  renderMaterials();
  renderProfile();
  showView('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
