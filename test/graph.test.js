import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeIssue, collectGraph, analyze, briefing} from '../src/graph.js';
import {demoGraph} from '../src/demo.js';
const node = (key, dependencies = [], extra = {}) => ({key, dependencies, available: true, done: false, summary: key, owner: null, ...extra});
const graph = (...nodes) => ({root: nodes[0].key, nodes, blockType: 'Blocks', capturedAt: '2026-10-28T10:00:00Z'});
const raw = (key, dependencies = [], done = false) => ({key, fields: {summary: key, status: {name: done ? 'Done' : 'To do', statusCategory: {key: done ? 'done' : 'new'}}, issuelinks: dependencies.map(key => ({type: {name: 'Blocks'}, inwardIssue: {key}}))}});

test('Jira inward blockers are distinguished from outward dependents and unrelated links', () => {
  const issue = raw('R-1', ['D-1', 'D-1']);
  issue.fields.issuelinks.push({type: {name: 'Blocks'}, outwardIssue: {key: 'X-1'}}, {type: {name: 'Relates'}, inwardIssue: {key: 'Y-1'}});
  assert.deepEqual(normalizeIssue(issue).dependencies, ['D-1']);
});
test('shared prerequisite unlocks two branches without inventing a cycle', () => {
  const g = graph(node('R-1', ['B-1','C-1']), node('B-1', ['D-1']), node('C-1', ['D-1']), node('D-1'));
  const baseline = analyze(g);
  assert.deepEqual(baseline.ready, ['D-1']);
  assert.deepEqual(baseline.choices[0].unlocks, ['B-1','C-1']);
  assert.deepEqual(baseline.cycles, []);
  const simulation = analyze(g, ['D-1']);
  assert.deepEqual(simulation.ready, ['B-1','C-1']);
  assert.equal(simulation.rootReady, false);
  assert.deepEqual(analyze(g, ['B-1','C-1']).ready, ['R-1']);
});
test('cycles, self-loops and unaffected ready branches are identified', () => {
  const result = analyze(graph(node('R-1',['A-1','C-1','D-1']), node('A-1',['B-1']), node('B-1',['A-1']), node('C-1',['C-1']), node('D-1')));
  assert.deepEqual(result.cycles, [['A-1','B-1'],['C-1']]);
  assert.deepEqual(result.ready, ['D-1']);
});
test('unreadable dependencies stay unknown and cannot be assumed complete', () => {
  const g = graph(node('R-1',['X-1']), node('X-1', [], {available:false, reason:'unavailable'}));
  const result = analyze(g, ['X-1']);
  assert.deepEqual(result.unknown, ['X-1']); assert.equal(result.rootReady, false); assert.deepEqual(result.assumptions, []);
  assert.match(briefing(g,result), /Do not assume completion/);
});
test('completed tasks cut traversal, including otherwise unknown ancestors', () => {
  const result = analyze(graph(node('R-1',['D-1']),node('D-1',['X-1'],{done:true})));
  assert.deepEqual(result.ready,['R-1']); assert.deepEqual(result.unknown,[]);
});
test('collector reads each shared issue once and preserves permission errors', async () => {
  const data = {'R-1':raw('R-1',['A-1','B-1']), 'A-1':raw('A-1',['C-1']), 'B-1':raw('B-1',['C-1'])};
  const calls=[];
  const collected = await collectGraph('R-1', async key => { calls.push(key); if (!data[key]) throw {reason:'unavailable'}; return data[key]; });
  assert.deepEqual(calls,['R-1','A-1','B-1','C-1']);
  assert.deepEqual(analyze(collected).unknown,['C-1']);
});
test('collector stops on done, depth and count limits without reporting readiness', async () => {
  const data={'R-1':raw('R-1',['A-1','B-1']), 'A-1':raw('A-1',['C-1'],true), 'B-1':raw('B-1',['D-1'])};
  const g=await collectGraph('R-1', async k=>data[k],{maxNodes:2});
  assert.deepEqual(g.nodes.map(n=>n.key),['R-1','A-1','B-1']);
  assert.deepEqual(analyze(g).unknown,['B-1']);
  const shallow=await collectGraph('R-1',async k=>data[k],{maxDepth:0});
  assert.deepEqual(analyze(shallow).unknown,['A-1','B-1']);
});
test('elapsed budget marks pending work explicitly', async () => {
  let clock=0;
  const g=await collectGraph('R-1',async k=>{clock=16000;return raw(k,['A-1']);},{now:()=>clock});
  assert.equal(g.requests,1); assert.equal(g.nodes[1].reason,'time-budget');
  assert.equal(analyze(g).coverage,'incomplete');
});
test('fatal SDK error propagates and invalid root is rejected without reads', async () => {
  const fatal=Object.assign(new Error('SDK initialization'),{fatal:true});
  await assert.rejects(collectGraph('R-1',async()=>{throw fatal;}),e=>e===fatal);
  let calls=0; await assert.rejects(collectGraph('invalid',async()=>{calls++;})); assert.equal(calls,0);
});
test('every four-node DAG and completion scenario agrees with an independent readiness oracle', () => {
  const keys=['A-1','B-1','C-1','D-1'];
  const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  for(let bits=0;bits<64;bits++) for(let mask=0;mask<16;mask++) {
    const ns=keys.map((k,i)=>node(k,edges.filter(([a],e)=>a===i && (bits&(1<<e))).map(([,b])=>keys[b])));
    const done=keys.filter((_,i)=>mask&(1<<i));
    const active=new Set();
    function walk(i){if(done.includes(keys[i])||active.has(keys[i]))return;active.add(keys[i]);for(const d of ns[i].dependencies)walk(keys.indexOf(d));}
    walk(0);
    const ready=[...active].filter(k=>ns[keys.indexOf(k)].dependencies.every(d=>done.includes(d))).sort();
    const result=analyze(graph(...ns),done);
    assert.deepEqual(result.ready,ready); assert.equal(result.cycles.length,0);
  }
});
test('demo tells a reproducible story and briefing labels assumptions', () => {
  const initial=analyze(demoGraph); assert.deepEqual(initial.ready,['DATA-7']);
  assert.deepEqual(initial.cycles,[['OPS-10','OPS-9']]);
  const result=analyze(demoGraph,['DATA-7']); assert.deepEqual(result.ready,['BILL-18','WEB-23']);
  assert.match(briefing(demoGraph,result),/Hypothetical completions/);
});
