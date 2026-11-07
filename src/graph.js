export const KEY = /^[A-Z][A-Z0-9_]*-[1-9][0-9]*$/;

export function normalizeIssue(raw, blockType = 'Blocks', blockTypeId = null) {
  const f = raw.fields || {};
  const dependencies = [...new Set((f.issuelinks || [])
    .filter(link => (blockTypeId ? link.type?.id === blockTypeId : link.type?.name === blockType) && link.inwardIssue)
    .map(link => link.inwardIssue.key).filter(key => KEY.test(key)))].sort();
  return {key: raw.key, summary: f.summary || raw.key, status: f.status?.name || 'Unknown',
    done: f.status?.statusCategory?.key === 'done', owner: f.assignee?.displayName || null,
    updated: f.updated || null, dependencies, available: true};
}

// A failed read creates an explicit unknown node. Never copy title or status from
// a linked-issue stub: a fresh permission-aware read is the source of truth.
export async function collectGraph(root, readIssue, {maxNodes = 60, maxDepth = 8, maxMillis = 15000, now = Date.now, blockType = 'Blocks', blockTypeId = null} = {}) {
  if (!KEY.test(root)) throw new Error('Enter a Jira issue key such as REL-10.');
  const nodes = new Map(), queue = [[root, 0]], scheduled = new Set([root]);
  let requests = 0;
  const started = now();
  while (queue.length) {
    const [key, depth] = queue.shift();
    if (requests >= maxNodes || depth > maxDepth || now() - started >= maxMillis) {
      nodes.set(key, {key, available: false, reason: now() - started >= maxMillis ? 'time-budget' : 'limit', dependencies: [], done: false});
      continue;
    }
    requests++;
    let raw;
    try { raw = await readIssue(key); }
    catch (error) {
      // Authorization initialization must propagate so Forge can request consent.
      if (error?.fatal) throw error;
      nodes.set(key, {key, available: false, reason: error?.reason || 'unavailable', dependencies: [], done: false});
      continue;
    }
    const node = normalizeIssue(raw, blockType, blockTypeId);
    if (node.key !== key) throw new Error('Jira returned an unexpected issue key. Refresh the issue and retry.');
    nodes.set(key, node);
    if (node.done) continue;
    for (const dep of node.dependencies) if (!scheduled.has(dep)) {
      scheduled.add(dep); queue.push([dep, depth + 1]);
    }
  }
  if (!nodes.get(root)?.available) throw new Error('This issue could not be read. Check access or retry later.');
  return {root, nodes: [...nodes.values()], blockType, blockTypeId, requests, capturedAt: new Date().toISOString()};
}

export function analyze(graph, completed = []) {
  const byKey = new Map(graph.nodes.map(n => [n.key, n]));
  const assumed = new Set(completed.filter(k => byKey.get(k)?.available));
  const isDone = k => assumed.has(k) || byKey.get(k)?.done;
  // Only open dependencies of reachable open work affect this scenario.
  const active = new Set();
  const visit = k => {
    if (active.has(k) || isDone(k)) return;
    active.add(k);
    for (const d of byKey.get(k)?.dependencies || []) visit(d);
  };
  visit(graph.root);
  const deps = k => (byKey.get(k)?.dependencies || []).filter(d => active.has(d));
  const unknown = [...active].filter(k => !byKey.get(k)?.available).sort();
  const ready = [...active].filter(k => byKey.get(k)?.available && deps(k).length === 0).sort();
  const blocked = [...active].filter(k => byKey.get(k)?.available && deps(k).length > 0).sort();
  // Tarjan SCC detects mutually blocking work without mistaking a diamond for a cycle.
  let index = 0;
  const indices = new Map(), low = new Map(), stack = [], onStack = new Set(), cycles = [];
  function connect(k) {
    indices.set(k, index); low.set(k, index++); stack.push(k); onStack.add(k);
    for (const d of deps(k)) {
      if (!indices.has(d)) { connect(d); low.set(k, Math.min(low.get(k), low.get(d))); }
      else if (onStack.has(d)) low.set(k, Math.min(low.get(k), indices.get(d)));
    }
    if (low.get(k) === indices.get(k)) {
      const component = []; let v;
      do { v = stack.pop(); onStack.delete(v); component.push(v); } while (v !== k);
      if (component.length > 1 || deps(k).includes(k)) cycles.push(component.sort());
    }
  }
  for (const k of [...active].sort()) if (!indices.has(k)) connect(k);
  const paths = {};
  const queue = [[graph.root]];
  const seen = new Set();
  while (queue.length) {
    const path = queue.shift(), k = path.at(-1);
    if (seen.has(k) || !active.has(k)) continue;
    seen.add(k); paths[k] = path;
    for (const d of deps(k)) queue.push([...path, d]);
  }
  const choices = ready.map(key => ({key, unlocks: blocked.filter(k => {
    const remaining = deps(k); return remaining.length > 0 && remaining.every(d => d === key);
  })})).sort((a, b) => b.unlocks.length - a.unlocks.length || a.key.localeCompare(b.key));
  return {root: graph.root, active: [...active], ready, blocked, unknown, cycles, paths, choices,
    rootDone: isDone(graph.root), rootReady: ready.includes(graph.root), assumptions: [...assumed].sort(),
    coverage: unknown.length ? 'incomplete' : 'complete'};
}

export function briefing(graph, result) {
  const byKey = new Map(graph.nodes.map(n => [n.key, n]));
  const lines = [`Release Ledger: ${graph.root}`, `Snapshot: ${graph.capturedAt}`,
    `Traversal: ${result.coverage} for visible reachable open links of type ${graph.blockType}. Missing or hidden links cannot be inferred.`,
    result.rootDone ? 'Selected issue is marked Done in Jira or completed in this scenario; its dependencies were not traversed.' : result.rootReady ? 'Selected issue has no visible open linked blockers in this snapshot. This is not a work-readiness or release approval.' : 'Selected issue has unresolved linked dependencies.'];
  if (result.assumptions.length) lines.push(`Hypothetical completions (not written to Jira): ${result.assumptions.join(', ')}`);
  lines.push('Order: most direct linked dependents cleared, then issue key. This is not a priority or capacity estimate.');
  for (const c of result.choices) lines.push(`No visible open linked blockers: ${c.key} - ${byKey.get(c.key).summary}; Jira status ${byKey.get(c.key).status || 'Unknown'}; owner ${byKey.get(c.key).owner || 'unassigned'}; hypothetical completion clears the linked blockers of ${c.unlocks.join(', ') || 'no direct dependent'}. Evidence: ${result.paths[c.key].join(' <- blocked by <- ')}`);
  for (const group of result.cycles) lines.push(`Cycle requires coordination: ${group.join(', ')}`);
  for (const k of result.unknown) lines.push(`Unknown dependency: ${k}; ${byKey.get(k)?.reason || 'not loaded'}. Do not assume completion.`);
  lines.push('Done status and dependency links are Jira evidence, not proof of testing, acceptance, or delivery.');
  return lines.join('\n');
}
