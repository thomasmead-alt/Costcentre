import { updateWorkbook, getWorkbook } from '../storage.js';
import { STATUS_ORDER, advanceStatus, reopenEntry, appendNote, describeTarget, canAdvance } from '../changelog.js';
import { toast } from './toast.js';
import { toCSV } from '../csv.js';

let selectedId = null;
let onChangeCb = null;

export function initChangelogPanel({ onChange }) {
  onChangeCb = onChange;
  document.getElementById('log-filter-status').addEventListener('change', render);
  document.getElementById('log-filter-kind').addEventListener('change', render);
  document.getElementById('log-filter-text').addEventListener('input', render);
  document.getElementById('btn-log-export').addEventListener('click', exportLog);
  document.getElementById('btn-close-audit').addEventListener('click', () => { selectedId = null; render(); });
  document.getElementById('btn-audit-advance').addEventListener('click', advanceSelected);
  document.getElementById('btn-audit-reopen').addEventListener('click', reopenSelected);
  document.getElementById('btn-audit-note').addEventListener('click', noteSelected);
  window.addEventListener('log:open', (e) => {
    selectedId = e.detail.id;
    const tab = document.querySelector('.tab[data-tab="changelog"]');
    if (tab) tab.click();
    render();
  });
}

export function render() {
  const wb = getWorkbook();
  const tbody = document.querySelector('#log-table tbody');
  tbody.innerHTML = '';
  const statusFilter = document.getElementById('log-filter-status').value;
  const kindFilter = document.getElementById('log-filter-kind').value;
  const textFilter = document.getElementById('log-filter-text').value.trim().toLowerCase();

  const rows = wb.changeLog.filter((entry) => {
    if (statusFilter && entry.status !== statusFilter) return false;
    if (kindFilter && entry.kind !== kindFilter) return false;
    if (textFilter) {
      const hay = JSON.stringify(entry.target || {}).toLowerCase();
      if (!hay.includes(textFilter)) return false;
    }
    return true;
  });

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="empty-state">No log entries.</td>`;
    tbody.appendChild(tr);
  } else {
    rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    for (const entry of rows) {
      const tr = document.createElement('tr');
      tr.dataset.id = entry.id;
      if (entry.id === selectedId) tr.classList.add('selected');
      tr.innerHTML = `
        <td><code>${escapeHtml(entry.id.slice(-6))}</code></td>
        <td>${escapeHtml(entry.kind)}</td>
        <td>${escapeHtml(describeTarget(entry))}</td>
        <td><span class="status-chip ${entry.status}">${entry.status}</span></td>
        <td><small>${escapeHtml(formatDate(entry.updatedAt))}</small></td>
        <td></td>`;
      tr.addEventListener('click', () => { selectedId = entry.id; render(); });
      tbody.appendChild(tr);
    }
  }

  const drawer = document.getElementById('audit-drawer');
  if (selectedId) {
    const entry = wb.changeLog.find((e) => e.id === selectedId);
    if (!entry) { selectedId = null; drawer.hidden = true; return; }
    drawer.hidden = false;
    renderAudit(entry);
  } else {
    drawer.hidden = true;
  }
}

function renderAudit(entry) {
  const body = document.getElementById('audit-body');
  const next = canAdvance(entry.status) ? `→ ${nextStatus(entry.status)}` : 'closed';
  body.innerHTML = `
    <p><strong>${escapeHtml(entry.kind)}</strong> · <span class="status-chip ${entry.status}">${entry.status}</span> · next: ${escapeHtml(next)}</p>
    <p>${escapeHtml(describeTarget(entry))}</p>
    <h4>Audit</h4>
    <div id="audit-entries"></div>`;
  const entries = document.getElementById('audit-entries');
  for (const a of entry.audit) {
    const d = document.createElement('div');
    d.className = 'audit-entry';
    d.innerHTML = `<div class="ts">${escapeHtml(formatDate(a.ts))} · ${escapeHtml(a.user || 'anon')}</div>
      <div><strong>${escapeHtml(a.action)}</strong>${a.from ? ` ${escapeHtml(a.from)}→${escapeHtml(a.to)}` : ''}${a.note ? ` — ${escapeHtml(a.note)}` : ''}</div>`;
    entries.appendChild(d);
  }
  document.getElementById('btn-audit-advance').disabled = !canAdvance(entry.status);
  document.getElementById('btn-audit-reopen').disabled = entry.status === 'outstanding';
}

function nextStatus(status) {
  const i = STATUS_ORDER.indexOf(status);
  return i >= 0 && i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : status;
}

function advanceSelected() {
  const wb = getWorkbook();
  const entry = wb.changeLog.find((e) => e.id === selectedId);
  if (!entry) return;
  const note = document.getElementById('audit-note').value.trim();
  updateWorkbook(() => advanceStatus(entry, wb.user, note));
  document.getElementById('audit-note').value = '';
  toast(`Advanced to ${entry.status}`, 'ok');
  onChangeCb && onChangeCb();
  render();
}

function reopenSelected() {
  const wb = getWorkbook();
  const entry = wb.changeLog.find((e) => e.id === selectedId);
  if (!entry) return;
  const note = document.getElementById('audit-note').value.trim();
  updateWorkbook(() => reopenEntry(entry, wb.user, note));
  document.getElementById('audit-note').value = '';
  toast('Entry reopened', 'warn');
  onChangeCb && onChangeCb();
  render();
}

function noteSelected() {
  const wb = getWorkbook();
  const entry = wb.changeLog.find((e) => e.id === selectedId);
  if (!entry) return;
  const note = document.getElementById('audit-note').value.trim();
  if (!note) { toast('Write a note first', 'warn'); return; }
  updateWorkbook(() => appendNote(entry, wb.user, note));
  document.getElementById('audit-note').value = '';
  render();
}

function exportLog() {
  const wb = getWorkbook();
  const header = ['id', 'kind', 'status', 'costCentre', 'costCentreName', 'profitCentre', 'nodeLabel', 'createdAt', 'updatedAt', 'auditCount'];
  const rows = [header];
  for (const e of wb.changeLog) {
    const t = e.target || {};
    rows.push([
      e.id,
      e.kind,
      e.status,
      t.costCentre || '',
      t.costCentreName || '',
      t.profitCentre || '',
      t.nodeLabel || '',
      e.createdAt,
      e.updatedAt,
      String(e.audit.length)
    ]);
  }
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `costcentre-changelog-${stamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
