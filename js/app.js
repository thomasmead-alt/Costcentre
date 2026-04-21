import { loadWorkbook, getWorkbook, updateWorkbook, exportJSON, importJSON, resetWorkbook, subscribe } from './storage.js';
import { renderTree, pickParent } from './ui/tree.js';
import { initImportPanel, refreshSummaries } from './ui/import.js';
import { renderCompare } from './ui/compare.js';
import { renderOrphans } from './ui/orphans.js';
import { initChangelogPanel, render as renderLog } from './ui/changelog.js';
import { toast } from './ui/toast.js';
import { createNode, addChild, removeNode, moveNode, renameNode, ensureRoot, findById } from './hierarchy.js';
import { createEntry } from './changelog.js';
import { isReviewed, markReviewed } from './review.js';

const TAB_PANELS = ['import', 'current', 'proposed', 'compare', 'orphans', 'changelog'];
let currentFilter = 'all';

function main() {
  loadWorkbook();
  wireTabs();
  wireHeader();
  initImportPanel({ onChange: rerenderAll });
  initChangelogPanel({ onChange: rerenderAll });
  wireProposedToolbar();
  wireCompareFilter();
  subscribe(() => {
    refreshUser();
  });
  rerenderAll();
}

function wireTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
      rerenderAll();
    });
  });
}

function wireHeader() {
  document.getElementById('btn-export').addEventListener('click', () => {
    exportJSON();
    toast('Workbook exported', 'ok');
  });
  document.getElementById('file-import-workbook').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importJSON(file);
      toast('Workbook imported', 'ok');
      rerenderAll();
    } catch (err) {
      toast(`Import failed: ${err.message}`, 'err');
    }
    e.target.value = '';
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('Reset clears all KS13 data, hierarchies, change log and review registry. Continue?')) return;
    resetWorkbook();
    toast('Workbook reset', 'warn');
    rerenderAll();
  });
  const userChip = document.getElementById('user-chip');
  userChip.addEventListener('click', () => {
    const current = getWorkbook().user || '';
    const val = prompt('Your initials (shown in audit entries)', current);
    if (val === null) return;
    updateWorkbook((wb) => { wb.user = val.trim().slice(0, 4).toUpperCase(); });
    refreshUser();
  });
  refreshUser();
}

function refreshUser() {
  const chip = document.getElementById('user-chip');
  const u = getWorkbook().user;
  chip.textContent = u || '--';
}

function wireProposedToolbar() {
  document.getElementById('btn-add-root-manager').addEventListener('click', () => {
    const label = prompt('New top-level manager label');
    if (!label) return;
    updateWorkbook((wb) => {
      wb.proposedTree = ensureRoot(wb.proposedTree);
      const node = createNode('manager', { label });
      addChild(wb.proposedTree, wb.proposedTree.id, node);
      logNodeChange('new-node', node, 'added-top-level');
    });
    rerenderAll();
  });
}

function wireCompareFilter() {
  document.querySelectorAll('input[name="diff-filter"]').forEach((r) => {
    r.addEventListener('change', () => {
      currentFilter = document.querySelector('input[name="diff-filter"]:checked').value;
      renderActivePanel();
    });
  });
}

function rerenderAll() {
  renderActivePanel();
  refreshSummaries();
  renderLog();
}

function renderActivePanel() {
  const active = document.querySelector('.panel.active');
  if (!active) return;
  const wb = getWorkbook();
  const reviewedCodes = new Set(Object.keys(wb.reviewRegistry || {}));
  const panel = active.dataset.panel;
  if (panel === 'current') {
    renderTree(document.getElementById('current-tree'), wb.currentTree, {
      reviewedCodes,
      emptyText: 'No current hierarchy imported yet.'
    });
  } else if (panel === 'proposed') {
    renderTree(document.getElementById('proposed-tree'), wb.proposedTree, {
      reviewedCodes,
      editable: true,
      onAction: handleProposedAction,
      emptyText: 'No proposed hierarchy. Import one or seed from current, then add a top-level manager.'
    });
  } else if (panel === 'compare') {
    renderCompare({ current: 'compare-current', proposed: 'compare-proposed', list: 'diff-list' }, wb, {
      reviewedCodes,
      filter: currentFilter
    });
  } else if (panel === 'orphans') {
    renderOrphans('orphan-list', { onChange: rerenderAll });
  }
}

