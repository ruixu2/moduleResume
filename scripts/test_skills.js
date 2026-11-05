'use strict';
// Run with: node --test scripts/test_skills.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderVariantHtml, renderMarkdown, renderPage } = require('../backend/render');

const skill = {
  id: 'skill', type: 'skill', title: '编程与工具',
  content: {
    text: '编程与工具：Python / PyTorch / SQL',
    items: ['Python：数据处理与脚本开发', 'PyTorch：深度学习模型训练', 'SQL：数据查询与统计分析'],
  },
};
const variant = {
  sections: [{ title: '核心技能', kind: 'bullets', items: [{ bid: skill.id, ov: {} }] }],
};

test('skill subitems render as nested lists in HTML and Markdown', () => {
  const html = renderVariantHtml({}, [skill], variant);
  assert.ok(html.includes('<ul class="skill-subitems">'));
  for (const value of ['数据处理与脚本开发', '深度学习模型训练', '数据查询与统计分析']) {
    assert.ok(html.includes(value), value);
  }
  assert.ok(html.includes('<b>编程与工具</b>：Python / PyTorch / SQL'));

  const markdown = renderMarkdown({}, [skill], variant);
  assert.ok(markdown.includes('- **编程与工具**：Python / PyTorch / SQL'));
  assert.ok(markdown.includes('  - **Python**：数据处理与脚本开发'));
  assert.ok(markdown.includes('  - **PyTorch**：深度学习模型训练'));
  assert.ok(renderPage({}, [skill], variant).includes('skill-subitems'));
});

test('version overrides can replace skill subitems without changing the source', () => {
  const custom = structuredClone(variant);
  custom.sections[0].items[0].ov = {
    content: { text: '编程与工具：Python', items: ['Python：仅保留与当前岗位相关的部分'] },
  };
  const html = renderVariantHtml({}, [skill], custom);
  assert.ok(html.includes('仅保留与当前岗位相关的部分'));
  assert.ok(!html.includes('数据查询与统计分析'));
  assert.ok(renderVariantHtml({}, [skill], variant).includes('数据查询与统计分析'));
  assert.deepEqual(skill.content.items, ['Python：数据处理与脚本开发', 'PyTorch：深度学习模型训练', 'SQL：数据查询与统计分析']);
});

test('legacy skills without subitems still render and escape unsafe content', () => {
  const legacy = { id: 'legacy', type: 'skill', title: '旧技能', content: { text: '旧技能：Excel' } };
  const legacyVariant = { sections: [{ title: '核心技能', kind: 'bullets', items: [{ bid: legacy.id, ov: {} }] }] };
  const html = renderVariantHtml({}, [legacy], legacyVariant);
  assert.ok(html.includes('旧技能</b>：Excel'));
  assert.ok(!html.includes('skill-subitems'));

  const unsafe = { ...skill, content: { text: '技能：<script>bad</script>', items: ['A&B', '<img src=x>'] } };
  const escaped = renderVariantHtml({}, [unsafe], variant);
  assert.ok(escaped.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(escaped.includes('A&amp;B'));
  assert.ok(escaped.includes('&lt;img src=x&gt;'));
});
