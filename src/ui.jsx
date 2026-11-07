import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {analyze, briefing} from './graph.js';
import {demoGraph} from './demo.js';
import './style.css';

const demo = import.meta.env.DEV && new URLSearchParams(location.search).get('demo') === '1';
function App() {
  const [graph, setGraph] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState([]), [selected, setSelected] = useState(null), [blockType, setBlockType] = useState('Blocks');
  const [showBrief, setShowBrief] = useState(false);
  const scenarioReset = useRef(null), firstChoice = useRef(null), refreshControl = useRef(null), evidenceHeading = useRef(null), pendingFocus = useRef(null);
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === 'scenario') (scenarioReset.current || refreshControl.current)?.focus();
    if (target === 'baseline') (firstChoice.current || refreshControl.current)?.focus();
    if (target === 'evidence') evidenceHeading.current?.focus();
  }, [completed, selected]);
  async function load() {
    setBusy(true); setError(''); setCompleted([]); setShowBrief(false);
    try { const value = demo ? structuredClone(demoGraph) : await (await import('@forge/bridge')).invoke('loadGraph', {blockType}); setCompleted([]); setGraph(value); setSelected(value.root); }
    catch (e) { setGraph(null); setError(e?.message || 'Could not read Jira. Open the app from an issue and retry.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  const result = useMemo(() => graph && analyze(graph, completed), [graph, completed]);
  const baseline = useMemo(() => graph && analyze(graph), [graph]);
  if (!graph) return <main><div className="brand">RELEASE LEDGER</div><h1>Find the next move.</h1><p>Follow the work between an issue and delivery.</p>{busy ? <p role="status">Reading dependency evidence...</p> : <><p role="alert">{error}</p><label>Dependency link type (exact name or ID) <input value={blockType} onChange={e => setBlockType(e.target.value)} maxLength={80}/></label><button onClick={load}>Try again</button><p className="muted">Local preview: start the demo server and append ?demo=1. Production requires a Jira issue panel.</p></>}</main>;
  const nodes = new Map(graph.nodes.map(n => [n.key, n]));
  const detail = nodes.get(selected);
  const levels = [];
  for (const key of baseline.active) {
    const depth = (baseline.paths[key]?.length || 1) - 1;
    (levels[depth] ||= []).push(key);
  }
  const newlyReady = result.ready.filter(k => !baseline.ready.includes(k));
  const state = k => completed.includes(k) ? 'assumed' : !result.active.includes(k) ? 'outside' : result.unknown.includes(k) ? 'unknown' : result.ready.includes(k) ? 'ready' : 'blocked';
  function toggle(key, focusTarget = null) {
    if (busy) return;
    pendingFocus.current = focusTarget;
    setCompleted(value => value.includes(key) ? value.filter(k => k !== key) : [...value, key]);
  }
  function resetScenario() { if (busy) return; pendingFocus.current = 'baseline'; setCompleted([]); }
  const evidence = (key, fromDetail = false) => <button className="text-button" onClick={() => {
    if (fromDetail && key !== selected) pendingFocus.current = 'evidence';
    setSelected(key);
  }}>{key}</button>;
  return <main>
    {demo && <div className="demo">SYNTHETIC DEMO / No connection to Jira</div>}
    <header><div><div className="brand">RELEASE LEDGER <span>01 / DEPENDENCIES</span></div><h1>Find the next move.</h1><p className="subtitle">{graph.root} <span>/</span> {nodes.get(graph.root).summary}</p></div><button ref={refreshControl} className="secondary" disabled={busy} onClick={load}>{busy ? 'Refreshing...' : 'Refresh evidence'}</button></header>
    <section className="metrics" aria-label="Dependency overview">
      <article><b>{result.ready.length}</b><span>no open linked blockers</span></article><article><b>{result.blocked.length}</b><span>open linked blockers</span></article><article><b>{result.cycles.length}</b><span>dependency cycles</span></article><article className={result.unknown.length ? 'warn' : ''}><b>{result.unknown.length}</b><span>unknown dependencies</span></article>
    </section>
    <div className="toolbar"><label>Dependency link type (name or ID) <input value={blockType} onChange={e => setBlockType(e.target.value)} maxLength={80}/></label><button className="secondary" onClick={load} disabled={busy || demo}>Apply & refresh</button><span className="muted">Snapshot {new Date(graph.capturedAt).toLocaleString()} / {graph.blockType}</span></div>
    {completed.length > 0 && <div className="scenario" role="status"><div><strong>What if {completed.length} task{completed.length > 1 ? 's were' : ' was'} completed?</strong><br/>{newlyReady.length ? `${newlyReady.join(', ')} have no visible open linked blockers in this scenario.` : 'No additional task has cleared its visible linked blockers.'} This scenario changes no Jira data.</div><button ref={scenarioReset} className="secondary" disabled={busy} onClick={resetScenario}>Reset scenario</button></div>}
    <div className="columns"><section className="next"><div className="section-label">YOUR NEXT MOVES</div><h2>Inspect the unblocked end of the chain.</h2><p>These issues have no visible open blockers of the selected link type. This does not establish capacity, workflow readiness, or priority. Order: most direct linked dependents cleared, then issue key.</p>
      {result.rootDone ? <p className="notice">The selected issue is marked Done in Jira. Its dependency chain was not traversed; Done is not proof of acceptance or delivery.</p> : result.choices.length === 0 && <p className="empty">Every visible open issue has a linked dependency or missing evidence. Inspect the cycles and unknown dependencies below.</p>}
      {result.choices.map((choice, i) => <article className="choice" key={choice.key}><div className="rank">{String(i + 1).padStart(2, '0')}</div><div><div>{evidence(choice.key)} <span className="badge ready">No open linked blockers</span></div><h3>{nodes.get(choice.key).summary}</h3><p>{nodes.get(choice.key).owner || 'Unassigned'} / {nodes.get(choice.key).status} / Linked blockers cleared for {choice.unlocks.length ? choice.unlocks.join(', ') : 'no direct dependent'}</p><div className="path">{result.paths[choice.key].join(' <- ')}</div>{choice.key !== graph.root && <button ref={i === 0 ? firstChoice : null} className="secondary" disabled={busy} onClick={() => toggle(choice.key, 'scenario')}>Try completing this</button>}</div></article>)}
      {result.cycles.map(group => <article className="alert" key={group.join()}><strong>Coordinate this cycle</strong><p>{group.map((k, i) => <React.Fragment key={k}>{i > 0 && ' / '}{evidence(k)}</React.Fragment>)}</p><p>These tasks block one another. Review the links or agree how work can proceed together.</p></article>)}
      {result.unknown.length > 0 && <article className="alert"><strong>The picture is incomplete</strong><p>{result.unknown.map((k, i) => <React.Fragment key={k}>{i > 0 && ', '}{evidence(k)}</React.Fragment>)}</p><p>Unreadable or unvisited work stays unresolved. Access errors and request limits are not evidence of completion.</p></article>}
      {result.rootReady && <article className="notice">The selected issue has no visible open blockers of the selected link type. Check workflow, capacity, and acceptance criteria separately.</article>}
    </section><aside><div className="section-label">ISSUE EVIDENCE</div>{detail && <><h2 ref={evidenceHeading} tabIndex={-1}>{detail.key}</h2><p className="detail-title">{detail.summary || 'Evidence unavailable'}</p><dl><dt>Status</dt><dd>{detail.available ? detail.status : detail.reason}</dd><dt>Owner</dt><dd>{detail.available ? detail.owner || 'Unassigned' : 'Unknown'}</dd><dt>Last updated</dt><dd>{detail.updated ? new Date(detail.updated).toLocaleString() : 'Unknown'}</dd><dt>Blocked by</dt><dd>{detail.dependencies.length ? detail.dependencies.map((key, i) => <React.Fragment key={key}>{i > 0 && ', '}{evidence(key, true)}</React.Fragment>) : detail.available ? 'No linked blockers' : 'Unknown'}</dd></dl>{detail.available && detail.key !== graph.root && !detail.done && <label className="check"><input type="checkbox" disabled={busy} checked={completed.includes(detail.key)} onChange={() => toggle(detail.key)}/>Assume complete in scenario</label>}{detail.available && !demo && <button className="secondary" onClick={async () => (await import('@forge/bridge')).router.open(`/browse/${detail.key}`)}>Open Jira issue</button>}<p className="muted">Evidence comes from issue status and the configured inward dependency links. Hidden or missing links cannot be inferred. The selected inward relation is interpreted as a blocker.</p></>}</aside></div>
    <section className="map"><div className="section-label">FOLLOW THE DEPENDENCIES</div><h2>From delivery to the work beneath it.</h2><p>Each column is one step farther from the selected issue. Select a card to inspect its source evidence.</p><div className="layers">{levels.map((keys, i) => <div className="layer" key={i}><h3>{i === 0 ? 'Selected issue' : `Dependency depth ${i}`}</h3>{keys.map(key => <button key={key} className={`node ${state(key)} ${selected === key ? 'selected' : ''}`} onClick={() => setSelected(key)}><strong>{key}</strong><span>{nodes.get(key)?.summary || 'Unknown dependency'}</span><em>{state(key) === 'outside' ? 'Not needed in this scenario' : state(key) === 'assumed' ? 'Assumed complete' : state(key) === 'ready' ? 'No open linked blockers' : state(key) === 'blocked' ? 'Open linked blockers' : state(key)}</em></button>)}</div>)}</div></section>
    <footer><div><strong>Bring evidence to the release conversation.</strong><p>Scope: reachable open blockers, up to 60 reads and 8 dependency levels. Done issues stop traversal.</p></div><button onClick={() => setShowBrief(!showBrief)}>{showBrief ? 'Hide' : 'Prepare'} briefing</button></footer>
    {showBrief && <section><label htmlFor="brief">Copy this briefing into your planning notes</label><textarea id="brief" readOnly value={briefing(graph, result)} rows={14}/></section>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
