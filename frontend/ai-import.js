/* 简历提取：文件在本机转成文字，外发和导入均由用户确认。 */
'use strict';

const AI_PROFILE_LABELS = {
  name: '姓名', gender: '性别', birth: '出生年月', hometown: '籍贯', political: '政治面貌', ethnicity: '民族',
  phone: '电话', email: '邮箱', location: '现居地', wechat: '微信', website: '个人主页',
};
const AI_FIELD_LABELS = {
  text: '内容', start: '开始年月', end: '结束年月', dates: '时间', school: '学校', college: '学院',
  major: '专业', degreeType: '学历 / 学位', advisor: '导师', name: '姓名', relationship: '培养关系',
  academicTitle: '职称', position: '职位', organization: '机构 / 单位', research: '研究方向', contact: '联系方式',
  homepage: '主页', brief: '简介', works: '主要工作（每行一条）', source: '项目来源', projType: '项目类型',
  funding: '经费 / 编号', work: '项目工作', company: '公司', department: '部门', location: '地点', desc: '说明',
  level: '级别', rank: '等级', date: '日期', recipient: '身份 / 排名', note: '备注', journal: '期刊',
  volume: '卷期页码', partition: '分区', impactFactor: '影响因子', authors: '作者', status: '状态',
  targetJournal: '拟投 / 投稿期刊', lines: '内容（每行一条）',
};

let mammothLoading;
function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!mammothLoading) mammothLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/static/vendor/mammoth.browser.js';
    script.onload = () => window.mammoth ? resolve(window.mammoth) : reject(new Error('Word 解析组件加载失败。'));
    script.onerror = () => reject(new Error('Word 解析组件缺失，请先在项目目录运行 npm install。'));
    document.head.appendChild(script);
  }).catch(e => { mammothLoading = null; throw e; });
  return mammothLoading;
}

async function readResumeFile(file) {
  if (!file || file.size > 10 * 1024 * 1024) throw new Error('请选择不超过 10 MB 的简历文件。');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'txt' || ext === 'md') return file.text();
  if (ext === 'docx') {
    const mammoth = await loadMammoth();
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (ext === 'pdf') {
    let pdfjs;
    try { pdfjs = await import('/static/vendor/pdf.min.mjs'); }
    catch (_) { throw new Error('PDF 解析组件缺失，请先在项目目录运行 npm install。'); }
    pdfjs.GlobalWorkerOptions.workerSrc = '/static/vendor/pdf.worker.min.mjs';
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false,
      cMapUrl: '/static/vendor/cmaps/', cMapPacked: true, standardFontDataUrl: '/static/vendor/standard_fonts/' });
    let doc;
    try {
      doc = await task.promise;
      if (doc.numPages > 80) throw new Error('PDF 超过 80 页，请拆分后再导入。');
      const pages = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join(''));
      }
      return pages.join('\n\n');
    } finally {
      if (doc) await doc.destroy();
      else await task.destroy();
    }
  }
  throw new Error('请选择 PDF、DOCX、TXT 或 Markdown 文件。');
}

async function aiRequest(path, payload, signal) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal });
  let data;
  try { data = await response.json(); } catch (_) { throw new Error('服务返回了无法读取的响应。'); }
  if (!response.ok) throw new Error(data.error || ('请求失败（HTTP ' + response.status + '）'));
  return data;
}

