'use strict';
// Run with: node --test scripts/test_project_customization.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderVariantHtml, renderMarkdown } = require('../backend/render');
const clone = value => JSON.parse(JSON.stringify(value));

test('project work can be reordered, added, removed, and cleared in one version', () => {
  const project = { id: 'p1', type: 'project', title: '示例项目', content: { work: '总体说明', works: ['原工作一', '原工作二', '原工作三'] } };
  const unchanged = clone(project);
  const variant = { sections: [{ kind: 'projects', title: '项目经历', items: [{ bid: 'p1', ov: { content: { work: '', works: ['原工作三', '新工作', '原工作一'] } } }] }] };
  const originalVariant = { sections: [{ kind: 'projects', title: '项目经历', items: [{ bid: 'p1', ov: {} }] }] };
  for (const render of [renderVariantHtml, renderMarkdown]) {
    const output = render({}, [project], variant);
    assert.ok(output.includes('原工作三'));
    assert.ok(output.includes('新工作'));
    assert.ok(output.indexOf('原工作三') < output.indexOf('原工作一'));
    assert.ok(!output.includes('原工作二'));
    assert.ok(!output.includes('总体说明'));
    assert.ok(render({}, [project], originalVariant).includes('原工作二'));
    const emptyVariant = clone(variant);
    emptyVariant.sections[0].items[0].ov.content.works = [];
    assert.ok(!render({}, [project], emptyVariant).includes('原工作一'));
  }
  assert.deepEqual(project, unchanged);
});

test('custom project works override legacy bullets without changing the legacy source', () => {
  const project = { id: 'old', type: 'project', title: '旧项目', content: { bullets: ['旧工作一', '旧工作二'] } };
  const variant = { sections: [{ kind: 'projects', title: '项目经历', items: [{ bid: 'old', ov: { content: { works: ['新版工作'] } } }] }] };
  for (const render of [renderVariantHtml, renderMarkdown]) {
    const output = render({}, [project], variant);
    assert.ok(output.includes('新版工作'));
    assert.ok(!output.includes('旧工作一'));
  }
  assert.deepEqual(project.content.bullets, ['旧工作一', '旧工作二']);
});

test('unchecked work remains in the saved choices but is absent from the rendered resume', () => {
  const project = { id: 'p1', type: 'project', title: '示例项目', content: { works: ['工作甲', '工作乙'] } };
  const variant = { sections: [{ kind: 'projects', title: '项目经历', items: [{ bid: 'p1', ov: {
    projectWorks: [{ text: '工作甲', enabled: false }, { text: '工作乙', enabled: true }],
    content: { works: ['工作乙'] },
  } }] }] };
  const restored = clone(variant);
  assert.deepEqual(restored.sections[0].items[0].ov.projectWorks[0], { text: '工作甲', enabled: false });
  for (const render of [renderVariantHtml, renderMarkdown]) {
    const output = render({}, [project], restored);
    assert.ok(!output.includes('工作甲'));
    assert.ok(output.includes('工作乙'));
  }
  assert.deepEqual(project.content.works, ['工作甲', '工作乙']);
});
