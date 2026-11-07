import {collectGraph} from './graph.js';

export function selectLinkType(catalog, requested) {
  if (!Array.isArray(catalog?.issueLinkTypes)) throw new Error('Jira link types could not be verified. No dependency conclusion was produced.');
  if (typeof requested !== 'string' || !requested.trim()) throw new Error('Choose an existing Jira dependency link type.');
  const value = requested.trim();
  const matches = catalog.issueLinkTypes.filter(t => typeof t.id === 'string' && typeof t.name === 'string' && (t.id === value || t.name === value));
  if (matches.length !== 1) throw new Error(`Unknown or ambiguous Jira link type "${value}". Enter its exact name or ID; no dependency conclusion was produced.`);
  const {id, name, inward, outward} = matches[0];
  return {id, name, inward, outward};
}

export async function loadValidatedGraph(root, requested, readTypes, readIssue, options = {}) {
  const linkType = selectLinkType(await readTypes(), requested);
  const graph = await collectGraph(root, readIssue, {...options, blockType: linkType.name, blockTypeId: linkType.id});
  return {...graph, linkType};
}
