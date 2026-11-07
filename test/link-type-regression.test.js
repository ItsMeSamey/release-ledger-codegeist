import test from 'node:test';
import assert from 'node:assert/strict';
import {loadValidatedGraph, selectLinkType} from '../src/service.js';
import {analyze, briefing} from '../src/graph.js';

const catalog = {issueLinkTypes:[{id:'10000',name:'Blocks',inward:'is blocked by',outward:'blocks'}]};
const raw = (key, dependencies=[]) => ({key,fields:{summary:key,status:{name:'In progress',statusCategory:{key:'indeterminate'}},issuelinks:dependencies.map(key=>({type:{id:'10000',name:'Old cached name'},inwardIssue:{key}}))}});

test('unknown link-type typo fails before any issue collection',async()=>{
 let calls=0;
 await assert.rejects(loadValidatedGraph('R-1','Block',async()=>catalog,async()=>{calls++;return raw('R-1');}),/Unknown or ambiguous Jira link type/);
 assert.equal(calls,0);
});
test('valid type matches verified identity rather than cached link name',async()=>{
 const g=await loadValidatedGraph('R-1','Blocks',async()=>catalog,async key=>raw(key,key==='R-1'?['D-1']:[]));
 assert.equal(g.linkType.id,'10000'); assert.deepEqual(analyze(g).blocked,['R-1']);
 assert.deepEqual(analyze(g).ready,['D-1']);
 const text=briefing(g,analyze(g));
 assert.match(text,/No visible open linked blockers: D-1/);
 assert.match(text,/Jira status In progress/);
 assert.doesNotMatch(text,/Ready:|ready to start|can now start/);
});
test('known type with zero links is distinct from unknown configuration',async()=>{
 const g=await loadValidatedGraph('R-1','10000',async()=>catalog,async key=>raw(key));
 assert.equal(analyze(g).rootReady,true); assert.equal(g.blockType,'Blocks');
 assert.equal(g.blockTypeId,'10000');
});
test('unavailable or ambiguous catalog cannot produce a clear graph',async()=>{
 assert.throws(()=>selectLinkType({},'Blocks'),/could not be verified/);
 assert.throws(()=>selectLinkType({issueLinkTypes:[...catalog.issueLinkTypes,{id:'10001',name:'Blocks'}]},'Blocks'),/ambiguous/);
 let calls=0;
 await assert.rejects(loadValidatedGraph('R-1','Blocks',async()=>{throw new Error('API unavailable');},async()=>{calls++;}),/API unavailable/);
 assert.equal(calls,0);
});
