import { walk, pathTo } from '../hierarchy.js';

export function renderTree(container, tree, opts = {}) {
  container.innerHTML = '';
  if (!tree) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = opts.emptyText || 'No hierarchy loaded yet.';
    container.appendChild(empty);
    return;
  }
  const ul = document.createElement('ul');
  ul.appendChild(renderNode(tree, opts, 0));
  container.appendChild(ul);
}

function renderNode(node, opts, depth) {
  const li = document.createElement('li');
  const head = document.createElement('div');
  head.className = 'node';
  head.dataset.nodeId = node.id;

  const typeSpan = document.createElement('span');
  typeSpan.className = `type ${node.type}`;
  typeSpan.textContent = node.type === 'costcentre' ? 'CC' : node.type;
  head.appendChild(typeSpan);

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = formatLabel(node);
  head.appendChild(label);

  if (node.type === 'costcentre' && opts.reviewedCodes && opts.reviewedCodes.has(node.costCentreCode)) {
    const mark = document.createElement('span');
    mark.className = 'reviewed';
    mark.title = 'Already reviewed';
    mark.textContent = '✓ reviewed';
    head.appendChild(mark);
  }

  if (opts.diffState) {
    const st = diffStateFor(node, opts.diffState);
    if (st) head.classList.add(`diff-${st}`);
  }

  if (opts.editable) {
    const actions = document.createElement('span');
    actions.className = 'node-actions';
    actions.appendChild(makeButton('+ CC', () => opts.onAction && opts.onAction('add-cc', node)));
    actions.appendChild(makeButton('+ Person', () => opts.onAction && opts.onAction('add-person', node)));
    actions.appendChild(makeButton('+ Mgr', () => opts.onAction && opts.onAction('add-manager', node)));
    actions.appendChild(makeButton('Rename', () => opts.onAction && opts.onAction('rename', node)));
    if (node.id !== 'root') {
      actions.appendChild(makeButton('Move', () => opts.onAction && opts.onAction('move', node)));
      actions.appendChild(makeButton('Remove', () => opts.onAction && opts.onAction('remove', node)));
    }
    head.appendChild(actions);
  }

  if (opts.onSelect) {
    head.classList.add('selectable');
    head.addEventListener('click', (e) => {
      if (e.target.closest('.node-actions')) return;
      opts.onSelect(node);
    });
  }

  li.appendChild(head);

  if (node.children && node.children.length > 0) {
    const ul = document.createElement('ul');
    node.children.forEach((c) => ul.appendChild(renderNode(c, opts, depth + 1)));
    li.appendChild(ul);
  }
  return li;
}

function diffStateFor(node, diffState) {
  if (node.type === 'costcentre' && diffState.ccCodesByState && diffState.ccCodesByState.has(node.costCentreCode)) {
    return diffState.ccCodesByState.get(node.costCentreCode);
  }
  if (diffState.nodeKeysByState) {
    const key = node.type === 'person' && node.personId ? `person:${node.personId}` : `${node.type}:${node.id}`;
    if (diffState.nodeKeysByState.has(key)) return diffState.nodeKeysByState.get(key);
  }
  return null;
}

function formatLabel(node) {
  if (node.type === 'costcentre') {
    return `${node.costCentreCode || '?'} — ${node.label || ''}`.trim();
  }
  if (node.type === 'person' && node.personId) {
    return `${node.label || node.personId} (${node.personId})`;
  }
  return node.label || node.id;
}

function makeButton(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

export function collectNodesForPicker(tree, allowedTypes = ['manager', 'person']) {
  const options = [];
  walk(tree, (n, parents) => {
    if (!allowedTypes.includes(n.type)) return;
    const chain = parents.concat(n).map((p) => p.label || p.id).join(' / ');
    options.push({ id: n.id, label: chain });
  });
  return options;
}

export function pickParent(tree, { allowedTypes = ['manager', 'person'], excludeId } = {}) {
  const options = collectNodesForPicker(tree, allowedTypes).filter((o) => o.id !== excludeId);
  if (options.length === 0) return Promise.resolve(null);
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:40;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;padding:16px;border-radius:8px;min-width:320px;max-width:480px;box-shadow:0 8px 24px rgba(0,0,0,0.15);';
    box.innerHTML = '<h3 style="margin:0 0 8px">Choose parent</h3>';
    const select = document.createElement('select');
    select.size = Math.min(12, Math.max(4, options.length));
    select.style.cssText = 'width:100%;padding:6px;border:1px solid #e1e4e8;border-radius:4px;';
    options.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.label;
      select.appendChild(opt);
    });
    box.appendChild(select);
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:12px;';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = 'Select';
    ok.className = 'primary';
    actions.appendChild(cancel);
    actions.appendChild(ok);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const finish = (value) => { document.body.removeChild(overlay); resolve(value); };
    cancel.addEventListener('click', () => finish(null));
    ok.addEventListener('click', () => finish(select.value));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null); });
    select.focus();
  });
}

export { pathTo };
