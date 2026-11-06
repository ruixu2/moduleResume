/* moduleResume · 学习课程批量输入解析（浏览器与 Node 测试共用） */
'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CourseBatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_COURSES = 200;
  const LIMITS = [500, 200, 100, 100, 100, 100, 10000];
  const HEADER = /^(课程名称|课程名|课程|course(?:\s*name)?)\s*[\*＊]?$/i;

  function cleanCell(value) {
    return String(value == null ? '' : value).trim().replace(/^["']|["']$/g, '');
  }

  function looksLikeHeader(line) {
    const tabCells = line.split('\t').map(cleanCell);
    if (tabCells.length >= 2 && tabCells.some(c => HEADER.test(c)) &&
        tabCells.some(c => /^(开课单位|课程类型|学习时间|学分|成绩|课程内容)/.test(c))) return true;
    const pipeCells = line.split(/[|｜]/).map(cleanCell);
    if (pipeCells.length >= 3 && HEADER.test(pipeCells[0] || '') &&
        pipeCells.some(c => /^(开课单位|课程类型|学习时间|学分|成绩|课程内容)/.test(c))) return true;
    return false;
  }

  /* 多门课程用 Tab 或换行分隔；同一门课程的字段用 | / ｜ 分隔。
     字段顺序：课程名称 | 开课单位 | 课程类型 | 学习时间 | 学分/学时 | 成绩 | 课程内容与收获。
     空行和 # 开头的注释行会忽略；首个表头行会跳过。直接粘贴 Excel 的 Tab 分隔内容即可。 */
  function parse(text) {
    const rows = [];
    let first = true;
    for (const rawLine of String(text == null ? '' : text).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      if (first && looksLikeHeader(line)) { first = false; continue; }
      first = false;
      const entries = line.split('\t').map(cleanCell).filter(Boolean);
      for (const entry of entries) {
        const cells = entry.split(/[|｜]/).map(cleanCell);
        const title = cells[0] || '';
        if (!title) continue;
        const value = i => String(cells[i] == null ? '' : cells[i]).slice(0, LIMITS[i]);
        rows.push({
          title: value(0),
          organization: value(1),
          courseType: value(2),
          dates: value(3),
          credits: value(4),
          score: value(5),
          desc: cells.slice(6).map(s => String(s || '').trim()).filter(Boolean).join(' ｜ ').slice(0, LIMITS[6]),
        });
        if (rows.length >= MAX_COURSES) return rows;
      }
    }
    return rows;
  }

  return { parse, MAX_COURSES };
});
