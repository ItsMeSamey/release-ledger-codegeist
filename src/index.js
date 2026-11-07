import {makeResolver} from '@forge/resolver';
import api, {route} from '@forge/api';
import {analyze, briefing, KEY} from './graph.js';
import {loadValidatedGraph} from './service.js';

const fields = 'summary,status,assignee,updated,issuelinks';
async function readLinkTypes() {
  const response = await api.asUser().requestJira(route`/rest/api/3/issueLinkType`, {headers: {Accept: 'application/json'}});
  if (!response.ok) throw new Error('Jira link types could not be verified. Check issue linking and access, then retry.');
  return response.json();
}
async function readIssue(key) {
  let response;
  try {
    response = await api.asUser().requestJira(route`/rest/api/3/issue/${key}?fields=${fields}`, {headers: {Accept: 'application/json'}});
  } catch (error) {
    // SDK exceptions include consent initialization and transport failures.
    // Propagate them unchanged in meaning; never switch to the app identity.
    error.fatal = true;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Issue unavailable');
    error.reason = response.status === 429 ? 'rate-limited' : response.status >= 500 ? 'temporary-error' : 'unavailable';
    throw error;
  }
  return response.json();
}
export const handler = makeResolver({loadGraph: async ({context, payload}) => {
  const key = context.extension?.issue?.key;
  if (!key || !KEY.test(key)) throw new Error('Open Release Ledger from a Jira issue.');
  const blockType = typeof payload?.blockType === 'string' ? payload.blockType.trim().slice(0, 80) : 'Blocks';
  if (!blockType) throw new Error('Choose a dependency link type.');
  return loadValidatedGraph(key, blockType, readLinkTypes, readIssue);
}});

export async function explainBlockers(payload) {
  const issueKey = typeof payload?.issueKey === 'string' ? payload.issueKey.trim().toUpperCase() : '';
  if (!KEY.test(issueKey)) return {error: 'Provide a valid Jira issue key.'};
  const graph = await loadValidatedGraph(issueKey, 'Blocks', readLinkTypes, readIssue);
  const result = analyze(graph);
  return {briefing: briefing(graph, result), evidence: graph, analysis: result};
}
