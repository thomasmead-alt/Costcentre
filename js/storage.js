const KEY = 'costcentre.workbook.v1';
const SCHEMA_VERSION = 1;

const listeners = new Set();
let workbook = null;
let saveTimer = null;

export function loadWorkbook() {
  if (workbook) return workbook;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      workbook = normalise(parsed);
      return workbook;
    }
  } catch (err) {
    console.error('Failed to load workbook', err);
  }
  workbook = emptyWorkbook();
  return workbook;
}

export function getWorkbook() {
  return workbook || loadWorkbook();
}

export function updateWorkbook(mutator) {
  const wb = getWorkbook();
  mutator(wb);
  scheduleSave();
  listeners.forEach((fn) => fn(wb));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(workbook));
    } catch (err) {
      console.error('Failed to save workbook', err);
    }
    saveTimer = null;
  }, 300);
}

export function exportJSON() {
  const wb = getWorkbook();
  const filename = `costcentre-workbook-${dateStamp()}.json`;
  const blob = new Blob([JSON.stringify(wb, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importJSON(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (parsed.schemaVersion && parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`Workbook schema ${parsed.schemaVersion} is newer than this app (${SCHEMA_VERSION}).`);
  }
  workbook = normalise(parsed);
  localStorage.setItem(KEY, JSON.stringify(workbook));
  listeners.forEach((fn) => fn(workbook));
  return workbook;
}

export function resetWorkbook() {
  workbook = emptyWorkbook();
  localStorage.setItem(KEY, JSON.stringify(workbook));
  listeners.forEach((fn) => fn(workbook));
}

function normalise(parsed) {
  const base = emptyWorkbook();
  return {
    schemaVersion: SCHEMA_VERSION,
    user: parsed.user || base.user,
    ks13: Array.isArray(parsed.ks13) ? parsed.ks13 : [],
    ks13Headers: Array.isArray(parsed.ks13Headers) ? parsed.ks13Headers : [],
    ks13Mapping: parsed.ks13Mapping || null,
    currentTree: parsed.currentTree || null,
    proposedTree: parsed.proposedTree || null,
    changeLog: Array.isArray(parsed.changeLog) ? parsed.changeLog : [],
    reviewRegistry: parsed.reviewRegistry && typeof parsed.reviewRegistry === 'object' ? parsed.reviewRegistry : {}
  };
}

function emptyWorkbook() {
  return {
    schemaVersion: SCHEMA_VERSION,
    user: '',
    ks13: [],
    ks13Headers: [],
    ks13Mapping: null,
    currentTree: null,
    proposedTree: null,
    changeLog: [],
    reviewRegistry: {}
  };
}

function dateStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
