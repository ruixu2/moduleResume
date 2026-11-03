'use strict';
// Run with: node --test scripts/test_academic_service.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderVariantHtml, renderMarkdown, renderPage } = require('../backend/render');

const service = { id: 'service', type: 'academic_service', title: '', content: {
  organization: '示例期刊', position: '审稿人', start: '2022-05', end: '', desc: '负责稿件评审。',
} };
const variant = { sections: [{ title: '学术兼职', kind: 'academic_services', items: [{ bid: service.id, ov: {} }] }] };

test('academic service appears in all resume formats with ongoing dates', () => {
  for (const render of [renderVariantHtml, renderMarkdown, renderPage]) {
    const output = render({}, [service], variant);
    for (const value of ['示例期刊', '审稿人', '2022.05', '至今', '负责稿件评审']) assert.ok(output.includes(value), value);
  }
});

test('version overrides preserve source and support clearing the end date', () => {
  const original = { ...service, content: { ...service.content, end: '2024-06' } };
  const custom = structuredClone(variant);
  custom.sections[0].items[0].ov = { title: '期刊审稿工作', content: { position: '编委', end: '' } };
  for (const render of [renderVariantHtml, renderMarkdown]) {
    const output = render({}, [original], custom);
    assert.ok(output.includes('期刊审稿工作'));
    assert.ok(output.includes('编委'));
    assert.ok(output.includes('至今'));
    assert.ok(!output.includes('2024.06'));
    assert.ok(render({}, [original], variant).includes('2024.06'));
  }
});

test('optional fields and HTML escaping are handled', () => {
  const minimal = { ...service, content: { organization: 'A&B', position: '<审稿人>', desc: '<script>bad</script>', end: '2024-01' } };
  const html = renderVariantHtml({}, [minimal], variant);
  assert.ok(html.includes('A&amp;B'));
  assert.ok(html.includes('&lt;审稿人&gt;'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('2024.01'));
  assert.ok(!html.includes('至今'));
  assert.ok(!html.includes('undefined'));
  assert.ok(!renderMarkdown({}, [], variant).includes('## 学术兼职'));
});
