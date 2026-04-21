import { parseKS13, autoMap, ks13Fields } from '../ks13.js';
import { deserialize, summarise, cloneTree } from '../hierarchy.js';
import { parseHierarchyCsv } from '../hierarchyCsv.js';
import { updateWorkbook, getWorkbook } from '../storage.js';
import { toast } from './toast.js';
import { toCSV } from '../csv.js';
import { SAMPLE_KS13_CSV, SAMPLE_CURRENT_HIERARCHY, SAMPLE_PROPOSED_HIERARCHY } from '../samples.js';

const CSV_TEMPLATE = [
  ['Level 1', 'Level 2', 'Responsible Person', 'Person ID', 'Cost Centre', 'Cost Centre Name', 'Profit Centre'],
  ['COO', '', 'Smith, J', 'U001', '1001', 'Marketing UK', 'PC01'],
  ['COO', '', 'Smith, J', 'U001', '1003', 'Sales UK', 'PC01'],
  ['COO', '', 'Jones, A', 'U002', '1002', 'Marketing US', 'PC02'],
  ['CTO', '', 'Brown, K', 'U003', '2001', 'Engineering Core', 'PC03'],
  ['', '', 'White, L', 'U004', '3001', 'HR', 'PC04']
];

async function readHierarchyFile(file) {
  const text = await file.text();
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.csv') || /^(\s*\w[\w ]*),/m.test(text) && !text.trim().startsWith('{')) {
    return parseHierarchyCsv(text);
  }
  return deserialize(JSON.parse(text));
}

export function initImportPanel({ onChange }) {
  const ks13Input = document.getElementById('file-ks13');
  const currentInput = document.getElementById('file-current');
  const proposedInput = document.getElementById('file-proposed');
  const copyBtn = document.getElementById('btn-copy-current');
  const sampleBtn = document.getElementById('btn-load-samples');

  if (!sampleBtn) {
    console.error('Sample button missing from DOM');
  } else {
    sampleBtn.addEventListener('click', () => {
      try {
        const wb = getWorkbook();
        const hasData = (wb.ks13 && wb.ks13.length) || wb.currentTree || wb.proposedTree || (wb.changeLog && wb.changeLog.length);
        if (hasData && !confirm('Replace current workbook data with the sample dataset?')) return;
        const parsed = parseKS13(SAMPLE_KS13_CSV);
        const currentTree = deserialize(SAMPLE_CURRENT_HIERARCHY);
        const proposedTree = deserialize(SAMPLE_PROPOSED_HIERARCHY);
        updateWorkbook((w) => {
          w.ks13 = parsed.rows;
          w.ks13Headers = parsed.headers;
          w.ks13Mapping = parsed.mapping;
          w.currentTree = currentTree;
          w.proposedTree = proposedTree;
        });
        refreshSummaries();
        toast(`Sample data loaded: ${parsed.rows.length} KS13 rows`, 'ok');
        onChange && onChange();
      } catch (err) {
        console.error('Sample load failed', err);
        toast(`Sample load failed: ${err.message}`, 'err');
      }
    });
  }

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
      const tree = await readHierarchyFile(file);
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
      const tree = await readHierarchyFile(file);
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

  const tmplBtn = document.getElementById('btn-download-template');
  if (tmplBtn) {
    tmplBtn.addEventListener('click', () => {
      const csv = toCSV(CSV_TEMPLATE);
      downloadBlob(csv, 'text/csv', 'hierarchy-template.csv');
      toast('CSV template downloaded', 'ok');
    });
  }

  const helpLink = document.getElementById('link-csv-format');
  if (helpLink) helpLink.addEventListener('click', (e) => { e.preventDefault(); showCsvHelp(); });

  refreshSummaries();
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showCsvHelp() {
  const existing = document.getElementById('csv-help-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'csv-help-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <header><h3>Hierarchy CSV format</h3><button type="button" class="close" aria-label="Close">&times;</button></header>
      <div class="modal-body">
        <p>One row per path from the top-level down to either a manager, a responsible person, or a cost centre. Rows that share a prefix share nodes.</p>
        <p><strong>Columns</strong> (case-insensitive, all optional — include what you need):</p>
        <ul>
          <li><code>Level 1</code>, <code>Level 2</code>, … — manager-of-manager chain, top to bottom (aliases: <code>L1</code>, <code>Manager L1</code>, <code>Tier 1</code>).</li>
          <li><code>Responsible Person</code>, <code>Person ID</code> — attached under the deepest non-empty level.</li>
          <li><code>Cost Centre</code>, <code>Cost Centre Name</code>, <code>Profit Centre</code> — attached under the person (or the deepest level if no person).</li>
        </ul>
        <p><strong>Example</strong>:</p>
        <pre>Level 1,Level 2,Responsible Person,Person ID,Cost Centre,Cost Centre Name,Profit Centre
Organisation,COO,"Smith, J",U001,1001,Marketing UK,PC01
Organisation,COO,"Smith, J",U001,1003,Sales UK,PC01
Organisation,CTO,"Brown, K",U003,2001,Engineering Core,PC03</pre>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
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
