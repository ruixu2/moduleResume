'use strict';
// Run with: node --test scripts/test_ai_import.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { extractResume, normalizeResult, endpointUrl, buildImport } = require('../backend/resume-ai');
const { renderMarkdown } = require('../backend/render');

const sample = { profile: { name: '示例用户', email: 'demo@example.invalid', photo: 'should not import' }, blocks: [
  { type: 'education', title: '', content: { school: '示例大学', degreeType: '硕士', start: '2020-09', extra: 'discard' } },
  { type: 'project', title: '示例项目', content: { works: ['实现 A', '完成 B'] } },
  { type: 'custom', title: '工作经历', content: { lines: ['示例公司工程师'] } },
  { type: 'unknown', title: 'ignored', content: {} },
] };

test('model request only contains the submitted resume and returns validated fields', async () => {
  let request;
  const result = await extractResume({ endpoint: 'https://model.example.invalid/v1/', model: 'demo', apiKey: 'private-key', text: '示例简历原文' }, async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '```json\n' + JSON.stringify(sample) + '\n```' } }] }), { status: 200 });
  });
  assert.equal(request.url, 'https://model.example.invalid/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer private-key');
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.body.messages[1].content, '示例简历原文');
  assert.equal(result.profile.name, '示例用户');
  assert.equal(result.profile.photo, undefined);
  assert.equal(result.blocks.length, 3);
  assert.equal(result.blocks[0].content.extra, undefined);
  assert.deepEqual(result.blocks[1].content.works, ['实现 A', '完成 B']);
});

test('bad endpoints, failures, truncation, and malformed results are rejected', async () => {
  assert.throws(() => endpointUrl('http://remote.example/v1'), /HTTPS/);
  assert.throws(() => endpointUrl('https://user:pass@example.com/v1'), /不能包含/);
  assert.equal(endpointUrl('http://127.0.0.1:1234/v1/chat/completions'), 'http://127.0.0.1:1234/v1/chat/completions');
  const options = { endpoint: 'https://example.invalid/v1', model: 'demo', text: '简历' };
  await assert.rejects(extractResume(options, async () => new Response('', { status: 401 })), /HTTP 401/);
  await assert.rejects(extractResume(options, async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length' }] }))), /截断/);
  await assert.rejects(extractResume(options, async () => new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }))), /无法解析/);
  assert.throws(() => normalizeResult({ profile: {}, blocks: [] }), /没有识别/);
});

test('selected content merges without mutating existing data and can form a usable version', () => {
  const existing = { profile: { name: '原姓名', phone: '111', photos: [{ id: 'photo' }] }, blocks: [{ id: 'old', type: 'skill', content: { text: '旧素材' } }], variants: [{ id: 'old-version' }] };
  const before = JSON.parse(JSON.stringify(existing));
  const selected = normalizeResult(sample);
  const result = buildImport({ ...selected, createVersion: true, versionName: '导入测试' }, existing, '2026-11-05');
  assert.deepEqual(existing, before);
  assert.equal(result.profile.phone, '111');
  assert.deepEqual(result.profile.photos, [{ id: 'photo' }]);
  assert.equal(result.blocks[0].id, 'old');
  assert.equal(result.variants[1].id, 'old-version');
  assert.equal(result.variants[0].name, '导入测试');
  const md = renderMarkdown(result.profile, result.blocks, result.variants[0]);
  for (const item of ['示例大学', '示例项目', '实现 A', '示例公司工程师']) assert.ok(md.includes(item), item);
});

