'use strict';
// Run with: node --test scripts/test_papers.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderVariantHtml, renderMarkdown, renderPage } = require('../backend/render');
const { normalizeResult, buildImport } = require('../backend/resume-ai');

const paper = {
  id: 'paper', type: 'paper', title: '研究论文',
  content: { journal: 'Science & Research', partition: '中科院 1 区', impactFactor: '5.2（2024）', date: '2024.06', volume: '12: 1-10' },
};
const variant = { sections: [{ title: '期刊论文', kind: 'publications', items: [{ bid: 'paper', ov: {} }] }] };

const conference = {
  id: 'conference', type: 'conference_paper', title: '会议论文',
  content: { journal: '示例国际会议', partition: 'CCF-A', date: '2024.10', volume: 'pp. 1-10', note: '第一作者', desc: '会议论文简介' },
};
const conferenceVariant = { sections: [{ title: '会议论文', kind: 'conferences', items: [{ bid: 'conference', ov: {} }] }] };

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

test('conference papers render with venue, level and date in all formats', () => {
  for (const render of [renderVariantHtml, renderMarkdown, renderPage]) {
    const output = render({}, [conference], conferenceVariant);
    for (const value of ['会议论文', '示例国际会议', 'CCF-A', '2024.10', 'pp. 1-10', '第一作者', '会议论文简介']) {
      assert.ok(output.includes(value), value);
    }
    assert.ok(!output.includes('IF:'));
  }
});

test('conference paper version overrides change only the selected version', () => {
  const custom = structuredClone(conferenceVariant);
  custom.sections[0].items[0].ov = { title: '定制会议论文', content: { journal: '定制会议', partition: 'EI', desc: '定制简介' } };
  const html = renderVariantHtml({}, [conference], custom);
  assert.ok(html.includes('定制会议论文'));
  assert.ok(html.includes('定制会议'));
  assert.ok(html.includes('EI'));
  assert.ok(html.includes('定制简介'));
  assert.ok(!html.includes('示例国际会议'));
  assert.ok(renderVariantHtml({}, [conference], conferenceVariant).includes('示例国际会议'));
  assert.equal(conference.content.journal, '示例国际会议');
});

test('AI extraction supports conference papers and creates a conference section', () => {
  const selected = normalizeResult({ profile: {}, blocks: [{
    type: 'conference_paper', title: '示例会议论文',
    content: { journal: '示例国际会议', partition: 'CCF-A', date: '2025', note: '第一作者', desc: '会议简介', extra: '丢弃' },
  }] });
  assert.equal(selected.blocks[0].content.extra, undefined);
  assert.equal(selected.blocks[0].content.partition, 'CCF-A');
  const result = buildImport({ ...selected, createVersion: true, versionName: '会议测试' },
    { profile: {}, blocks: [], variants: [] }, '2026-11-05');
  const section = result.variants[0].sections.find(s => s.kind === 'conferences');
  assert.ok(section);
  assert.equal(section.title, '会议论文');
  assert.ok(renderMarkdown(result.profile, result.blocks, result.variants[0]).includes('示例会议论文'));
});
