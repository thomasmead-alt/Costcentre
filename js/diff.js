import { flatten } from './hierarchy.js';

export function diffTrees(currentTree, proposedTree, ks13 = []) {
  const current = currentTree ? flatten(currentTree) : { nodes: new Map(), ccs: new Map() };
  const proposed = proposedTree ? flatten(proposedTree) : { nodes: new Map(), ccs: new Map() };

  const nodeChanges = [];
  const ccChanges = [];

  for (const [key, info] of proposed.nodes) {
    if (info.node.type === 'costcentre') continue;
    if (!current.nodes.has(key)) {
      nodeChanges.push({ kind: 'new-node', key, node: info.node, parentPath: info.parentPath });
    } else {
      const prev = current.nodes.get(key);
      if (prev.parentPath !== info.parentPath || prev.node.label !== info.node.label) {
        nodeChanges.push({
          kind: 'changed-node',
          key,
          node: info.node,
          from: { parentPath: prev.parentPath, label: prev.node.label },
          to: { parentPath: info.parentPath, label: info.node.label }
        });
      }
    }
  }
  for (const [key, info] of current.nodes) {
    if (info.node.type === 'costcentre') continue;
    if (!proposed.nodes.has(key)) {
      nodeChanges.push({ kind: 'removed-node', key, node: info.node, parentPath: info.parentPath });
    }
  }

  const ks13Codes = new Set(ks13.map((r) => r.costCentre).filter(Boolean));

  for (const [code, info] of proposed.ccs) {
    if (!current.ccs.has(code)) {
      ccChanges.push({
        kind: 'new-cc',
        costCentre: code,
        node: info.node,
        parentPath: info.parentPath,
        inKS13: ks13Codes.has(code)
      });
    } else {
      const prev = current.ccs.get(code);
      if (prev.parentPath !== info.parentPath || prev.responsiblePersonId !== info.responsiblePersonId) {
        ccChanges.push({
          kind: 'changed-cc',
          costCentre: code,
          node: info.node,
          from: { parentPath: prev.parentPath, responsiblePersonId: prev.responsiblePersonId },
          to: { parentPath: info.parentPath, responsiblePersonId: info.responsiblePersonId }
        });
      }
    }
  }
  for (const [code, info] of current.ccs) {
    if (!proposed.ccs.has(code)) {
      ccChanges.push({
        kind: 'removed-cc',
        costCentre: code,
        node: info.node,
        parentPath: info.parentPath,
        inKS13: ks13Codes.has(code)
      });
    }
  }

  return { nodeChanges, ccChanges };
}

export function buildDiffKeys(changes) {
  const nodeKeysByState = new Map();
  const ccCodesByState = new Map();
  for (const c of changes.nodeChanges) nodeKeysByState.set(c.key, stateFromKind(c.kind));
  for (const c of changes.ccChanges) ccCodesByState.set(c.costCentre, stateFromKind(c.kind));
  return { nodeKeysByState, ccCodesByState };
}

function stateFromKind(kind) {
  if (kind.startsWith('new')) return 'new';
  if (kind.startsWith('removed')) return 'removed';
  return 'changed';
}