test('HTTP extraction and confirmed import target only the chosen project', async () => {
  const tmpRoot = path.resolve(__dirname, '..', '..', 'tmp');
  fs.mkdirSync(tmpRoot, { recursive: true });
  const dataRoot = fs.mkdtempSync(path.join(tmpRoot, 'module-resume-ai-test-'));
  assert.ok(path.resolve(dataRoot).startsWith(tmpRoot + path.sep));
  process.env.MODULERESUME_DATA = dataRoot;
  const api = require('../backend/index');
  let received;
  const provider = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      received = { url: req.url, auth: req.headers.authorization, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(sample) } }] }));
    });
  });
  try {
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    await new Promise((resolve, reject) => api.start({ host: '127.0.0.1', port: 0, silent: true, noBrowser: true, onReady: resolve, onError: reject }));
    const base = 'http://127.0.0.1:' + api.server.address().port;
    const call = (route, body, type = 'application/json') => fetch(base + route, { method: 'POST', headers: { 'Content-Type': type }, body: JSON.stringify(body) });
    const projects = await (await fetch(base + '/api/projects')).json();
    const before = await (await fetch(base + '/api/workspace')).json();
    const response = await call('/api/ai/extract', { endpoint: 'http://127.0.0.1:' + provider.address().port + '/v1', model: 'demo', apiKey: 'test-secret', text: '仅用于测试的简历' });
    assert.equal(response.status, 200);
    const extracted = await response.json();
    assert.equal(received.url, '/v1/chat/completions');
    assert.equal(received.auth, 'Bearer test-secret');
    assert.equal(received.body.messages[1].content, '仅用于测试的简历');
    assert.deepEqual(await (await fetch(base + '/api/workspace')).json(), before);
    assert.equal((await call('/api/ai/import', {}, 'text/plain')).status, 415);

    const importBody = { projectId: projects.current, profile: { name: extracted.profile.name },
      expectedProfile: { name: before.profile.name }, blocks: [extracted.blocks[1]], createVersion: true, versionName: '测试版本' };
    const staleProfile = await call('/api/ai/import', { ...importBody, expectedProfile: { name: 'not the current name' } });
    assert.equal(staleProfile.status, 409);
    assert.deepEqual(await (await fetch(base + '/api/workspace')).json(), before);
    const imported = await call('/api/ai/import', importBody);
    assert.equal(imported.status, 200);
    const info = await imported.json();
    assert.equal(info.importedBlocks, 1);
    assert.equal(info.importedProfileFields, 1);
    assert.ok(info.versionId);
    const after = await (await fetch(base + '/api/workspace')).json();
    assert.equal(after.profile.name, '示例用户');
    assert.equal(after.profile.phone, before.profile.phone);
    assert.equal(after.blocks.length, before.blocks.length + 1);
    assert.equal(after.variants.length, before.variants.length + 1);
    assert.ok(!JSON.stringify(after).includes('test-secret'));

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const photoBody = { projectId: projects.current, variantId: info.versionId,
      dataUrl: 'data:image/jpeg;base64,' + jpeg.toString('base64'), name: '示例证件照' };
    assert.equal((await call('/api/photos', { ...photoBody, dataUrl: 'data:image/jpeg;base64,YWJj' })).status, 400);
    assert.equal((await call('/api/photos', { ...photoBody, variantId: 'missing' })).status, 404);
    const uploaded = await call('/api/photos', photoBody);
    assert.equal(uploaded.status, 200);
    const photo = await uploaded.json();
    const withPhoto = await (await fetch(base + '/api/workspace')).json();
    assert.equal(withPhoto.variants.find(v => v.id === info.versionId).photoId, photo.entry.id);
    assert.deepEqual(withPhoto.variants.find(v => v.id === before.variants[0].id), before.variants[0]);
    assert.ok(withPhoto.profile.photos.some(p => p.id === photo.entry.id));
    assert.deepEqual(Buffer.from(await (await fetch(base + '/assets/photos/' + photo.entry.file)).arrayBuffer()), jpeg);
    const html = await (await fetch(base + '/api/export/' + info.versionId + '.html')).text();
    assert.ok(html.includes('data:image/jpeg;base64,' + jpeg.toString('base64')));

    const created = await (await call('/api/projects', { name: '另一个示例项目' })).json();
    assert.notEqual(created.info.current, projects.current);
    assert.equal((await call('/api/ai/import', importBody)).status, 409);
    assert.equal((await call('/api/photos', photoBody)).status, 409);
    const other = await (await fetch(base + '/api/workspace')).json();
    assert.equal(other.blocks.length, 0);
  } finally {
    if (api.server.listening) await new Promise(resolve => api.server.close(resolve));
    if (provider.listening) await new Promise(resolve => provider.close(resolve));
    delete process.env.MODULERESUME_DATA;
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});
