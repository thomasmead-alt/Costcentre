import { parseCSV, toCSV } from './csv.js';
import { createNode, addChild } from './hierarchy.js';

const LEVEL_RE = /^(?:level|l|manager l|manager level|tier)\s*(\d+)$/i;
const ALIASES = {
  person: ['person', 'responsible person', 'responsible'],
  personId: ['person id', 'responsible person id', 'employee id', 'user id', 'personid'],
  costCentre: ['cost centre', 'cost center', 'cc', 'ks13', 'costcentre'],
  costCentreName: ['cost centre name', 'cost center name', 'cc name', 'costcentre name', 'description'],
  profitCentre: ['profit centre', 'profit center', 'pc', 'profitcentre']
};

export function parseHierarchyCsv(text) {
  const { headers, rows } = parseCSV(text);
  if (headers.length === 0) throw new Error('CSV has no headers');
  const lower = headers.map((h) => h.toLowerCase().trim());
  const levelCols = [];
  lower.forEach((h, i) => {
    const m = h.match(LEVEL_RE);
    if (m) levelCols.push({ index: i, depth: Number(m[1]) });
  });
  levelCols.sort((a, b) => a.depth - b.depth);

  const col = (key) => {
    const aliases = ALIASES[key];
    return lower.findIndex((h) => aliases.includes(h));
  };
  const personCol = col('person');
  const personIdCol = col('personId');
  const ccCol = col('costCentre');
  const ccNameCol = col('costCentreName');
  const pcCol = col('profitCentre');

  if (levelCols.length === 0 && personCol < 0 && ccCol < 0) {
    throw new Error('CSV needs at least one Level column, a Person column, or a Cost Centre column');
  }

  const root = createNode('manager', { id: 'root', label: 'Organisation' });
  const managerIndex = new Map();
  const personIndex = new Map();
  const ccIndex = new Set();

  for (const row of rows) {
    let parent = root;
    let pathKey = '';
    for (const lc of levelCols) {
      const label = (row[lc.index] || '').trim();
      if (!label) continue;
      pathKey += `>${lc.depth}:${label}`;
      let node = managerIndex.get(pathKey);
      if (!node) {
        node = createNode('manager', { label });
        addChild(root, parent.id, node);
        managerIndex.set(pathKey, node);
      }
      parent = node;
    }

    const personLabel = personCol >= 0 ? (row[personCol] || '').trim() : '';
    const personId = personIdCol >= 0 ? (row[personIdCol] || '').trim() : '';
    if (personLabel || personId) {
      const personKey = `${pathKey}|${personId || personLabel}`;
      let node = personIndex.get(personKey);
      if (!node) {
        node = createNode('person', { label: personLabel || personId, personId: personId || personLabel });
        addChild(root, parent.id, node);
        personIndex.set(personKey, node);
      }
      parent = node;
    }

    const code = ccCol >= 0 ? (row[ccCol] || '').trim() : '';
    const ccName = ccNameCol >= 0 ? (row[ccNameCol] || '').trim() : '';
    const pc = pcCol >= 0 ? (row[pcCol] || '').trim() : '';
    if (code) {
      if (ccIndex.has(code)) continue;
      const node = createNode('costcentre', { label: ccName || code, costCentreCode: code, profitCentre: pc });
      addChild(root, parent.id, node);
      ccIndex.add(code);
    }
  }

  return root;
}

export function serializeHierarchyCsv(tree) {
  if (!tree) return '';
  let maxDepth = 0;
  const leaves = [];
  const visit = (node, managerChain, person) => {
    if (node.type === 'manager') {
      const chain = node.id === tree.id ? managerChain : managerChain.concat(node.label || '');
      maxDepth = Math.max(maxDepth, chain.length);
      if (!node.children || node.children.length === 0) {
        leaves.push({ chain, person: null, cc: null });
        return;
      }
      for (const child of node.children) visit(child, chain, person);
      return;
    }
    if (node.type === 'person') {
      const nextPerson = { label: node.label || '', personId: node.personId || '' };
      if (!node.children || node.children.length === 0) {
        leaves.push({ chain: managerChain, person: nextPerson, cc: null });
        return;
      }
      for (const child of node.children) visit(child, managerChain, nextPerson);
      return;
    }
    if (node.type === 'costcentre') {
      leaves.push({
        chain: managerChain,
        person,
        cc: { code: node.costCentreCode || '', name: node.label || '', profitCentre: node.profitCentre || '' }
      });
    }
  };
  visit(tree, [], null);

  const headers = [];
  for (let i = 1; i <= Math.max(1, maxDepth); i++) headers.push(`Level ${i}`);
  headers.push('Responsible Person', 'Person ID', 'Cost Centre', 'Cost Centre Name', 'Profit Centre');

  const rows = [headers];
  for (const leaf of leaves) {
    const row = [];
    for (let i = 0; i < headers.length - 5; i++) row.push(leaf.chain[i] || '');
    row.push(leaf.person?.label || '', leaf.person?.personId || '');
    row.push(leaf.cc?.code || '', leaf.cc?.name || '', leaf.cc?.profitCentre || '');
    rows.push(row);
  }
  return toCSV(rows);
}
