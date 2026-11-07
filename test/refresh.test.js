import test from 'node:test';
import assert from 'node:assert/strict';
import {build, stop} from 'esbuild';
import {JSDOM} from 'jsdom';
import {demoGraph} from '../src/demo.js';

test('a successful refresh clears assumptions made on the previous snapshot while waiting', {timeout: 30000}, async t => {
  t.after(stop);
  console.log('refresh regression: compiling mock bridge');
  const bundle = await build({
    entryPoints: ['src/ui.jsx'], bundle: true, write: false, format: 'iife',
    loader: {'.css': 'empty'},
    define: {'import.meta.env.DEV': 'false', 'process.env.NODE_ENV': '"production"'},
    plugins: [{name: 'deferred-bridge', setup(b) {
      b.onResolve({filter: /^@forge\/bridge$/}, () => ({path: 'bridge', namespace: 'test-bridge'}));
      b.onLoad({filter: /.*/, namespace: 'test-bridge'}, () => ({
        contents: 'export const invoke=(...args)=>window.testInvoke(...args); export const router={open:()=>{throw new Error("unexpected navigation")}};', loader: 'js',
      }));
    }}],
  });
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true});
  console.log('refresh regression: compiled');
  const calls = [];
  let finishRefresh;
  dom.window.testInvoke = (name, payload) => {
    calls.push({name, payload});
    if (calls.length === 1) return Promise.resolve(structuredClone(demoGraph));
    if (calls.length === 2) return new Promise(resolve => {finishRefresh = resolve;});
    throw new Error('unexpected extra invocation');
  };
  const waitFor = async fn => {for (let i = 0; i < 100; i++) {if (fn()) return; await new Promise(resolve => setTimeout(resolve, 10));} throw new Error('DOM state did not appear');};
  const button = text => [...dom.window.document.querySelectorAll('button')].find(el => el.textContent === text);
  const body = () => dom.window.document.body.textContent;
  try {
    console.log('refresh regression: mounting');
    dom.window.eval(bundle.outputFiles[0].text);
    await waitFor(() => button('Try completing this'));
    console.log('refresh regression: initial graph loaded');
    const dataCard = [...dom.window.document.querySelectorAll('.node')].find(el => el.querySelector('strong')?.textContent === 'DATA-7');
    dataCard.click();
    await waitFor(() => dom.window.document.querySelector('aside input[type=checkbox]'));
    const refresh = button('Refresh evidence');
    refresh.focus();
    refresh.click();
    await waitFor(() => finishRefresh && button('Refreshing...')?.getAttribute('aria-disabled') === 'true');
    assert.equal(button('Apply & refresh').getAttribute('aria-disabled'), 'true');
    console.log('refresh regression: deferred request pending');
    assert.equal(button('Try completing this').disabled, true);
    const checkbox = dom.window.document.querySelector('aside input[type=checkbox]');
    assert.equal(checkbox.disabled, true);
    button('Try completing this').click();
    checkbox.click();
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(body().includes('What if 1 task was completed?'), false);
    console.log('refresh regression: old-snapshot changes blocked');
    finishRefresh(structuredClone(demoGraph));
    await waitFor(() => button('Refresh evidence') && !button('Refresh evidence').disabled);
    assert.equal(Boolean(button('Reset scenario')), false, 'fresh evidence must not inherit the pending old-snapshot scenario');
    assert.equal(dom.window.document.querySelectorAll('.choice').length, 1);
    assert.match(dom.window.document.querySelector('.choice').textContent, /DATA-7/);
    assert.equal(dom.window.document.activeElement === refresh, true, 'DOM refresh focus remains on the stable control');
    assert.deepEqual(calls.map(call => call.name), ['loadGraph', 'loadGraph']);
    assert.equal(calls.every(call => call.payload.blockType === 'Blocks'), true);
  } finally {dom.window.close(); stop(); console.log('refresh regression: cleanup complete');}
});
