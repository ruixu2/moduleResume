'use strict';
// Run with: node --test scripts/test_courses.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderVariantHtml, renderMarkdown, renderPage } = require('../backend/render');
const { normalizeResult, buildImport } = require('../backend/resume-ai');
const { SEED } = require('../backend/seed');

const course = {
  id: 'course', type: 'course', title: '机器学习',
  content: {
    organization: '示例大学', courseType: '专业必修', dates: '2024.09 – 2024.12',
    credits: '3 学分 / 48 学时', score: '92',
    desc: '监督学习、无监督学习与模型评估，完成课程项目。',
  },
};
const variant = {
  sections: [{ title: '学习课程', kind: 'courses', items: [{ bid: course.id, ov: {} }] }],
};

test('course appears in all resume formats with every field', () => {
  for (const render of [renderVariantHtml, renderMarkdown, renderPage]) {
    const output = render({}, [course], variant);
    for (const value of ['机器学习', '开课单位：示例大学', '专业必修', '2024.09 – 2024.12', '学分/学时：3 学分 / 48 学时', '成绩：92', '监督学习、无监督学习与模型评估']) {
      assert.ok(output.includes(value), value);
    }
  }
});

test('version overrides change only the selected course version', () => {
  const custom = structuredClone(variant);
  custom.sections[0].items[0].ov = {
    title: '机器学习（岗位定制）',
    content: { score: '95', desc: '只保留与当前岗位相关的课程内容。' },
  };
  const html = renderVariantHtml({}, [course], custom);
  assert.ok(html.includes('机器学习（岗位定制）'));
  assert.ok(html.includes('成绩：95'));
  assert.ok(html.includes('只保留与当前岗位相关的课程内容'));
  assert.ok(!html.includes('成绩：92'));
  assert.ok(renderVariantHtml({}, [course], variant).includes('成绩：92'));
  assert.deepEqual(course.content, {
    organization: '示例大学', courseType: '专业必修', dates: '2024.09 – 2024.12',
    credits: '3 学分 / 48 学时', score: '92',
    desc: '监督学习、无监督学习与模型评估，完成课程项目。',
  });
});

test('optional fields, escaping and empty sections are handled', () => {
  const minimal = { ...course, title: '课程 A&B', content: { organization: '<示例大学>', desc: '<script>bad</script>' } };
  const minimalVariant = { sections: [{ title: '学习课程', kind: 'courses', items: [{ bid: 'course', ov: {} }] }] };
  const html = renderVariantHtml({}, [minimal], minimalVariant);
  assert.ok(html.includes('课程 A&amp;B'));
  assert.ok(html.includes('&lt;示例大学&gt;'));
  assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(!html.includes('undefined'));

  const empty = { sections: [{ title: '学习课程', kind: 'courses', items: [] }] };
  assert.ok(!renderMarkdown({}, [], empty).includes('## 学习课程'));
});

test('seed includes a course block and a course section', () => {
  const seeded = SEED.blocks.find(b => b.type === 'course');
  assert.ok(seeded);
  const demo = SEED.variants.find(v => v.sections.some(s => s.kind === 'courses'));
  assert.ok(demo);
  assert.ok(renderMarkdown(SEED.profile, SEED.blocks, demo).includes(seeded.title));
});

test('AI extraction keeps course fields and creates a course section', () => {
  const selected = normalizeResult({ profile: {}, blocks: [{
    type: 'course', title: '最优化方法',
    content: { organization: '示例大学', courseType: '专业选修', dates: '2023.02 – 2023.06', credits: '2 学分', score: '优秀', desc: '凸优化与数值实现', extra: '丢弃' },
  }] });
  assert.equal(selected.blocks[0].content.extra, undefined);
  assert.equal(selected.blocks[0].content.score, '优秀');
  const result = buildImport({ ...selected, createVersion: true, versionName: '课程测试' },
    { profile: {}, blocks: [], variants: [] }, '2026-11-05');
  const section = result.variants[0].sections.find(s => s.kind === 'courses');
  assert.ok(section);
  assert.equal(section.title, '学习课程');
  assert.equal(section.items.length, 1);
  assert.ok(renderMarkdown(result.profile, result.blocks, result.variants[0]).includes('最优化方法'));
});