function openAiResumeImport() {
  const state = { endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: '', text: '',
    projectId: PROJECTS.current, baseline: deepClone(DB.profile || {}), result: null, controller: null };
  if (!state.projectId) { toast('请先选择个人项目'); return; }
  const project = (PROJECTS.list || []).find(p => p.id === state.projectId);
  const projectName = project ? project.name : '当前项目';

  function showInput() {
    const m = modal('<h3>✨ AI 提取简历信息</h3>' +
      '<p class="ai-explain">导入到「' + esc(projectName) + '」。先在本机读取文件并检查文字，确认后才发送给所选模型；提取结果还需再次确认才会保存。</p>' +
      '<label>选择简历文件（可选）<input id="aiFile" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"></label>' +
      '<p class="muted ai-hint">支持可复制文字的 PDF、DOCX、TXT 和 Markdown（≤10 MB）；扫描件需先 OCR，或直接粘贴文字。</p>' +
      '<label>简历文字（可直接编辑或删去不想发送的信息）<textarea id="aiText" rows="9" maxlength="80000" placeholder="选择文件，或将简历文字粘贴在这里"></textarea></label>' +
      '<div class="grid2"><label>模型 API 地址<input id="aiEndpoint" placeholder="https://…/v1"></label>' +
      '<label>模型名称<input id="aiModel" placeholder="如 deepseek-chat"></label></div>' +
      '<label>API Key（本机模型可留空）<input id="aiKey" type="password" autocomplete="off" placeholder="不会保存到项目数据"></label>' +
      '<p class="muted ai-hint">支持 Chat Completions 兼容接口。Key 只用于本次请求；外部服务可能按其规则处理信息并计费。</p>' +
      '<div id="aiStatus" class="ai-status" role="status"></div>' +
      '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="aiExtract">确认发送并提取</button></div>');
    const get = s => m.querySelector(s);
    get('#aiEndpoint').value = state.endpoint;
    get('#aiModel').value = state.model;
    get('#aiKey').value = state.apiKey;
    get('#aiText').value = state.text;
    modalCloseHook = () => { if (state.controller) state.controller.abort(); state.apiKey = ''; };
    get('#aiFile').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const status = get('#aiStatus');
      status.textContent = '正在本机读取文件…';
      get('#aiExtract').disabled = true;
      try {
        const text = (await readResumeFile(file)).trim();
        if (!m.isConnected) return;
        if (!text) throw new Error('文件中没有可提取的文字；扫描版 PDF 请先 OCR，或粘贴文字。');
        if (text.length > 80000) throw new Error('提取的文字超过 8 万字，请拆分文件或精简后粘贴。');
        get('#aiText').value = text;
        status.textContent = '已读取 ' + text.length + ' 字，请检查并按需删除敏感内容。';
      } catch (err) { if (m.isConnected) status.textContent = '读取失败：' + err.message; }
      finally { if (m.isConnected) get('#aiExtract').disabled = false; e.target.value = ''; }
    };
    get('#aiExtract').onclick = async () => {
      state.endpoint = get('#aiEndpoint').value.trim();
      state.model = get('#aiModel').value.trim();
      state.apiKey = get('#aiKey').value.trim();
      state.text = get('#aiText').value.trim();
      const status = get('#aiStatus');
      if (!state.endpoint || !state.model || !state.text) { status.textContent = '请填写简历文字、模型地址和模型名称。'; return; }
      let destination;
      try { destination = new URL(state.endpoint).origin; }
      catch (_) { status.textContent = '模型 API 地址无效。'; return; }
      if (!confirm('将把文本框中的 ' + state.text.length + ' 字及提取指令发送至：\n' + destination +
        '\n\n请确认已删除不希望发送的信息，并了解该服务的隐私与费用规则。继续吗？')) return;
      state.controller = new AbortController();
      get('#aiExtract').disabled = true;
      status.textContent = '正在提取，请稍候…';
      try {
        state.result = await aiRequest('/api/ai/extract', { endpoint: state.endpoint, model: state.model,
          apiKey: state.apiKey, text: state.text }, state.controller.signal);
        state.controller = null;
        state.apiKey = '';
        if (m.isConnected) showReview();
      } catch (err) {
        state.controller = null;
        if (m.isConnected) { status.textContent = '提取失败：' + err.message; get('#aiExtract').disabled = false; }
      }
    };
  }

  function showReview() {
    const profiles = Object.entries(state.result.profile || {});
    const blocks = state.result.blocks || [];
    let html = '<h3>核对提取结果</h3><p class="ai-explain">导入到「' + esc(projectName) + '」。请逐项核对或修改；只写入勾选项，已有素材不会被覆盖。</p>';
    html += '<h4 class="ai-review-heading">基础信息（' + profiles.length + ' 项）</h4>';
    if (!profiles.length) html += '<p class="muted">没有识别到基础信息。</p>';
    for (const [key, value] of profiles) {
      const current = String(state.baseline[key] || '');
      const checked = !current ? ' checked' : '';
      html += '<div class="ai-profile-row"><label class="ai-check"><input type="checkbox" data-ai-profile="' + esc(key) + '"' + checked + '>' +
        esc(AI_PROFILE_LABELS[key] || key) + '</label><input data-ai-profile-value="' + esc(key) + '" value="' + esc(value) + '">' +
        (current ? '<div class="muted">当前：' + esc(current) + '（勾选后替换）</div>' : '') + '</div>';
    }
    html += '<h4 class="ai-review-heading">素材（' + blocks.length + ' 项）</h4>';
    if (!blocks.length) html += '<p class="muted">没有识别到素材。</p>';
    blocks.forEach((block, index) => {
      const label = (TYPES[block.type] || {}).label || block.type;
      html += '<details class="ai-block" data-ai-block="' + index + '"><summary><label class="ai-check" onclick="event.stopPropagation()">' +
        '<input type="checkbox" data-ai-selected checked> ' + esc(label) + ' · ' + esc(block.title || block.content.school || block.content.company || block.content.text || '未命名素材') + '</label>' +
        '<span class="muted">展开核对 / 修改</span></summary>' +
        '<label>标题<input data-ai-key="title" value="' + esc(block.title || '') + '"></label>' +
        '<label>分组<input data-ai-key="group" value="' + esc(block.group || '') + '"></label>' +
        '<label>标签（逗号分隔）<input data-ai-key="tags" value="' + esc((block.tags || []).join(', ')) + '"></label>';
      for (const [key, value] of Object.entries(block.content || {})) {
        const val = Array.isArray(value) ? value.join('\n') : String(value);
        html += '<label>' + esc(AI_FIELD_LABELS[key] || key) + '<textarea data-ai-field="' + esc(key) + '" rows="' + (Array.isArray(value) || val.length > 100 ? 3 : 1) + '">' + esc(val) + '</textarea></label>';
      }
      html += '</details>';
    });
    html += '<label class="ai-check ai-create-version"><input type="checkbox" id="aiCreateVersion" checked> 同时创建包含所选素材的简历版本</label>' +
      '<label>新版本名称<input id="aiVersionName" value="简历导入 ' + esc(today()) + '"></label>' +
      '<div id="aiStatus" class="ai-status" role="status"></div>' +
      '<div class="modal-actions"><button class="btn" id="aiBack">返回修改</button><button class="btn" data-close>取消</button>' +
      '<button class="btn primary" id="aiApply">确认导入所选内容</button></div>';
    const m = modal(html);
    modalCloseHook = () => { if (state.controller) state.controller.abort(); state.apiKey = ''; };
    m.querySelector('#aiBack').onclick = showInput;
    m.querySelector('#aiApply').onclick = async () => {
      const profile = {}, expectedProfile = {};
      m.querySelectorAll('[data-ai-profile]:checked').forEach(el => {
        const key = el.dataset.aiProfile;
        const value = m.querySelector('[data-ai-profile-value="' + key + '"]').value.trim();
        if (value) { profile[key] = value; expectedProfile[key] = state.baseline[key] || ''; }
      });
      const selectedBlocks = [];
      m.querySelectorAll('[data-ai-block]').forEach(el => {
        if (!el.querySelector('[data-ai-selected]').checked) return;
        const source = blocks[Number(el.dataset.aiBlock)];
        const content = {};
        el.querySelectorAll('[data-ai-field]').forEach(input => {
          const key = input.dataset.aiField;
          content[key] = Array.isArray(source.content[key]) ? input.value.split('\n').map(s => s.trim()).filter(Boolean) : input.value.trim();
        });
        selectedBlocks.push({ type: source.type, title: el.querySelector('[data-ai-key="title"]').value,
          group: el.querySelector('[data-ai-key="group"]').value,
          tags: el.querySelector('[data-ai-key="tags"]').value.split(/[,，]/).map(s => s.trim()).filter(Boolean), content });
      });
      const status = m.querySelector('#aiStatus');
      if (!Object.keys(profile).length && !selectedBlocks.length) { status.textContent = '请至少勾选一项要导入的信息。'; return; }
      const button = m.querySelector('#aiApply');
      button.disabled = true; status.textContent = '正在保存…';
      try {
        const result = await aiRequest('/api/ai/import', { projectId: state.projectId, profile, expectedProfile,
          blocks: selectedBlocks, createVersion: m.querySelector('#aiCreateVersion').checked,
          versionName: m.querySelector('#aiVersionName').value });
        await loadAll();
        renderVersions(); renderBlocks(); renderProfile();
        closeModal();
        if (result.versionId) openEditor(result.versionId); else showView('blocks');
        toast('已导入 ' + result.importedProfileFields + ' 项基础信息、' + result.importedBlocks + ' 条素材');
      } catch (err) { if (m.isConnected) { status.textContent = '导入失败：' + err.message; button.disabled = false; } }
    };
  }
  showInput();
}
