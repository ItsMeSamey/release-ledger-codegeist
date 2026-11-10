import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {build, stop} from 'esbuild';
import {JSDOM} from 'jsdom';
import {demoGraph} from '../src/demo.js';

const uiSource = process.env.CODEGEIST_UI_SOURCE || 'src/ui.jsx';
const reactClient = fileURLToPath(import.meta.resolve('react-dom/client'));
const bundle = await build({
  entryPoints: [uiSource], bundle: true, write: false, format: 'iife', loader: {'.css': 'empty'},
  nodePaths: [resolve('node_modules')],
  define: {'import.meta.env.DEV': 'false', 'process.env.NODE_ENV': '"production"'},
  plugins: [{name: 'controlled-navigation', setup(b) {
    b.onResolve({filter: /^@forge\/bridge$/}, () => ({path: 'bridge', namespace: 'controlled-navigation'}));
    b.onLoad({filter: /.*/, namespace: 'controlled-navigation'}, () => ({contents: 'export const invoke=(...args)=>window.testInvoke(...args); export const router={open:(...args)=>window.testOpen(...args)};', loader: 'js'}));
    b.onResolve({filter: /^react-dom\/client$/}, () => ({path: 'client', namespace: 'root-capture'}));
    b.onLoad({filter: /.*/, namespace: 'root-capture'}, () => ({contents: `import {createRoot as actualCreateRoot} from ${JSON.stringify(reactClient)}; export function createRoot(...args) { const root=actualCreateRoot(...args); window.testRoot=root; return root; }`, loader: 'js', resolveDir: process.cwd()}));
  }}],
});
after(stop);

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function waitFor(check) {
  for (let i = 0; i < 100; i++) {if (check()) return; await tick();}
  throw new Error('Expected UI state did not appear');
}
function deferred(PromiseType = Promise) {
  let resolve, reject;
  const promise = new PromiseType((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
async function fixture(t) {
  const dom = new JSDOM('<!doctype html><button id="outside">Outside control</button><div id="root"></div>', {url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true});
  const {window} = dom, document = window.document;
  const opened = [], loaded = [];
  const f = {window, document, opened, loaded, open: () => Promise.resolve(), load: () => Promise.resolve(structuredClone(demoGraph))};
  window.testInvoke = (...args) => {loaded.push(structuredClone(args)); return f.load(...args);};
  window.testOpen = (...args) => {opened.push(args); return f.open(...args);};
  f.button = text => [...document.querySelectorAll('button')].find(el => el.textContent === text);
  f.node = key => [...document.querySelectorAll('.node')].find(el => el.querySelector('strong').textContent === key);
  f.issue = () => document.querySelector('aside h2')?.textContent;
  f.alert = () => document.querySelector('#jira-navigation-error');
  f.unmount = () => {window.testRoot?.unmount(); window.testRoot = null;};
  t.after(() => {f.unmount(); window.close();});
  window.eval(bundle.outputFiles[0].text);
  await waitFor(() => f.button('Open Jira issue'));
  return f;
}
function plannerState(f) {
  return {
    issue: f.issue(),
    graph: f.document.querySelector('.map').innerHTML,
    metrics: f.document.querySelector('.metrics').textContent,
    scenario: f.document.querySelector('.scenario')?.textContent,
    checked: f.document.querySelector('aside input[type=checkbox]')?.checked,
    briefing: f.document.querySelector('#brief')?.value,
  };
}

test('navigation rejection preserves scenario, selection and focus until explicit retry', async t => {
  const f = await fixture(t);
  f.node('DATA-7').click();
  await waitFor(() => f.issue() === 'DATA-7');
  f.document.querySelector('aside input[type=checkbox]').click();
  f.button('Prepare briefing').click();
  await waitFor(() => f.document.querySelector('#brief') && f.document.querySelector('.scenario'));
  const before = plannerState(f), first = deferred();
  f.open = () => first.promise;
  const button = f.button('Open Jira issue');
  button.focus(); button.click(); button.click();
  await waitFor(() => f.opened.length === 1 && button.getAttribute('aria-busy') === 'true');
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  first.reject(new Error('Synthetic bridge rejection'));
  await waitFor(() => f.alert());
  assert.equal(f.alert().getAttribute('role'), 'alert');
  assert.equal(f.alert().textContent, 'Could not open DATA-7. Try again.');
  assert.equal(button.getAttribute('aria-describedby'), f.alert().id);
  assert.equal(f.document.activeElement, button);
  assert.equal(button.getAttribute('aria-busy'), 'false');
  assert.deepEqual(plannerState(f), before);
  await tick();
  assert.deepEqual(f.opened, [['/browse/DATA-7']]);
  const second = deferred(); f.open = () => second.promise;
  button.click();
  await waitFor(() => f.opened.length === 2 && !f.alert());
  second.resolve();
  await waitFor(() => button.textContent === 'Open Jira issue');
  assert.equal(f.document.activeElement, button);
  assert.deepEqual(plannerState(f), before);
  assert.deepEqual(f.opened, [['/browse/DATA-7'], ['/browse/DATA-7']]);
  assert.deepEqual(f.loaded, [['loadGraph', {blockType: 'Blocks'}]]);
});

test('synchronous router throw gives feedback and selection clears it', async t => {
  const f = await fixture(t);
  const selected = f.issue();
  f.open = () => {throw new Error('Synthetic synchronous failure');};
  f.button('Open Jira issue').click();
  await waitFor(() => f.alert());
  assert.equal(f.alert().textContent, `Could not open ${selected}. Try again.`);
  f.node('DATA-7').click();
  await waitFor(() => f.issue() === 'DATA-7' && !f.alert());
  assert.equal(f.button('Open Jira issue').hasAttribute('aria-describedby'), false);
  f.open = () => undefined;
  f.button('Open Jira issue').click();
  await waitFor(() => f.opened.length === 2 && f.button('Open Jira issue'));
  assert.deepEqual(f.opened, [[`/browse/${selected}`], ['/browse/DATA-7']]);
  assert.equal(f.loaded.length, 1);
});

for (const select of ['map', 'evidence']) {
  test(`selection through ${select} cancels navigation before the bridge call`, async t => {
    const f = await fixture(t);
    const target = select === 'map' ? f.node('DATA-7') : f.document.querySelector('aside .text-button');
    const key = select === 'map' ? 'DATA-7' : target.textContent;
    f.button('Open Jira issue').click();
    target.click();
    await waitFor(() => f.issue() === key);
    await tick();
    assert.deepEqual(f.opened, []);
    assert.equal(f.alert(), null);
    assert.equal(f.button('Open Jira issue').getAttribute('aria-busy'), 'false');
  });
}

test('late failure after A to B to A does not clear the newer request', async t => {
  const f = await fixture(t), first = deferred(), second = deferred();
  const root = f.issue();
  f.open = () => first.promise;
  f.button('Open Jira issue').click();
  await waitFor(() => f.opened.length === 1);
  f.node('DATA-7').click(); await waitFor(() => f.issue() === 'DATA-7');
  f.node(root).click(); await waitFor(() => f.issue() === root);
  f.open = () => second.promise;
  f.button('Open Jira issue').click();
  await waitFor(() => f.opened.length === 2);
  const outside = f.document.querySelector('#outside'); outside.focus();
  first.reject(new Error('Old failure'));
  await tick(); await tick();
  assert.equal(f.alert(), null);
  assert.equal(f.button('Opening...').getAttribute('aria-busy'), 'true');
  assert.equal(f.document.activeElement, outside);
  second.reject(new Error('Current failure'));
  await waitFor(() => f.alert());
  assert.equal(f.alert().textContent, `Could not open ${root}. Try again.`);
  assert.equal(f.document.activeElement, outside);
  assert.deepEqual(f.opened, [[`/browse/${root}`], [`/browse/${root}`]]);
});

test('refresh replacement ignores the previous navigation failure', async t => {
  const f = await fixture(t), pending = deferred();
  f.open = () => pending.promise;
  f.button('Open Jira issue').click();
  await waitFor(() => f.opened.length === 1);
  f.button('Refresh evidence').click();
  await waitFor(() => f.loaded.length === 2 && f.button('Refresh evidence'));
  pending.reject(new Error('Old graph failure'));
  await tick(); await tick();
  assert.equal(f.alert(), null);
  assert.ok(f.button('Open Jira issue'));
  assert.equal(f.opened.length, 1);
});

test('graph removal keeps its load error when old navigation fails', async t => {
  const f = await fixture(t), pending = deferred();
  f.open = () => pending.promise;
  f.button('Open Jira issue').click();
  await waitFor(() => f.opened.length === 1);
  f.load = () => Promise.reject(new Error('Current load failure'));
  f.button('Refresh evidence').click();
  await waitFor(() => f.button('Try again'));
  pending.reject(new Error('Old navigation failure'));
  await tick(); await tick();
  assert.equal(f.document.querySelector('[role=alert]').textContent, 'Current load failure');
  assert.equal(f.alert(), null);
  f.load = () => Promise.resolve(structuredClone(demoGraph));
  f.button('Try again').click();
  await waitFor(() => f.button('Open Jira issue'));
  assert.equal(f.alert(), null);
  assert.equal(f.loaded.length, 3);
  assert.equal(f.opened.length, 1);
});

test('navigation accepted as refresh resolves returns to idle and permits retry', async t => {
  const f = await fixture(t), refresh = deferred(f.window.Promise), navigation = deferred();
  const root = f.issue();
  f.load = () => refresh.promise;
  f.button('Refresh evidence').click();
  await waitFor(() => f.loaded.length === 2);
  f.open = () => navigation.promise;
  refresh.resolve(structuredClone(demoGraph));
  await new Promise(resolve => queueMicrotask(() => {f.button('Open Jira issue').click(); resolve();}));
  await tick(); await tick();
  navigation.resolve();
  await waitFor(() => f.button('Open Jira issue'));
  assert.deepEqual(f.opened, [[`/browse/${root}`]]);
  assert.equal(f.alert(), null);
  f.open = () => undefined;
  f.button('Open Jira issue').click();
  await waitFor(() => f.opened.length === 2 && f.button('Open Jira issue'));
  assert.deepEqual(f.opened, [[`/browse/${root}`], [`/browse/${root}`]]);
  assert.equal(f.loaded.length, 2);
});

test('unmount before bridge continuation cancels navigation', async t => {
  const f = await fixture(t);
  f.button('Open Jira issue').click(); f.unmount();
  await tick(); await tick();
  assert.deepEqual(f.opened, []);
  assert.equal(f.document.querySelector('#root').childElementCount, 0);
});

test('unmount after bridge dispatch handles the late rejection', async t => {
  const f = await fixture(t), pending = deferred();
  f.open = () => pending.promise;
  f.button('Open Jira issue').click();
  await waitFor(() => f.opened.length === 1);
  f.unmount(); pending.reject(new Error('Late unmounted failure'));
  await tick(); await tick();
  assert.equal(f.opened.length, 1);
  assert.equal(f.document.querySelector('#root').childElementCount, 0);
});