async function handleProposedAction(action, node) {
  const wb = getWorkbook();
  if (action === 'rename') {
    const label = prompt('New label', node.label);
    if (label == null || label === node.label) return;
    updateWorkbook(() => {
      renameNode(wb.proposedTree, node.id, label);
      logNodeChange('changed-node', node, `renamed from "${node.label}"`);
    });
    rerenderAll();
    return;
  }
  if (action === 'remove') {
    if (!confirm(`Remove ${node.type} "${node.label}" and all its descendants?`)) return;
    const hasReviewedCC = containsReviewedCC(node, wb.reviewRegistry);
    if (hasReviewedCC && !confirm('This subtree contains reviewed cost centres. Remove anyway?')) return;
    updateWorkbook(() => {
      logNodeChange('removed-node', node, 'removed');
      removeNode(wb.proposedTree, node.id);
    });
    rerenderAll();
    return;
  }
  if (action === 'move') {
    const parentId = await pickParent(wb.proposedTree, { excludeId: node.id });
    if (!parentId) return;
    try {
      updateWorkbook(() => {
        moveNode(wb.proposedTree, node.id, parentId);
        logNodeChange('changed-node', node, `moved to ${findById(wb.proposedTree, parentId)?.label || parentId}`);
      });
      rerenderAll();
    } catch (err) {
      toast(err.message, 'err');
    }
    return;
  }
  if (action === 'add-manager' || action === 'add-person' || action === 'add-cc') {
    const type = action === 'add-manager' ? 'manager' : action === 'add-person' ? 'person' : 'costcentre';
    const label = prompt(`Label for new ${type}`);
    if (!label) return;
    let personId, costCentreCode;
    if (type === 'person') {
      personId = prompt('Person ID (optional but recommended for diffing)') || '';
    }
    if (type === 'costcentre') {
      costCentreCode = prompt('Cost centre code');
      if (!costCentreCode) return;
      if (isReviewed(wb.reviewRegistry, costCentreCode)) {
        toast(`CC ${costCentreCode} already has a log entry`, 'warn');
        return;
      }
    }
    updateWorkbook(() => {
      const newNode = createNode(type, { label, personId, costCentreCode });
      addChild(wb.proposedTree, node.id, newNode);
      if (type === 'costcentre') {
        const entry = createEntry({
          kind: 'new-cc',
          target: {
            costCentre: costCentreCode,
            costCentreName: label,
            nodeId: newNode.id,
            nodeLabel: label,
            nodeType: 'costcentre'
          },
          user: wb.user,
          note: `Added under ${node.label || node.id}`
        });
        wb.changeLog.push(entry);
        markReviewed(wb.reviewRegistry, costCentreCode, entry.id);
      } else {
        logNodeChange('new-node', newNode, `added under ${node.label || node.id}`);
      }
    });
    rerenderAll();
  }
}

function logNodeChange(kind, node, note) {
  const wb = getWorkbook();
  const entry = createEntry({
    kind,
    target: {
      nodeId: node.id,
      nodeType: node.type,
      nodeLabel: node.label,
      personId: node.personId,
      costCentre: node.costCentreCode
    },
    user: wb.user,
    note
  });
  wb.changeLog.push(entry);
  if (node.type === 'costcentre' && node.costCentreCode) {
    markReviewed(wb.reviewRegistry, node.costCentreCode, entry.id);
  }
}

function containsReviewedCC(node, registry) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (n.type === 'costcentre' && isReviewed(registry, n.costCentreCode)) { found = true; return; }
    (n.children || []).forEach(visit);
  };
  visit(node);
  return found;
}

document.addEventListener('DOMContentLoaded', main);
