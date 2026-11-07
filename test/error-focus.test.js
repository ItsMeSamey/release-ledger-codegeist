import test from 'node:test';
import assert from 'node:assert/strict';
import {build, stop} from 'esbuild';
import {JSDOM} from 'jsdom';
import {demoGraph} from '../src/demo.js';

for (const focusLocation of ['removed input', 'outside control']) {
  test(`failed refresh preserves useful focus from ${focusLocation}`, {timeout: 30000}, async t => {
    t.after(stop);
    const bundle = await build({
      entryPoints: ['src/ui.jsx'], bundle: true, write: false, format: 'iife', loader: {'.css': 'empty'},
      define: {'import.meta.env.DEV': 'false', 'process.env.NODE_ENV': '"production"'},
      plugins: [{name: 'controlled-bridge', setup(b) {
        b.onResolve({filter: /^@forge\/bridge$/}, () => ({path: 'bridge', namespace: 'controlled-bridge'}));
        b.onLoad({filter: /.*/, namespace: 'controlled-bridge'}, () => ({contents: 'export const invoke=(...args)=>window.testInvoke(...args); export const router={open:()=>{throw new Error("unexpected navigation")}};', loader: 'js'}));
      }}],
    });
    const dom = new JSDOM('<!doctype html><button id="outside">Outside control</button><div id="root"></div>', {url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true});
    let calls = 0, rejectPending;
    dom.window.testInvoke = () => {
      calls++;
      if (calls === 1) return Promise.resolve(structuredClone(demoGraph));
      return new Promise((resolve, reject) => { rejectPending = reject; });
    };
    const waitFor = async fn => {for (let i = 0; i < 100; i++) {if (fn()) return; await new Promise(resolve => setTimeout(resolve, 10));} throw new Error('DOM state did not appear');};
    const button = text => [...dom.window.document.querySelectorAll('button')].find(el => el.textContent === text);
    try {
      dom.window.eval(bundle.outputFiles[0].text);
      await waitFor(() => button('Refresh evidence'));
      const refresh = button('Refresh evidence');
      refresh.focus(); refresh.click();
      await waitFor(() => rejectPending && button('Refreshing...'));
      const movedTo = dom.window.document.querySelector(focusLocation === 'removed input' ? '.toolbar input' : '#outside');
      movedTo.focus();
      assert.equal(dom.window.document.activeElement === movedTo, true);
      rejectPending(new Error('Synthetic delayed failure'));
      await waitFor(() => button('Try again'));
      assert.match(dom.window.document.querySelector('[role=alert]').textContent, /Synthetic delayed failure/);
      const expected = focusLocation === 'removed input' ? button('Try again') : movedTo;
      assert.equal(dom.window.document.activeElement === expected, true, `${focusLocation} must have the correct focus after failure`);
      assert.equal(calls, 2);
    } finally {dom.window.close(); stop();}
  });
}
