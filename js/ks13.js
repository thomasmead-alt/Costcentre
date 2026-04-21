import { parseCSV } from './csv.js';

const FIELDS = [
  { key: 'costCentre', label: 'Cost centre', aliases: ['cost centre', 'costcentre', 'cost ctr', 'cost center', 'cc', 'ks13', 'kostenstelle'] },
  { key: 'costCentreName', label: 'Cost centre name', aliases: ['cost centre name', 'cc name', 'costcentre name', 'description', 'name'] },
  { key: 'profitCentre', label: 'Profit centre', aliases: ['profit centre', 'profitcentre', 'pc', 'profit center'] },
  { key: 'profitCentreName', label: 'Profit centre name', aliases: ['profit centre name', 'pc name', 'profitcentre name'] },
  { key: 'responsiblePerson', label: 'Responsible person', aliases: ['responsible person', 'resp person', 'person', 'responsible'] },
  { key: 'responsiblePersonId', label: 'Responsible person ID', aliases: ['person id', 'responsible person id', 'personid', 'emp id', 'employee id', 'user id'] }
];

export function ks13Fields() {
  return FIELDS.map((f) => ({ key: f.key, label: f.label }));
}

export function autoMap(headers) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const map = {};
  for (const field of FIELDS) {
    const idx = lower.findIndex((h) => h === field.key.toLowerCase() || field.aliases.includes(h));
    map[field.key] = idx >= 0 ? idx : -1;
  }
  return map;
}

export function parseKS13(csvText, mapping) {
  const { headers, rows } = parseCSV(csvText);
  const map = mapping || autoMap(headers);
  const out = [];
  for (const r of rows) {
    const row = {};
    for (const field of FIELDS) {
      const idx = map[field.key];
      row[field.key] = idx >= 0 && idx < r.length ? (r[idx] || '').trim() : '';
    }
    if (!row.costCentre) continue;
    if (!row.responsiblePersonId && row.responsiblePerson) {
      row.responsiblePersonId = row.responsiblePerson;
    }
    out.push(row);
  }
  return { headers, rows: out, mapping: map };
}
