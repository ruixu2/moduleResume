'use strict';
// Run with: node --test scripts/test_papers.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderVariantHtml, renderMarkdown, renderPage } = require('../backend/render');

const paper = {
  id: 'paper', type: 'paper', title: '研究论文',
  content: { journal: 'Science & Research', partition: '中科院 1 区', impactFactor: '5.2（2024）', date: '2024.06', volume: '12: 1-10' },
};
const variant = { sections: [{ title: '期刊论文', kind: 'publications', items: [{ bid: 'paper', ov: {} }] }] };

test('paper metadata appears in HTML and Markdown exports', () => {
  const html = renderVariantHtml({}, [paper], variant);
  assert.ok(html.includes('Science &amp; Research'));
  assert.ok(!html.includes('&amp;amp;'));
  for (const render of [renderVariantHtml, renderMarkdown, renderPage]) {
    const result = render({}, [paper], variant);
    assert.ok(result.includes('中科院 1 区'));
    assert.ok(result.includes('IF: 5.2（2024）'));
  }
});

test('paper metadata supports version overrides without changing the source', () => {
  const custom = structuredClone(variant);
  custom.sections[0].items[0].ov = { content: { partition: 'JCR Q1', impactFactor: '6.1' } };
  for (const render of [renderVariantHtml, renderMarkdown]) {
    const result = render({}, [paper], custom);
    assert.ok(result.includes('JCR Q1'));
    assert.ok(result.includes('IF: 6.1'));
    assert.ok(!result.includes('中科院 1 区'));
    assert.ok(render({}, [paper], variant).includes('中科院 1 区'));
  }
});

test('older papers without new fields render without placeholders', () => {
  const oldPaper = { ...paper, content: { journal: '旧期刊' } };
  for (const render of [renderVariantHtml, renderMarkdown]) {
    const result = render({}, [oldPaper], variant);
    assert.ok(result.includes('旧期刊'));
    assert.ok(!result.includes('undefined'));
    assert.ok(!result.includes('IF:'));
  }
});

test('partition and impact factor follow all paper details inside parentheses', () => {
  const full = { ...paper, content: { ...paper.content, note: '第一作者', desc: '研究简介' } };
  for (const render of [renderVariantHtml, renderMarkdown, renderPage]) {
    const output = render({}, [full], variant);
    assert.ok(output.includes('研究简介。（中科院 1 区，IF: 5.2（2024））'));
    const partitionOnly = render({}, [{ ...full, content: { ...full.content, impactFactor: '' } }], variant);
    assert.ok(partitionOnly.includes('研究简介。（中科院 1 区）'));
    const impactOnly = render({}, [{ ...full, content: { ...full.content, partition: '' } }], variant);
    assert.ok(impactOnly.includes('研究简介。（IF: 5.2（2024））'));
    const punctuated = render({}, [{ ...full, content: { ...full.content, desc: '研究简介。' } }], variant);
    assert.ok(punctuated.includes('研究简介。（中科院 1 区，IF: 5.2（2024））'));
  }
});
