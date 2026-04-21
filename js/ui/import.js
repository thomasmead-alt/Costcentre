import { parseKS13, autoMap, ks13Fields } from '../ks13.js';
import { deserialize, summarise, cloneTree } from '../hierarchy.js';
import { updateWorkbook, getWorkbook } from '../storage.js';
import { toast } from './toast.js';

export function initImportPanel({ onChange }) {
  const ks13Input = document.getElementById('file-ks13');
  const currentInput = document.getElementById('file-current');
  const proposedInput = document.getElementById('file-proposed');
  const copyBtn = document.getElementById('btn-copy-current');

  ks13Input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { headers, rows, mapping } = parseKS13(text);
      updateWorkbook((wb) => {
        wb.ks13 = rows;
        wb.ks13Headers = headers;
        wb.ks13Mapping = mapping;
      });
      renderMapping(headers, mapping, text, () => onChange && onChange());
      renderKs13Summary(rows);
      toast(`KS13 parsed: ${rows.length} rows`, 'ok');
      onChange && onChange();
    } catch (err) {
      console.error(err);
      toast(`Failed to parse KS13: ${err.message}`, 'err');
    }
    ks13Input.value = '';
  });

  currentInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const tree = deserialize(JSON.parse(text));
      updateWorkbook((wb) => { wb.currentTree = tree; });
      renderTreeSummary('current-summary', tree);
      toast('Current hierarchy imported', 'ok');
      onChange && onChange();
    } catch (err) {
      console.error(err);
      toast(`Failed to parse current hierarchy: ${err.message}`, 'err');
    }
    currentInput.value = '';
  });

  proposedInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const tree = deserialize(JSON.parse(text));
      updateWorkbook((wb) => { wb.proposedTree = tree; });
      renderTreeSummary('proposed-summary', tree);
      toast('Proposed hierarchy imported', 'ok');
      onChange && onChange();
    } catch (err) {
      console.error(err);
      toast(`Failed to parse proposed hierarchy: ${err.message}`, 'err');
    }
    proposedInput.value = '';
  });

  copyBtn.addEventListener('click', () => {
    const wb = getWorkbook();
    if (!wb.currentTree) { toast('No current hierarchy to copy', 'warn'); return; }
    updateWorkbook((wb2) => { wb2.proposedTree = cloneTree(wb2.currentTree); });
    renderTreeSummary('proposed-summary', getWorkbook().proposedTree);
    toast('Proposed hierarchy seeded from current', 'ok');
    onChange && onChange();
  });

  refreshSummaries();
}

export function refreshSummaries() {
  const wb = getWorkbook();
  renderKs13Summary(wb.ks13);
  renderTreeSummary('current-summary', wb.currentTree);
  renderTreeSummary('proposed-summary', wb.proposedTree);
  if (wb.ks13Headers && wb.ks13Headers.length) {
    renderMapping(wb.ks13Headers, wb.ks13Mapping || autoMap(wb.ks13Headers), null, null);
  }
}

function renderKs13Summary(rows) {
  const el = document.getElementById('ks13-summary');
  if (!rows || rows.length === 0) { el.textContent = 'No KS13 data loaded.'; return; }
  const pcs = new Set(rows.map((r) => r.profitCentre).filter(Boolean));
  const persons = new Set(rows.map((r) => r.responsiblePersonId || r.responsiblePerson).filter(Boolean));
  el.textContent = `${rows.length} cost centres across ${pcs.size} profit centres and ${persons.size} responsible persons.`;
}

function renderTreeSummary(id, tree) {
  const el = document.getElementById(id);
  if (!tree) { el.textContent = 'Not loaded.'; return; }
  const s = summarise(tree);
  el.textContent = `${s.managers} managers · ${s.persons} persons · ${s.costCentres} cost centres.`;
}

function renderMapping(headers, mapping, rawText, afterChange) {
  const el = document.getElementById('ks13-mapping');
  el.hidden = false;
  el.innerHTML = '';
  for (const field of ks13Fields()) {
    const label = document.createElement('label');
    label.textContent = field.label;
    el.appendChild(label);
    const select = document.createElement('select');
    const none = document.createElement('option');
    none.value = '-1';
    none.textContent = '— not mapped —';
    select.appendChild(none);
    headers.forEach((h, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = h;
      if (mapping[field.key] === i) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      const wb = getWorkbook();
      const newMap = { ...(wb.ks13Mapping || mapping) };
      newMap[field.key] = Number(select.value);
      updateWorkbook((w) => { w.ks13Mapping = newMap; });
      if (rawText) {
        const parsed = parseKS13(rawText, newMap);
        updateWorkbook((w) => { w.ks13 = parsed.rows; });
        renderKs13Summary(parsed.rows);
      }
      afterChange && afterChange();
    });
    el.appendChild(select);
  }
}
