import test from 'node:test';
import assert from 'node:assert/strict';
import {build, stop} from 'esbuild';
import {JSDOM} from 'jsdom';
import {demoGraph} from '../src/demo.js';

test('loading triggers stay inert and focus transfers only when an active trigger is removed', {timeout: 30000}, async t => {
  t.after(stop);
  const bundle = await build({
    entryPoints: ['src/ui.jsx'], bundle: true, write: false, format: 'iife', loader: {'.css': 'empty'},
    define: {'import.meta.env.DEV': 'false', 'process.env.NODE_ENV': '"production"'},
    plugins: [{name: 'controlled-bridge', setup(b) {
      b.onResolve({filter: /^@forge\/bridge$/}, () => ({path: 'bridge', namespace: 'controlled-bridge'}));
      b.onLoad({filter: /.*/, namespace: 'controlled-bridge'}, () => ({contents: 'export const invoke=(...args)=>window.testInvoke(...args); export const router={open:()=>{throw new Error("unexpected navigation")}};', loader: 'js'}));
    }}],
  });
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true});
  const calls = [], pending = [];
  dom.window.testInvoke = (name, payload) => {
    calls.push({name, payload});
    if (calls.length === 1) return Promise.resolve(structuredClone(demoGraph));
    return new Promise((resolve, reject) => pending.push({resolve, reject}));
  };
  const waitFor = async fn => {for (let i = 0; i < 100; i++) {if (fn()) return; await new Promise(resolve => setTimeout(resolve, 10));} throw new Error('DOM state did not appear');};
  const button = text => [...dom.window.document.querySelectorAll('button')].find(el => el.textContent === text);
  const active = el => dom.window.document.activeElement === el;
  const pause = () => new Promise(resolve => setTimeout(resolve, 10));
  try {
    dom.window.eval(bundle.outputFiles[0].text);
    await waitFor(() => button('Refresh evidence'));
    assert.equal(active(dom.window.document.body), true, 'initial load must not autofocus');

    const refresh = button('Refresh evidence');
    refresh.focus(); refresh.click(); refresh.click();
    await waitFor(() => pending.length === 1 && button('Refreshing...'));
    assert.equal(calls.length, 2, 'same-turn repeated activation must not dispatch twice');
    assert.equal(refresh.disabled, false);
    assert.equal(refresh.getAttribute('aria-disabled'), 'true');
    assert.equal(active(refresh), true);
    button('Apply & refresh').click();
    await pause();
    assert.equal(calls.length, 2, 'Apply must also be inert while another load is pending');
    pending.shift().reject(new Error('Synthetic request failed'));
    await waitFor(() => button('Try again'));
    const retry = button('Try again');
    assert.equal(active(retry), true, 'failed active Refresh hands focus to Retry');
    assert.match(dom.window.document.querySelector('[role=alert]').textContent, /Synthetic request failed/);

    retry.click(); retry.click();
    await waitFor(() => pending.length === 1 && button('Reading...'));
    assert.equal(calls.length, 3);
    assert.equal(button('Reading...') === retry, true, 'Retry remains the same DOM control during loading');
    assert.equal(retry.disabled, false);
    assert.equal(retry.getAttribute('aria-disabled'), 'true');
    assert.equal(active(retry), true);
    pending.shift().resolve(structuredClone(demoGraph));
    await waitFor(() => button('Refresh evidence'));
    assert.equal(active(button('Refresh evidence')), true, 'successful active Retry hands focus to Refresh');

    const apply = button('Apply & refresh');
    apply.focus(); apply.click(); apply.click();
    await waitFor(() => pending.length === 1 && apply.getAttribute('aria-disabled') === 'true');
    assert.equal(calls.length, 4);
    assert.equal(apply.disabled, false);
    assert.equal(active(apply), true);
    pending.shift().resolve(structuredClone(demoGraph));
    await waitFor(() => apply.getAttribute('aria-disabled') === 'false');
    assert.equal(active(apply), true, 'successful Apply keeps the existing trigger');

    const currentRefresh = button('Refresh evidence');
    currentRefresh.focus(); currentRefresh.click();
    await waitFor(() => pending.length === 1);
    const input = dom.window.document.querySelector('.toolbar input');
    input.focus();
    pending.shift().resolve(structuredClone(demoGraph));
    await waitFor(() => button('Refresh evidence')?.getAttribute('aria-disabled') === 'false');
    assert.equal(active(input), true, 'response must not take focus back after the user moves it');
    assert.equal(calls.length, 5);
    assert.equal(calls.every(call => call.name === 'loadGraph' && call.payload.blockType === 'Blocks'), true);
  } finally {dom.window.close(); stop();}
});
