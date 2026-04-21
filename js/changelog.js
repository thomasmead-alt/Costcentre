import { uid } from './hierarchy.js';

export const STATUS_ORDER = ['outstanding', 'proposed', 'submitted', 'complete', 'closed'];

export const LOG_KINDS = [
  'new-node', 'changed-node', 'removed-node',
  'new-cc', 'changed-cc', 'removed-cc', 'assigned-cc'
];

export function createEntry({ kind, target, user, note, status = 'outstanding' }) {
  const now = new Date().toISOString();
  const entry = {
    id: uid('log'),
    kind,
    target,
    status,
    createdAt: now,
    updatedAt: now,
    audit: [
      {
        ts: now,
        action: 'created',
        user: user || '',
        note: note || '',
        from: null,
        to: status
      }
    ]
  };
  return entry;
}

export function nextStatus(status) {
  const i = STATUS_ORDER.indexOf(status);
  if (i < 0 || i === STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[i + 1];
}

export function canAdvance(status) {
  return nextStatus(status) !== null;
}

export function advanceStatus(entry, user, note) {
  const to = nextStatus(entry.status);
  if (!to) throw new Error(`Cannot advance from ${entry.status}`);
  const ts = new Date().toISOString();
  entry.audit.push({ ts, action: 'advance', user: user || '', note: note || '', from: entry.status, to });
  entry.status = to;
  entry.updatedAt = ts;
}

export function reopenEntry(entry, user, note) {
  if (entry.status === 'outstanding') throw new Error('Entry is already outstanding');
  const ts = new Date().toISOString();
  const from = entry.status;
  entry.audit.push({ ts, action: 'reopen', user: user || '', note: note || 'Reopened', from, to: 'outstanding' });
  entry.status = 'outstanding';
  entry.updatedAt = ts;
}

export function appendNote(entry, user, note) {
  if (!note) return;
  const ts = new Date().toISOString();
  entry.audit.push({ ts, action: 'note', user: user || '', note, from: entry.status, to: entry.status });
  entry.updatedAt = ts;
}

export function describeTarget(entry) {
  const t = entry.target || {};
  if (t.costCentre) return `CC ${t.costCentre}${t.costCentreName ? ' — ' + t.costCentreName : ''}`;
  if (t.nodeLabel) return `${t.nodeType || 'node'}: ${t.nodeLabel}`;
  if (t.nodeId) return `node ${t.nodeId}`;
  return '—';
}

export function entryMatchesCC(entry, ccCode) {
  return entry.target && entry.target.costCentre === ccCode;
}
