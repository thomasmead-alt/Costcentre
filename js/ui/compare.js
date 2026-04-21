import { renderTree } from './tree.js';
import { diffTrees, buildDiffKeys } from '../diff.js';
import { describeTarget } from '../changelog.js';

export function renderCompare(containerIds, wb, { reviewedCodes, filter = 'all' } = {}) {
  const { currentTree, proposedTree, ks13 } = wb;
  const changes = diffTrees(currentTree, proposedTree, ks13);
  const diffState = buildDiffKeys(changes);

  document.getElementById(containerIds.current).innerHTML = '';
  document.getElementById(containerIds.proposed).innerHTML = '';

  renderTree(document.getElementById(containerIds.current), currentTree, {
    diffState,
    reviewedCodes,
    emptyText: 'No current hierarchy.'
  });
  renderTree(document.getElementById(containerIds.proposed), proposedTree, {
    diffState,
    reviewedCodes,
    emptyText: 'No proposed hierarchy.'
  });

  renderSummary(changes);
  renderList(containerIds.list, changes, filter);
  return changes;
}

function renderSummary(changes) {
  const el = document.getElementById('diff-summary');
  const c = {
    newNode: changes.nodeChanges.filter((x) => x.kind === 'new-node').length,
    changedNode: changes.nodeChanges.filter((x) => x.kind === 'changed-node').length,
    removedNode: changes.nodeChanges.filter((x) => x.kind === 'removed-node').length,
    newCC: changes.ccChanges.filter((x) => x.kind === 'new-cc').length,
    changedCC: changes.ccChanges.filter((x) => x.kind === 'changed-cc').length,
    removedCC: changes.ccChanges.filter((x) => x.kind === 'removed-cc').length
  };
  const totalNodes = c.newNode + c.changedNode + c.removedNode;
  const totalCcs = c.newCC + c.changedCC + c.removedCC;
  el.innerHTML = `
    <div class="diff-stat tone-ok"><div class="v">+${c.newNode}</div><div class="l">New nodes</div></div>
    <div class="diff-stat tone-warn"><div class="v">~${c.changedNode}</div><div class="l">Changed nodes</div></div>
    <div class="diff-stat tone-danger"><div class="v">−${c.removedNode}</div><div class="l">Removed nodes</div></div>
    <div class="diff-stat tone-ok"><div class="v">+${c.newCC}</div><div class="l">New cost centres</div></div>
    <div class="diff-stat tone-warn"><div class="v">~${c.changedCC}</div><div class="l">Changed cost centres</div></div>
    <div class="diff-stat tone-danger"><div class="v">−${c.removedCC}</div><div class="l">Removed cost centres</div></div>
    <div class="diff-stat tone-accent"><div class="v">${totalNodes + totalCcs}</div><div class="l">Total differences</div></div>`;
}

function renderList(listId, changes, filter) {
  const root = document.getElementById(listId);
  root.innerHTML = '';
  const items = [];
  if (filter === 'all' || filter === 'nodes') {
    changes.nodeChanges.forEach((c) => items.push(nodeRow(c)));
  }
  if (filter === 'all' || filter === 'ccs') {
    changes.ccChanges.forEach((c) => items.push(ccRow(c)));
  }
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No differences detected.';
    root.appendChild(empty);
    return;
  }
  items.forEach((row) => root.appendChild(row));
}

function nodeRow(change) {
  const row = document.createElement('div');
  row.className = 'diff-item';
  const badge = document.createElement('span');
  const state = stateOf(change.kind);
  badge.className = `badge ${state}`;
  badge.textContent = state;
  row.appendChild(badge);

  const desc = document.createElement('div');
  const label = change.node.label || change.node.id;
  const type = change.node.type;
  if (change.kind === 'changed-node') {
    desc.innerHTML = `<strong>${escapeHtml(type)}: ${escapeHtml(label)}</strong><br>` +
      `<small>${escapeHtml(change.from.parentPath)} → ${escapeHtml(change.to.parentPath)}</small>`;
  } else {
    desc.innerHTML = `<strong>${escapeHtml(type)}: ${escapeHtml(label)}</strong><br>` +
      `<small>${escapeHtml(change.parentPath || '')}</small>`;
  }
  row.appendChild(desc);

  const kindEl = document.createElement('span');
  kindEl.textContent = change.kind;
  row.appendChild(kindEl);

  const target = document.createElement('span');
  target.textContent = describeTarget({ kind: change.kind, target: { nodeType: type, nodeLabel: label, nodeId: change.node.id } });
  row.appendChild(target);

  return row;
}

function ccRow(change) {
  const row = document.createElement('div');
  row.className = 'diff-item';
  const state = stateOf(change.kind);
  const badge = document.createElement('span');
  badge.className = `badge ${state}`;
  badge.textContent = state;
  row.appendChild(badge);

  const desc = document.createElement('div');
  const code = change.costCentre;
  const label = change.node ? change.node.label : '';
  if (change.kind === 'changed-cc') {
    desc.innerHTML = `<strong>CC ${escapeHtml(code)} — ${escapeHtml(label)}</strong><br>` +
      `<small>${escapeHtml(change.from.parentPath)} → ${escapeHtml(change.to.parentPath)}</small>`;
  } else {
    desc.innerHTML = `<strong>CC ${escapeHtml(code)} — ${escapeHtml(label)}</strong><br>` +
      `<small>${escapeHtml(change.parentPath || '')}</small>`;
  }
  row.appendChild(desc);

  const kindEl = document.createElement('span');
  kindEl.textContent = change.kind;
  row.appendChild(kindEl);

  const inKS = document.createElement('span');
  inKS.textContent = change.inKS13 === false ? 'not in KS13' : '';
  row.appendChild(inKS);

  return row;
}

function stateOf(kind) {
  if (kind.startsWith('new')) return 'new';
  if (kind.startsWith('removed')) return 'removed';
  return 'changed';
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
