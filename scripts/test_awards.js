'use strict';
// Run with: node --test scripts/test_awards.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderVariantHtml, renderMarkdown, renderPage } = require('../backend/render');
const { SEED } = require('../backend/seed');

const award = {
  id: 'award', type: 'award', title: '示例创新竞赛',
  content: { level: '国家级', rank: '一等奖', date: '2025.10', organization: '示例协会', recipient: '团队负责人', desc: '负责建模与答辩，完成算法验证。' },
};
const variant = { sections: [{ title: '获奖经历', kind: 'awards', items: [{ bid: award.id, ov: {} }] }] };

test('award exports preserve every field and referenced order', () => {
  const second = { ...award, id: 'second', title: '第二项荣誉', content: {} };
  const ordered = structuredClone(variant);
  ordered.sections[0].items.push({ bid: second.id });
  for (const render of [renderVariantHtml, renderMarkdown, renderPage]) {
    const result = render({}, [award, second], ordered);
    for (const text of [award.title, ...Object.values(award.content), second.title]) assert.ok(result.includes(text), text);
    assert.ok(result.indexOf(award.title) < result.indexOf(second.title));
  }
});

test('version customization changes only the selected resume', () => {
  const original = structuredClone(award);
  const customized = structuredClone(variant);
  customized.sections[0].items[0].ov = { title: '定制奖项名称', content: { rank: '金奖', desc: '定制贡献说明' } };
  for (const render of [renderVariantHtml, renderMarkdown]) {
    const result = render({}, [award], customized);
    assert.ok(result.includes('定制奖项名称'));
    assert.ok(result.includes('金奖'));
    assert.ok(result.includes('定制贡献说明'));
    assert.ok(!result.includes('一等奖'));
    assert.ok(render({}, [award], variant).includes('一等奖'));
  }
  assert.deepEqual(award, original);
});

test('optional fields, deleted references and empty sections render cleanly', () => {
  const minimal = { id: award.id, type: 'award', title: '优秀学生', content: {} };
  const html = renderVariantHtml({}, [minimal], variant);
  assert.ok(html.includes('<h3>优秀学生</h3>'));
  assert.ok(!html.includes('proj-meta'));
  assert.ok(!html.includes('undefined'));
  assert.ok(!renderMarkdown({}, [], variant).includes('## 获奖经历'));
  assert.ok(renderMarkdown({}, [{ ...minimal, title: '' }], { ...variant, locale: 'en' }).includes('### Award'));
});

test('HTML escapes award title, metadata and description', () => {
  const unsafe = { ...award, title: '<script>alert(1)</script>', content: { organization: 'A&B', desc: '<img src=x onerror=alert(1)>' } };
  const html = renderVariantHtml({}, [unsafe], variant);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A&amp;B'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
});

test('fresh installs include a generic award and a working section', () => {
  const demo = SEED.variants.find(v => v.sections.some(s => s.kind === 'awards'));
  const seededAward = SEED.blocks.find(b => b.type === 'award');
  assert.ok(demo && seededAward);
  assert.ok(renderMarkdown(SEED.profile, SEED.blocks, demo).includes(seededAward.title));
});
