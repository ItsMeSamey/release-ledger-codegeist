import test from 'node:test';
import assert from 'node:assert/strict';
import {handler} from '../src/index.js';

test('actual Forge resolver dependency initializes and dispatches the issue-context guard', async () => {
  assert.equal(typeof handler, 'function');
  await assert.rejects(
    handler({call: {functionKey: 'loadGraph', payload: {}}, context: {extension: {}}}),
    /Open Release Ledger from a Jira issue\./,
  );
});
