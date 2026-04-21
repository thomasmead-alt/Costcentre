import { flatten, findPersonByPersonId } from './hierarchy.js';

export function findOrphans(proposedTree, ks13) {
  if (!proposedTree || !Array.isArray(ks13) || ks13.length === 0) return [];
  const { ccs } = flatten(proposedTree);
  const out = [];
  for (const row of ks13) {
    if (!row.costCentre) continue;
    if (ccs.has(row.costCentre)) continue;
    const personKey = row.responsiblePersonId || row.responsiblePerson;
    if (!personKey) continue;
    const person = findPersonByPersonId(proposedTree, personKey);
    if (!person) continue;
    out.push({
      costCentre: row.costCentre,
      costCentreName: row.costCentreName,
      profitCentre: row.profitCentre,
      profitCentreName: row.profitCentreName,
      responsiblePerson: row.responsiblePerson,
      responsiblePersonId: personKey,
      suggestedParentId: person.id
    });
  }
  return out;
}
