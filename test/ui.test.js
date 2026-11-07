import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('local demo completes the planner interaction without mutating source evidence', async () => {
  const bundle = await build({entryPoints:['src/ui.jsx'], bundle:true, write:false, format:'iife', loader:{'.css':'empty'}, define:{'import.meta.env.DEV':'true','process.env.NODE_ENV':'"production"'}});
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://localhost/?demo=1', runScripts:'outside-only', pretendToBeVisual:true});
  dom.window.structuredClone=structuredClone;
  dom.window.eval(bundle.outputFiles[0].text);
  const waitFor=async fn=>{for(let i=0;i<80;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('DOM state did not appear');};
  const body=()=>dom.window.document.body.textContent;
  await waitFor(()=>body().includes('Try completing this'));
  assert.match(body(), /SYNTHETIC DEMO/);
  assert.match(body(), /Coordinate this cycle/);
  assert.match(body(), /The picture is incomplete/);
  const button=text=>[...dom.window.document.querySelectorAll('button')].find(el=>el.textContent===text);
  assert.equal(dom.window.document.activeElement,dom.window.document.body,'initial load must not move focus');
  button('Try completing this').focus();
  button('Try completing this').click();
  await waitFor(()=>body().includes('What if 1 task was completed?'));
  await waitFor(()=>dom.window.document.activeElement===button('Reset scenario'));
  assert.match(body(), /BILL-18, WEB-23 have no visible open linked blockers/);
  assert.doesNotMatch(body(), /ready to start|can now start/);
  assert.match(dom.window.document.querySelector('.choice').textContent, /In progress/);
  const briefingControl=button('Prepare briefing');
  briefingControl.focus();
  briefingControl.click();
  await waitFor(()=>dom.window.document.querySelector('textarea'));
  assert.equal(dom.window.document.activeElement,briefingControl,'briefing update must preserve focus');
  const brief=dom.window.document.querySelector('textarea').value;
  assert.match(brief,/Hypothetical completions \(not written to Jira\): DATA-7/);
  assert.match(brief,/Unknown dependency: ACCESS-4/);
  button('Reset scenario').focus();
  button('Reset scenario').click();
  await waitFor(()=>!body().includes('What if 1 task was completed?'));
  await waitFor(()=>dom.window.document.activeElement===button('Try completing this'));
  assert.equal(dom.window.document.querySelectorAll('.choice').length,1);
  assert.match(dom.window.document.querySelector('.choice').textContent,/DATA-7/);
  const detailDependency=[...dom.window.document.querySelectorAll('aside button')].find(el=>el.textContent==='BILL-18');
  detailDependency.focus();
  detailDependency.click();
  await waitFor(()=>dom.window.document.querySelector('aside h2')?.textContent==='BILL-18');
  assert.equal(dom.window.document.activeElement,dom.window.document.querySelector('aside h2'),'a replaced detail link must hand focus to its new evidence heading');
  const evidenceControl=[...dom.window.document.querySelectorAll('.node')].find(el=>el.querySelector('strong').textContent==='WEB-23');
  evidenceControl.focus();
  evidenceControl.click();
  await waitFor(()=>dom.window.document.querySelector('aside h2')?.textContent==='WEB-23');
  assert.equal(dom.window.document.activeElement,evidenceControl,'evidence selection must preserve focus');
  const checkbox=dom.window.document.querySelector('aside input[type=checkbox]');
  checkbox.focus();
  checkbox.click();
  await waitFor(()=>body().includes('What if 1 task was completed?'));
  assert.equal(dom.window.document.activeElement,checkbox,'checkbox updates must not use choice-button focus recovery');
  dom.window.close();
});

test('completed root displays Done without cycle recovery advice', async () => {
  const fixture={root:'R-1',blockType:'Blocks',capturedAt:'2026-10-29T00:00:00Z',nodes:[{key:'R-1',summary:'Completed work',status:'Done',done:true,available:true,dependencies:[]}]};
  const bundle=await build({entryPoints:['src/ui.jsx'],bundle:true,write:false,format:'iife',loader:{'.css':'empty'},define:{'import.meta.env.DEV':'true','process.env.NODE_ENV':'"production"'},plugins:[{name:'done-fixture',setup(b){b.onLoad({filter:/\/src\/demo\.js$/},()=>({contents:`export const demoGraph=${JSON.stringify(fixture)}`,loader:'js'}));}}]});
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/?demo=1',runScripts:'outside-only',pretendToBeVisual:true});
  dom.window.structuredClone=structuredClone;
  try {
    dom.window.eval(bundle.outputFiles[0].text);
    for(let i=0;i<80&&!dom.window.document.querySelector('.notice');i++)await new Promise(r=>setTimeout(r,10));
    const text=dom.window.document.body.textContent;
    assert.match(text,/selected issue is marked Done in Jira/);
    assert.doesNotMatch(text,/Resolve a cycle|Every visible open issue has/);
    assert.equal(dom.window.document.querySelectorAll('.choice').length,0);
  } finally {dom.window.close();}
});

