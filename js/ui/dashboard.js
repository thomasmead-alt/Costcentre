import { getWorkbook } from '../storage.js';
import { flatten } from '../hierarchy.js';
import { STATUS_ORDER } from '../changelog.js';

export function renderDashboard() {
  const wb = getWorkbook();
  const hasAnything = (wb.ks13 && wb.ks13.length) || wb.currentTree || wb.proposedTree;
  const emptyEl = document.getElementById('dashboard-empty');
  const statGrid = document.getElementById('stat-grid');
  if (!hasAnything) {
    emptyEl.hidden = false;
    statGrid.innerHTML = '';
    document.getElementById('coverage-bar').innerHTML = '';
    document.getElementById('coverage-legend').innerHTML = '';
    document.getElementById('status-bars').innerHTML = '';
    document.getElementById('pc-breakdown').innerHTML = '';
    document.getElementById('recent-activity').innerHTML = '';
    return;
  }
  emptyEl.hidden = true;

  const ks13Total = wb.ks13.length;
  const ks13Codes = new Set(wb.ks13.map((r) => r.costCentre).filter(Boolean));
  const proposedCcs = wb.proposedTree ? flatten(wb.proposedTree).ccs : new Map();
  const placed = [...ks13Codes].filter((c) => proposedCcs.has(c)).length;
  const unplaced = ks13Total - placed;
  const reviewed = Object.keys(wb.reviewRegistry || {}).length;
  const logTotal = wb.changeLog.length;
  const byStatus = tallyBy(wb.changeLog, (e) => e.status);

  renderStats(statGrid, [
    { label: 'KS13 rows', value: ks13Total, tone: 'neutral' },
    { label: 'Placed in proposed', value: placed, tone: 'ok', sub: pct(placed, ks13Total) },
    { label: 'Unplaced', value: unplaced, tone: unplaced > 0 ? 'warn' : 'ok' },
    { label: 'Reviewed CCs', value: reviewed, tone: 'accent', sub: pct(reviewed, ks13Total) },
    { label: 'Change-log entries', value: logTotal, tone: 'neutral' },
    { label: 'Outstanding', value: byStatus.outstanding || 0, tone: (byStatus.outstanding || 0) > 0 ? 'warn' : 'ok' }
  ]);

  renderCoverage(placed, unplaced);
  renderStatusBars(byStatus, logTotal);
  renderPcBreakdown(wb);
  renderActivity(wb.changeLog);
}

function renderStats(root, cards) {
  root.innerHTML = '';
  for (const c of cards) {
    const el = document.createElement('div');
    el.className = `stat-card tone-${c.tone || 'neutral'}`;
    el.innerHTML = `
      <div class="stat-value">${escapeHtml(String(c.value))}</div>
      <div class="stat-label">${escapeHtml(c.label)}</div>
      ${c.sub ? `<div class="stat-sub">${escapeHtml(c.sub)}</div>` : ''}`;
    root.appendChild(el);
  }
}

function renderCoverage(placed, unplaced) {
  const total = placed + unplaced;
  const bar = document.getElementById('coverage-bar');
  if (total === 0) { bar.innerHTML = '<div class="empty-state">No KS13 rows loaded.</div>'; document.getElementById('coverage-legend').innerHTML = ''; return; }
  const pctPlaced = Math.round((placed / total) * 100);
  const pctUnplaced = 100 - pctPlaced;
  bar.innerHTML = `
    <div class="coverage-track">
      <div class="coverage-seg seg-ok" style="width:${pctPlaced}%" title="${placed} placed"></div>
      <div class="coverage-seg seg-warn" style="width:${pctUnplaced}%" title="${unplaced} unplaced"></div>
    </div>
    <div class="coverage-percent">${pctPlaced}% placed</div>`;
  document.getElementById('coverage-legend').innerHTML = `
    <span class="swatch seg-ok"></span> Placed (${placed})
    <span class="swatch seg-warn" style="margin-left:12px"></span> Unplaced (${unplaced})`;
}

function renderStatusBars(byStatus, total) {
  const root = document.getElementById('status-bars');
  root.innerHTML = '';
  if (total === 0) {
    root.innerHTML = '<div class="empty-state">No change-log entries yet.</div>';
    return;
  }
  for (const status of STATUS_ORDER) {
    const n = byStatus[status] || 0;
    const width = total ? Math.round((n / total) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'status-row';
    row.innerHTML = `
      <span class="status-chip ${status}">${status}</span>
      <div class="status-track"><div class="status-fill status-${status}" style="width:${width}%"></div></div>
      <span class="status-count">${n}</span>`;
    root.appendChild(row);
  }
}

function renderPcBreakdown(wb) {
  const root = document.getElementById('pc-breakdown');
  root.innerHTML = '';
  if (!wb.ks13 || wb.ks13.length === 0) { root.innerHTML = '<div class="empty-state">No KS13 rows.</div>'; return; }
  const proposedCcs = wb.proposedTree ? flatten(wb.proposedTree).ccs : new Map();
  const byPc = new Map();
  for (const row of wb.ks13) {
    const pc = row.profitCentre || '(none)';
    if (!byPc.has(pc)) byPc.set(pc, { total: 0, placed: 0, name: row.profitCentreName || '' });
    const e = byPc.get(pc);
    e.total++;
    if (proposedCcs.has(row.costCentre)) e.placed++;
  }
  const sorted = [...byPc.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [pc, info] of sorted) {
    const pctVal = info.total ? Math.round((info.placed / info.total) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'pc-row';
    row.innerHTML = `
      <div class="pc-label"><strong>${escapeHtml(pc)}</strong> <small>${escapeHtml(info.name)}</small></div>
      <div class="pc-track"><div class="pc-fill ${pctVal === 100 ? 'seg-ok' : pctVal >= 50 ? 'seg-warn' : 'seg-danger'}" style="width:${pctVal}%"></div></div>
      <div class="pc-count">${info.placed}/${info.total} · ${pctVal}%</div>`;
    root.appendChild(row);
  }
}

function renderActivity(log) {
  const root = document.getElementById('recent-activity');
  root.innerHTML = '';
  if (!log || log.length === 0) {
    root.innerHTML = '<div class="empty-state">No activity yet.</div>';
    return;
  }
  const sorted = [...log].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 8);
  for (const entry of sorted) {
    const last = entry.audit[entry.audit.length - 1];
    const row = document.createElement('div');
    row.className = 'activity-row';
    const target = entry.target && (entry.target.costCentre || entry.target.nodeLabel || '');
    row.innerHTML = `
      <span class="status-chip ${entry.status}">${entry.status}</span>
      <span class="activity-kind">${escapeHtml(entry.kind)}</span>
      <span class="activity-target">${escapeHtml(target)}</span>
      <small>${escapeHtml(last ? new Date(last.ts).toLocaleString() : '')} · ${escapeHtml((last && last.user) || '')}</small>`;
    root.appendChild(row);
  }
}

function tallyBy(items, keyFn) {
  const out = {};
  for (const it of items) {
    const k = keyFn(it);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function pct(n, total) {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}% of KS13`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
