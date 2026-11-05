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

  function splitLine(line) {
    return (line.indexOf('\t') >= 0 ? line.split('\t') : line.split(/[|｜]/))
      .map(s => s.trim().replace(/^["']|["']$/g, ''));
  }

  /* 每行一门：课程名称 | 开课单位 | 课程类型 | 学习时间 | 学分/学时 | 成绩 | 课程内容与收获
     支持 | / ｜ / 制表符分隔；空行和 # 开头的注释行会忽略；首个表头行会跳过。 */
  function parse(text) {
    const rows = [];
    let first = true;
    for (const raw of String(text == null ? '' : text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const cells = splitLine(line);
      if (first && HEADER.test(cells[0] || '')) { first = false; continue; }
      first = false;
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
      if (rows.length >= MAX_COURSES) break;
    }
    return rows;
  }

  return { parse, MAX_COURSES };
});
