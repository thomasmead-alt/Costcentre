export const NODE_TYPES = ['manager', 'person', 'costcentre'];

export function uid(prefix = 'n') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createNode(type, fields = {}) {
  const node = {
    id: fields.id || uid(type === 'costcentre' ? 'cc' : type === 'person' ? 'p' : 'm'),
    type,
    label: fields.label || '',
    children: []
  };
  if (type === 'person' && fields.personId) node.personId = fields.personId;
  if (type === 'costcentre') {
    node.costCentreCode = fields.costCentreCode || '';
    if (fields.profitCentre) node.profitCentre = fields.profitCentre;
  }
  return node;
}

export function cloneTree(node) {
  if (!node) return null;
  return JSON.parse(JSON.stringify(node));
}

export function ensureRoot(tree) {
  if (tree && tree.id) return tree;
  return createNode('manager', { id: 'root', label: 'Organisation' });
}

export function walk(node, fn, parents = []) {
  if (!node) return;
  fn(node, parents);
  const chain = parents.concat(node);
  (node.children || []).forEach((child) => walk(child, fn, chain));
}

export function findById(tree, id) {
  let found = null;
  walk(tree, (n) => { if (n.id === id) found = n; });
  return found;
}

export function findParent(tree, id) {
  let parent = null;
  walk(tree, (n) => {
    (n.children || []).forEach((c) => { if (c.id === id) parent = n; });
  });
  return parent;
}

export function findPersonByPersonId(tree, personId) {
  let found = null;
  walk(tree, (n) => { if (n.type === 'person' && n.personId === personId) found = n; });
  return found;
}

export function findCostCentre(tree, code) {
  let found = null;
  walk(tree, (n) => { if (n.type === 'costcentre' && n.costCentreCode === code) found = n; });
  return found;
}

export function pathTo(tree, id) {
  const path = [];
  const visit = (node, parents) => {
    if (node.id === id) {
      parents.concat(node).forEach((p) => path.push({ id: p.id, label: p.label, type: p.type }));
    } else {
      (node.children || []).forEach((c) => visit(c, parents.concat(node)));
    }
  };
  visit(tree, []);
  return path;
}

export function addChild(tree, parentId, node) {
  const parent = findById(tree, parentId);
  if (!parent) throw new Error(`Parent ${parentId} not found`);
  parent.children = parent.children || [];
  parent.children.push(node);
  return node;
}

export function removeNode(tree, id) {
  const parent = findParent(tree, id);
  if (!parent) return null;
  const idx = parent.children.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const [removed] = parent.children.splice(idx, 1);
  return removed;
}

export function moveNode(tree, id, newParentId) {
  if (id === newParentId) throw new Error('Cannot move a node into itself');
  const target = findById(tree, id);
  if (!target) throw new Error(`Node ${id} not found`);
  if (findById(target, newParentId)) throw new Error('Cannot move a node into its descendant');
  const removed = removeNode(tree, id);
  addChild(tree, newParentId, removed);
  return removed;
}

export function renameNode(tree, id, label) {
  const node = findById(tree, id);
  if (!node) return null;
  node.label = label;
  return node;
}

export function flatten(tree) {
  const nodes = new Map();
  const ccs = new Map();
  walk(tree, (n, parents) => {
    const parent = parents[parents.length - 1];
    const parentPath = parents.map((p) => p.id).join('>');
    const key = nodeKey(n);
    nodes.set(key, { node: n, parentId: parent ? parent.id : null, parentPath });
    if (n.type === 'costcentre' && n.costCentreCode) {
      ccs.set(n.costCentreCode, {
        node: n,
        parentId: parent ? parent.id : null,
        parentPath,
        responsiblePersonId: responsiblePersonFor(parents)
      });
    }
  });
  return { nodes, ccs };
}

export function nodeKey(node) {
  if (node.type === 'person' && node.personId) return `person:${node.personId}`;
  if (node.type === 'costcentre' && node.costCentreCode) return `cc:${node.costCentreCode}`;
  return `${node.type}:${node.id}`;
}

function responsiblePersonFor(parents) {
  for (let i = parents.length - 1; i >= 0; i--) {
    if (parents[i].type === 'person') return parents[i].personId || parents[i].label;
  }
  return null;
}

export function deserialize(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') raw = JSON.parse(raw);
  const visit = (n) => {
    const node = createNode(n.type || 'manager', {
      id: n.id,
      label: n.label || '',
      personId: n.personId,
      costCentreCode: n.costCentreCode,
      profitCentre: n.profitCentre
    });
    node.children = Array.isArray(n.children) ? n.children.map(visit) : [];
    return node;
  };
  return visit(raw);
}

export function summarise(tree) {
  if (!tree) return { managers: 0, persons: 0, costCentres: 0 };
  let managers = 0, persons = 0, costCentres = 0;
  walk(tree, (n) => {
    if (n.type === 'manager') managers++;
    else if (n.type === 'person') persons++;
    else if (n.type === 'costcentre') costCentres++;
  });
  return { managers, persons, costCentres };
}
