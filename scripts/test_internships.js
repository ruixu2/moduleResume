'use strict';
// Run with: node --test scripts/test_internships.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderVariantHtml, renderMarkdown, renderPage } = require('../backend/render');
const { SEED } = require('../backend/seed');

const block = {
  id: 'intern', type: 'internship', title: '',
  content: {
    company: '示例公司', position: '算法实习生', department: '研发部', location: '上海',
    start: '2025-06', end: '2025-09', works: ['模型优化：完成实验验证', '整理交付文档'],
  },
};
const variant = {
  intent: '算法工程师',
  sections: [{ title: '实习经历', kind: 'internships', items: [{ bid: block.id, ov: {} }] }],
};
const clone = value => JSON.parse(JSON.stringify(value));

test('HTML and Markdown include identity, dates, metadata and all contributions', () => {
  const html = renderVariantHtml({}, [block], variant);
  const md = renderMarkdown({}, [block], variant);
  for (const result of [html, md]) {
    for (const text of ['示例公司 · 算法实习生', '研发部', '上海', '2025.06 – 2025.09', '完成实验验证', '整理交付文档']) {
      assert.ok(result.includes(text), text);
    }
  }
  assert.ok(html.includes('<b>模型优化</b>：完成实验验证'));
  assert.ok(md.includes('- **模型优化**：完成实验验证'));
  assert.ok(renderPage({}, [block], variant).includes(html));
});

test('version overrides replace fields and contributions without changing the source', () => {
  const source = clone(block);
  const customized = clone(variant);
  customized.sections[0].items[0].ov = {
    title: '业务算法实践', content: { position: '数据实习生', end: '', works: ['成果：交付分析报告'] },
  };
  for (const render of [renderVariantHtml, renderMarkdown]) {
    const result = render({}, [block], customized);
    assert.ok(result.includes('业务算法实践'));
    assert.ok(result.includes('示例公司 · 数据实习生'));
    assert.ok(result.includes('2025.06 – 至今'));
    assert.ok(result.includes('交付分析报告'));
    assert.ok(!result.includes('完成实验验证'));
  }
  assert.deepEqual(block, source);
});

test('unfinished and blank entries render without fabricated dates or empty bullet lists', () => {
  const ongoing = clone(block);
  ongoing.content.end = '';
  assert.ok(renderMarkdown({}, [ongoing], variant).includes('2025.06 – 至今'));
  assert.ok(renderMarkdown({}, [ongoing], { ...variant, locale: 'en' }).includes('2025.06 – Present'));
  const blank = { id: block.id, type: 'internship', content: {} };
  const html = renderVariantHtml({}, [blank], variant);
  assert.ok(!html.includes('undefined'));
  assert.ok(!html.includes('至今'));
  assert.ok(!html.includes('<ul class="bullets">'));
});

test('HTML escapes internship fields and skips deleted references', () => {
  const unsafe = clone(block);
  unsafe.title = '<script>alert(1)</script>';
  unsafe.content.company = 'A&B';
  unsafe.content.works = ['<img src=x onerror=alert(1)>'];
  const html = renderVariantHtml({}, [unsafe], variant);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A&amp;B'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!renderMarkdown({}, [], variant).includes('## 实习经历'));
});

test('seed variants and frozen copies preserve internship rendering', () => {
  const demo = SEED.variants.find(v => v.sections.some(s => s.kind === 'internships'));
  assert.ok(demo);
  const frozenBlocks = clone(SEED.blocks);
  const frozenVariant = clone(demo);
  const before = renderMarkdown(SEED.profile, frozenBlocks, frozenVariant);
  assert.ok(before.includes('算法实习生'));
  const edited = clone(SEED.blocks);
  edited.find(b => b.type === 'internship').content.position = '修改后的岗位';
  assert.ok(renderMarkdown(SEED.profile, edited, demo).includes('修改后的岗位'));
  assert.equal(renderMarkdown(SEED.profile, frozenBlocks, frozenVariant), before);
});
