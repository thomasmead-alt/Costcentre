import { findOrphans } from '../orphans.js';
import { addChild, createNode, findById, pathTo } from '../hierarchy.js';
import { updateWorkbook, getWorkbook } from '../storage.js';
import { createEntry } from '../changelog.js';
import { isReviewed, entryFor, markReviewed } from '../review.js';
import { toast } from './toast.js';

export function renderOrphans(containerId, { onChange } = {}) {
  const wb = getWorkbook();
  const root = document.getElementById(containerId);
  root.innerHTML = '';
  const orphans = findOrphans(wb.proposedTree, wb.ks13);
  if (orphans.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = wb.proposedTree
      ? 'No unassigned cost centres. All KS13 cost centres whose responsible person is in the proposed tree are already placed.'
      : 'Import a proposed hierarchy to see unassigned cost centres.';
    root.appendChild(empty);
    return;
  }

  const pcTotals = new Map();
  for (const row of wb.ks13) {
    const pc = row.profitCentre || '(none)';
    if (!pcTotals.has(pc)) pcTotals.set(pc, { total: 0, unassigned: 0, name: row.profitCentreName || '' });
    pcTotals.get(pc).total++;
  }
  for (const o of orphans) {
    const pc = o.profitCentre || '(none)';
    if (pcTotals.has(pc)) pcTotals.get(pc).unassigned++;
  }

  const grouped = new Map();
  for (const o of orphans) {
    const pc = o.profitCentre || '(none)';
    if (!grouped.has(pc)) grouped.set(pc, []);
    grouped.get(pc).push(o);
  }

  const pcs = [...grouped.keys()].sort();
  const summary = document.createElement('div');
  summary.className = 'orphan-summary';
  const totalUnassigned = orphans.length;
  summary.innerHTML = `<div class="diff-stat tone-warn"><div class="v">${totalUnassigned}</div><div class="l">Unassigned</div></div>
    <div class="diff-stat tone-accent"><div class="v">${pcs.length}</div><div class="l">Profit centres affected</div></div>`;
  root.appendChild(summary);

  for (const pc of pcs) {
    const items = grouped.get(pc);
    const totals = pcTotals.get(pc) || { total: items.length, unassigned: items.length, name: '' };
    const pctAssigned = totals.total ? Math.round(((totals.total - totals.unassigned) / totals.total) * 100) : 0;

    const group = document.createElement('div');
    group.className = 'orphan-group';
    const header = document.createElement('div');
    header.className = 'orphan-group-header';
    header.innerHTML = `
      <div><strong>PC ${escapeHtml(pc)}</strong> <small>${escapeHtml(totals.name || '')}</small></div>
      <div class="pc-track small"><div class="pc-fill ${pctAssigned === 100 ? 'seg-ok' : pctAssigned >= 50 ? 'seg-warn' : 'seg-danger'}" style="width:${pctAssigned}%"></div></div>
      <div><small>${totals.total - totals.unassigned}/${totals.total} placed · ${items.length} to assign</small></div>`;
    group.appendChild(header);

    for (const o of items) {
      const row = document.createElement('div');
      row.className = 'orphan-item';
      const reviewed = isReviewed(wb.reviewRegistry, o.costCentre);
      if (reviewed) row.classList.add('reviewed');

      const cc = document.createElement('span');
      cc.innerHTML = `<strong>${escapeHtml(o.costCentre)}</strong>`;
      row.appendChild(cc);

      const name = document.createElement('span');
      name.innerHTML = `${escapeHtml(o.costCentreName || '')}`;
      row.appendChild(name);

      const person = document.createElement('span');
      person.innerHTML = `${escapeHtml(o.responsiblePerson || '')}<br><small>${escapeHtml(o.responsiblePersonId || '')}</small>`;
      row.appendChild(person);

      const parent = document.createElement('span');
      const parentNode = findById(wb.proposedTree, o.suggestedParentId);
      parent.innerHTML = `<small>${escapeHtml(parentNode ? pathTo(wb.proposedTree, parentNode.id).map((p) => p.label || p.id).join(' / ') : '—')}</small>`;
      row.appendChild(parent);

      const actions = document.createElement('span');
      if (reviewed) {
        const link = document.createElement('button');
        link.type = 'button';
        link.textContent = 'Open log entry';
        link.addEventListener('click', () => {
          const id = entryFor(wb.reviewRegistry, o.costCentre);
          window.dispatchEvent(new CustomEvent('log:open', { detail: { id } }));
        });
        actions.appendChild(link);
      } else {
        const assign = document.createElement('button');
        assign.type = 'button';
        assign.className = 'primary';
        assign.textContent = 'Assign';
        assign.addEventListener('click', () => assignOrphan(o, onChange));
        actions.appendChild(assign);
      }
      row.appendChild(actions);
      group.appendChild(row);
    }

    root.appendChild(group);
  }
}

function assignOrphan(orphan, onChange) {
  const wb = getWorkbook();
  if (isReviewed(wb.reviewRegistry, orphan.costCentre)) {
    toast(`CC ${orphan.costCentre} already reviewed`, 'warn');
    return;
  }
  updateWorkbook((w) => {
    const parent = findById(w.proposedTree, orphan.suggestedParentId);
    if (!parent) return;
    const node = createNode('costcentre', {
      label: orphan.costCentreName || orphan.costCentre,
      costCentreCode: orphan.costCentre,
      profitCentre: orphan.profitCentre
    });
    addChild(w.proposedTree, parent.id, node);
    const entry = createEntry({
      kind: 'assigned-cc',
      target: {
        costCentre: orphan.costCentre,
        costCentreName: orphan.costCentreName,
        profitCentre: orphan.profitCentre,
        responsiblePersonId: orphan.responsiblePersonId,
        nodeId: node.id,
        nodeLabel: node.label,
        nodeType: 'costcentre'
      },
      user: w.user,
      note: `Assigned from orphan list to ${parent.label || parent.id}`
    });
    w.changeLog.push(entry);
    markReviewed(w.reviewRegistry, orphan.costCentre, entry.id);
  });
  toast(`CC ${orphan.costCentre} assigned`, 'ok');
  onChange && onChange();
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
