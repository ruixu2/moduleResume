'use strict';
// Run with: node --test scripts/test_course_batch.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse, MAX_COURSES } = require('../frontend/course-batch.js');

test('parses pipe, full-width pipe and tab separated course rows', () => {
  const rows = parse([
    '机器学习 | 示例大学 | 专业必修 | 2024.09 – 2024.12 | 3 学分 | 92 | 监督学习与模型评估',
    '最优化方法｜示例大学｜专业选修｜2023.02 – 2023.06｜2 学分｜优秀｜凸优化与数值实现',
    '数据可视化\t示例大学\t公开课\t2022.09\t1 学分\tPass\t图表设计与数据表达',
  ].join('\n'));
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    title: '机器学习', organization: '示例大学', courseType: '专业必修', dates: '2024.09 – 2024.12',
    credits: '3 学分', score: '92', desc: '监督学习与模型评估',
  });
  assert.equal(rows[1].courseType, '专业选修');
  assert.equal(rows[2].score, 'Pass');
});

test('skips header, comments and blank lines; joins extra description cells', () => {
  const rows = parse([
    '# 这是注释',
    '',
    '课程名称 | 开课单位 | 课程类型 | 学习时间 | 学分/学时 | 成绩 | 课程内容与收获',
    '机器学习 | 示例大学 | 专业必修 | 2024 | 3 学分 | 92 | 监督学习 | 模型评估',
    '   ',
    '最优化方法',
    '# 结束',
  ].join('\n'));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, '机器学习');
  assert.equal(rows[0].desc, '监督学习 ｜ 模型评估');
  assert.equal(rows[1].title, '最优化方法');
  assert.equal(rows[1].organization, '');
});

test('handles quoted cells, empty input and the row limit', () => {
  const quoted = parse('"机器学习" | "示例大学" | 专业必修');
  assert.equal(quoted[0].title, '机器学习');
  assert.equal(quoted[0].organization, '示例大学');
  assert.deepEqual(parse(''), []);
  assert.deepEqual(parse(null), []);

  const many = Array.from({ length: MAX_COURSES + 10 }, (_, i) => '课程 ' + (i + 1) + ' | 示例大学').join('\n');
  assert.equal(parse(many).length, MAX_COURSES);
});
