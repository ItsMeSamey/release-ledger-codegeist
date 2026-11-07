import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import YAML from 'yaml';

test('the public template exposes only the read-only Jira panel', async () => {
  const m = YAML.parse(await readFile('manifest.yml', 'utf8'));
  assert.deepEqual(Object.keys(m.modules).sort(), ['function', 'jira:issuePanel']);
  assert.deepEqual(m.modules.function, [{key: 'resolver', handler: 'index.handler'}]);
  assert.equal(m.modules['jira:issuePanel'].length, 1);
  assert.equal(m.modules['jira:issuePanel'][0].resolver.function, 'resolver');
  assert.equal(m.modules['jira:issuePanel'][0].resource, 'main');
  assert.deepEqual(m.permissions, {scopes: ['read:jira-work']});
  assert.deepEqual(m.resources, [{key: 'main', path: 'dist'}]);
  assert.equal(m.app.runtime.name, 'nodejs22.x');
  // The distributed template has no identity. forge register writes a fork's real ID.
  if (Object.hasOwn(m.app, 'id')) {
    assert.match(m.app.id, /^ari:cloud:ecosystem::app\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.notEqual(m.app.id.toLowerCase(), 'ari:cloud:ecosystem::app/00000000-0000-0000-0000-000000000000');
  }
  for (const resource of m.resources) await access(`${resource.path}/index.html`);
});
