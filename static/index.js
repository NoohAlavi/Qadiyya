// Restore scroll position after reload
document.addEventListener('DOMContentLoaded', () => {
    const savedScroll = sessionStorage.getItem('scrollY');
    if (savedScroll !== null) {
        window.scrollTo(0, parseInt(savedScroll));
        sessionStorage.removeItem('scrollY');
    }
});

function reloadWithScroll() {
    sessionStorage.setItem('scrollY', window.scrollY);
    window.location.reload();
}

// Remember on the server whether the "Argument Tree" section is closed (saved with the argument).
function saveTreeCollapsed(collapsed) {
    // An explicit choice: this tree no longer follows the "open by default" setting.
    const body = document.getElementById('tree-body');
    if (body) body.removeAttribute('data-follow-default');
    fetch('/set_tree_collapsed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collapsed }),
        keepalive: true
    }).catch(() => { /* view state only: ignore network errors */ });
}

// Remember on the server whether a sub-argument table is collapsed (the flag is stored on the
// premise itself). `keepalive` lets the request finish even if the page reloads straight after.
function saveCollapsed(wrapper, collapsed) {
    // An explicit choice: this sub-argument no longer follows the "open by default" setting.
    wrapper.removeAttribute('data-follow-default');
    const number = wrapper.id.replace('subarg-', '');
    fetch('/set_collapsed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, collapsed }),
        keepalive: true
    }).catch(() => { /* view state only: ignore network errors */ });
}

document.addEventListener('DOMContentLoaded', () => {

    // Editable text cells
    document.querySelectorAll('td.barebones, td.written_premise').forEach(cell => {
        // store initial value
        cell.dataset.oldValue = cell.innerText;

        cell.addEventListener('blur', async (e) => {
            const newText = e.target.innerText;
            const oldText = e.target.dataset.oldValue;

            // Only update if changed
            if (newText === oldText) return;

            const premiseNumber = e.target.closest('tr').querySelector('.num').innerText || 0;

            let fieldType;
            if (e.target.classList.contains('barebones')) {
                const key = e.target.dataset.barebonesKey; // "parent" or "child"
                fieldType = key === 'child' ? 'barebones_child' : 'barebones_parent';
            } else {
                fieldType = 'written_premise';
            }

            console.log(`Updating ${fieldType} for premise ${premiseNumber}: ${newText}`);

            const res = await fetch('/update_premise', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: premiseNumber, field: fieldType, value: newText })
            });

            // update old value so next blur works correctly
            e.target.dataset.oldValue = newText;

            // reload if the premise is inferential (so the sub-argument conclusion row updates)
            const data = await res.json();
            if (data.reload) reloadWithScroll();
            else if (fieldType === 'written_premise') loadTree(); // keep the tree's text in sync
        });
    });

    // Save scroll position before add/delete form submissions
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', () => {
            sessionStorage.setItem('scrollY', window.scrollY);
        });
    });

    // Annotations fields
    document.querySelectorAll('div.annotations').forEach(cell => {
        cell.dataset.oldValue = cell.innerText;

        cell.addEventListener('blur', async (e) => {
            const newText = e.target.innerText;
            const oldText = e.target.dataset.oldValue;

            if (newText === oldText) return;

            const premiseNumber = e.target.dataset.premiseNum;

            await fetch('/update_premise', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: premiseNumber, field: 'annotations', value: newText })
            });

            e.target.dataset.oldValue = newText;
            loadTree();                     // the note's footnote under the tree follows
        });
    });

    // Select dropdowns
    document.querySelectorAll('select').forEach(select => {
        // store initial value
        select.dataset.oldValue = select.value;

        select.addEventListener('input', async (e) => {
            const newValue = e.target.value;
            const oldValue = e.target.dataset.oldValue;

            // Only update if changed
            if (newValue === oldValue) return;

            const premiseNumber = e.target.closest('tr').querySelector('.num').innerText || 0;

            const res = await fetch('/update_proposition_type', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: newValue, number: premiseNumber })
            });

            // update old value
            e.target.dataset.oldValue = newValue;

            // reload if switching to OR from Inferential (structural change either way)
            const data = await res.json();
            if (data.reload || oldValue === 'Inferential') reloadWithScroll();
        });
    });

});

// ══════════════════════════════════════════════════════════════════
//  ARGUMENT TREE VIEW  (read-only, sits under the last table)
//  Premises feed into the conclusion: by default the conclusion is at the
//  top; the toggle above the tree moves it to the bottom (and flips the arrows).
// ══════════════════════════════════════════════════════════════════
const TREE = {
    cardW: 210,     // width of every box
    gapX: 18,       // horizontal gap between neighbouring boxes
    gapY: 44,       // vertical gap between rows (the connector "bus" runs through the middle)
};

let treeData = null;       // last nested tree fetched from /tree_data
let treeLastWidth = 0;     // used to re-render only when the available width changes
let treeFlipped = true;    // true: conclusion on top (default); false: conclusion at the bottom
                           // (set from the saved "conclusion position" setting when the page loads)

// Keep the button label and the one-line description in step with the current orientation.
function syncTreeFlipUI() {
    const btn = document.getElementById('tree-flip');
    const note = document.getElementById('tree-note');
    if (btn) {
        btn.textContent = treeFlipped ? '⇅ Conclusion at top' : '⇅ Conclusion at bottom';
        btn.title = treeFlipped ? 'Move the conclusion to the bottom' : 'Move the conclusion to the top';
        btn.setAttribute('aria-pressed', treeFlipped ? 'true' : 'false');
    }
    if (note) {
        note.textContent = 'Premises flow ' + (treeFlipped ? 'upward' : 'downward') +
            ' into the conclusion. Click any box to jump to its row in the table.';
    }
}

// Switch the conclusion between the bottom and the top of the tree. The position is a saved
// setting (the same one the settings panel changes); changing it makes applySettingChange()
// below redraw the tree.
function flipTree() {
    const settings = window.QadiyyaSettings;
    if (settings) {
        settings.set('tree_conclusion', treeFlipped ? 'bottom' : 'top');
    } else {
        treeFlipped = !treeFlipped;   // settings script missing: still flip for this page view
        syncTreeFlipUI();
        renderTree();
    }
}

// Show or hide the whole "Argument Tree" section (no saving: callers decide whether to save).
function setTreeCollapsed(collapsed) {
    const body = document.getElementById('tree-body');
    const btn = document.querySelector('#tree-section h2 .subarg-toggle');
    if (!body) return;
    body.classList.toggle('collapsed', collapsed);
    if (btn) {
        btn.textContent = collapsed ? '▼' : '▲';
        btn.title = collapsed ? 'Expand' : 'Collapse';
    }
    if (!collapsed) renderTree();
}

// Fold or unfold one sub-argument table (no saving: callers decide whether to save).
function setWrapperCollapsed(wrapper, collapsed) {
    wrapper.classList.toggle('collapsed', collapsed);
    const btn = wrapper.previousElementSibling && wrapper.previousElementSibling.querySelector('.subarg-toggle');
    if (btn) {
        btn.textContent = collapsed ? '▼' : '▲';
        btn.title = collapsed ? 'Expand' : 'Collapse';
    }
}

// React to a change made in the settings panel (see settings.js).
// Sections the user has opened or closed themselves keep their own state; only the ones
// still following the default (marked data-follow-default) change.
function applySettingChange(detail) {
    const values = detail.values;
    switch (detail.key) {
        case 'tree_conclusion':
            treeFlipped = values.tree_conclusion === 'top';
            syncTreeFlipUI();
            renderTree();
            break;
        case 'text_size':
            document.body.dataset.textSize = values.text_size;
            renderTree();                       // the boxes change height with the text
            break;
        case 'tree_open': {
            const body = document.getElementById('tree-body');
            if (body && body.hasAttribute('data-follow-default')) setTreeCollapsed(!values.tree_open);
            break;
        }
        case 'tree_notes':
            renderTree();
            break;
        case 'subargs_open':
            document.querySelectorAll('.subarg-wrapper[data-follow-default]')
                .forEach(wrapper => setWrapperCollapsed(wrapper, !values.subargs_open));
            break;
    }
}

// Deleting a premise also deletes everything nested under it, so ask first when there is any.
function findNodeByNumber(node, number) {
    if (node.number === number) return node;
    for (const child of node.premises || []) {
        const found = findNodeByNumber(child, number);
        if (found) return found;
    }
    return null;
}
function countDescendants(node) {
    return (node.premises || []).reduce((total, child) => total + 1 + countDescendants(child), 0);
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[action$="/delete_premise"]').forEach(form => {
        // Capture phase, so a cancelled delete also skips the scroll-position save below.
        form.addEventListener('submit', e => {
            const number = form.querySelector('input[name="premise_num"]').value;
            const node = treeData ? findNodeByNumber(treeData, number) : null;
            const nested = node ? countDescendants(node) : (document.getElementById('subarg-' + number) ? 1 : 0);
            if (nested === 0) return;

            const what = node
                ? `the ${nested} premise${nested === 1 ? '' : 's'} nested under it`
                : 'everything in its sub-argument';
            if (!confirm(`Delete ${number} and ${what}? This can't be undone.`)) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }, true);
    });
});

// Fetch the current argument and (re)draw the tree.
async function loadTree() {
    if (!document.getElementById('tree-canvas')) return;
    try {
        const res = await fetch('/tree_data');
        if (!res.ok) return;
        treeData = await res.json();
        renderTree();
    } catch (err) {
        // The tree is a convenience view — fail quietly rather than disturb editing.
    }
}

// Work out an (x, depth) position for every node.
// Rows come from depth (the conclusion is depth 0, its premises depth 1, and so on).
// Leaves are packed left-to-right within their row; each parent is centred over its
// children, pushing the whole subtree right if it would otherwise overlap a neighbour.
function layoutTree(root) {
    const unit = TREE.cardW + TREE.gapX;
    const nextFree = {};          // depth -> first x not yet taken in that row
    let maxDepth = 0;

    function build(data, depth, parent) {
        const node = { data, depth, parent, kids: [], x: 0 };
        maxDepth = Math.max(maxDepth, depth);
        node.kids = (data.premises || []).map(child => build(child, depth + 1, node));
        return node;
    }

    function shift(node, dx) {
        node.x += dx;
        nextFree[node.depth] = Math.max(nextFree[node.depth] || 0, node.x + unit);
        node.kids.forEach(kid => shift(kid, dx));
    }

    function place(node) {
        node.kids.forEach(place);
        const free = nextFree[node.depth] || 0;

        if (node.kids.length === 0) {
            node.x = free;
        } else {
            const desired = (node.kids[0].x + node.kids[node.kids.length - 1].x) / 2;
            if (desired >= free) {
                node.x = desired;
            } else {
                node.x = free;
                node.kids.forEach(kid => shift(kid, free - desired));
            }
        }
        nextFree[node.depth] = Math.max(nextFree[node.depth] || 0, node.x + unit);
    }

    const top = build(root, 0, null);
    place(top);

    const all = [];
    (function collect(node) { all.push(node); node.kids.forEach(collect); })(top);

    const width = Math.max(...all.map(n => n.x)) + TREE.cardW;
    return { nodes: all, maxDepth, width };
}

function renderTree() {
    const canvas = document.getElementById('tree-canvas');
    const scroller = document.getElementById('tree-scroll');
    const body = document.getElementById('tree-body');
    if (!canvas || !scroller || !treeData) return;
    if (body && body.classList.contains('collapsed')) return;   // can't measure while hidden

    const { nodes, maxDepth, width } = layoutTree(treeData);
    treeLastWidth = scroller.clientWidth;

    // Centre narrow trees; wide ones scroll horizontally.
    const canvasW = Math.max(width, scroller.clientWidth);
    const offset = (canvasW - width) / 2;
    canvas.innerHTML = '';
    canvas.style.width = canvasW + 'px';

    const SVG = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG, 'svg');
    svg.id = 'tree-lines';
    svg.innerHTML =
        '<defs><marker id="tree-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">' +
        '<path d="M2 1L8 5L2 9"/></marker></defs>';
    canvas.appendChild(svg);

    // One div per row: the conclusion is on the top row by default (flipped: deepest premises first).
    // Flipped: the conclusion row comes first and the deepest premises last.
    const rows = [];
    for (let r = 0; r <= maxDepth; r++) {
        const row = document.createElement('div');
        row.className = 'tree-row';
        canvas.appendChild(row);
        rows.push(row);
    }

    nodes.forEach(node => {
        const card = document.createElement('div');
        const isRoot = node.parent === null;
        const isInferential = node.data.metadata && node.data.metadata.premise_type === 'INFERENTIAL';
        const text = (node.data.written_premise || '').trim();

        card.className = 'tree-card ' + (isRoot ? 'tree-concl' : isInferential ? 'tree-inf' : 'tree-leaf');
        card.style.left = (node.x + offset) + 'px';
        card.style.width = TREE.cardW + 'px';
        card.textContent = text || '(empty)';          // textContent: premise text is user input
        if (!text) card.classList.add('tree-empty');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.title = 'Jump to this row in the table';

        const num = isRoot ? 'C' : node.data.number;
        card.addEventListener('click', () => jumpToRow(num));
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToRow(num); }
        });

        node.card = card;
        rows[treeFlipped ? node.depth : maxDepth - node.depth].appendChild(card);
    });

    // Make every box in a row the same height, so connectors meet the row edges cleanly.
    rows.forEach(row => {
        const cards = Array.from(row.children);
        const h = Math.max(0, ...cards.map(c => c.offsetHeight));
        row.style.height = h + 'px';
        cards.forEach(c => { c.style.height = h + 'px'; });
    });

    // Connectors: each premise runs to a shared bus in the gap beside its parent, along to the
    // parent's centre, and an arrow then enters the parent. The arrow always points from the
    // premises into the conclusion, so it points down by default and up when flipped.
    const origin = canvas.getBoundingClientRect();
    svg.setAttribute('width', canvas.scrollWidth);
    svg.setAttribute('height', canvas.scrollHeight);

    const addPath = (d, arrow) => {
        const p = document.createElementNS(SVG, 'path');
        p.setAttribute('d', d);
        if (arrow) p.setAttribute('marker-end', 'url(#tree-arrow)');
        svg.appendChild(p);
    };

    nodes.forEach(node => {
        if (node.kids.length === 0) return;
        const pr = node.card.getBoundingClientRect();
        const px = pr.left - origin.left + pr.width / 2;
        // The edge of the parent that faces its premises, and which way those premises lie.
        const pEdge = (treeFlipped ? pr.bottom : pr.top) - origin.top;
        const toKids = treeFlipped ? 1 : -1;               // +1: premises are below, -1: above
        const bus = pEdge + toKids * TREE.gapY / 2;

        node.kids.forEach(kid => {
            const kr = kid.card.getBoundingClientRect();
            const kx = kr.left - origin.left + kr.width / 2;
            const kEdge = (treeFlipped ? kr.top : kr.bottom) - origin.top;
            addPath(`M${kx} ${kEdge}V${bus}H${px}`, false);
        });
        addPath(`M${px} ${bus}V${pEdge + toKids * 3}`, true);
    });

    renderTreeNotes(nodes, rows);
}

// ── Notes: a marker on each box that has an annotation, and the notes listed under the tree ──
function treeNotesEnabled() {
    const s = window.QadiyyaSettings;
    return !s || s.values.tree_notes !== false;
}

// The annotated boxes in reading order (top row to bottom row, left to right).
// Returns [{n, node, text, snippet}] — empty when notes are switched off.
function collectTreeNotes(nodes, rows) {
    if (!treeNotesEnabled()) return [];
    const order = new Map();
    rows.forEach((row, r) => Array.from(row.children).forEach(card => order.set(card, r)));
    const annotated = nodes.filter(n => ((n.data.metadata && n.data.metadata.annotations) || '').trim());
    annotated.sort((a, b) => (order.get(a.card) - order.get(b.card)) || (a.x - b.x));
    return annotated.map((node, i) => {
        const premise = (node.data.written_premise || '').trim();
        return {
            n: i + 1, node,
            text: node.data.metadata.annotations.trim(),
            snippet: premise.length > 70 ? premise.slice(0, 70).trimEnd() + '…' : premise,
        };
    });
}

function flashElement(el) {
    el.classList.remove('tree-flash');
    void el.offsetWidth;                     // restart the animation
    el.classList.add('tree-flash');
    setTimeout(() => el.classList.remove('tree-flash'), 1700);
}

function renderTreeNotes(nodes, rows) {
    const box = document.getElementById('tree-notes');
    const list = document.getElementById('tree-notes-list');
    if (!box || !list) return;
    list.innerHTML = '';
    const notes = collectTreeNotes(nodes, rows);
    box.hidden = notes.length === 0;
    notes.forEach(note => {
        const badge = document.createElement('span');
        badge.className = 'tree-fn';
        badge.textContent = note.n;                       // numbers only
        badge.title = 'Show note ' + note.n;
        badge.tabIndex = 0;
        badge.setAttribute('role', 'button');
        note.node.card.appendChild(badge);

        const li = document.createElement('li');
        li.id = 'tree-note-' + note.n;
        const num = document.createElement('span');
        num.className = 'tree-fn-num';
        num.textContent = note.n;
        const prem = document.createElement('span');
        prem.className = 'tree-fn-premise';
        prem.textContent = '\u201c' + (note.snippet || '(empty)') + '\u201d';
        const body = document.createElement('span');
        body.className = 'tree-fn-text';
        body.textContent = note.text;                     // textContent: notes are user input
        li.append(num, prem, body);
        li.title = 'Highlight this premise in the tree';
        li.addEventListener('click', () => {
            note.node.card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            flashElement(note.node.card);
        });
        list.appendChild(li);

        const goToNote = e => {
            e.stopPropagation();                          // don't also jump to the table row
            li.scrollIntoView({ behavior: 'smooth', block: 'center' });
            flashElement(li);
        };
        badge.addEventListener('click', goToNote);
        badge.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToNote(e); }
        });
    });
}

// Scroll the table to a premise's row (expanding its sub-argument if collapsed) and flash it.
function jumpToRow(num) {
    const row = document.getElementById('row-' + num);
    if (!row) return;

    let delay = 0;
    const wrapper = row.closest('.subarg-wrapper');
    if (wrapper && wrapper.classList.contains('collapsed')) {
        wrapper.classList.remove('collapsed');
        const toggle = wrapper.previousElementSibling && wrapper.previousElementSibling.querySelector('.subarg-toggle');
        if (toggle) { toggle.textContent = '▲'; toggle.title = 'Collapse'; }
        saveCollapsed(wrapper, false);
        delay = 320;   // wait for the expand transition so the scroll target is in the right place
    }

    setTimeout(() => {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.remove('row-flash');
        void row.offsetWidth;                  // restart the animation if it is already running
        row.classList.add('row-flash');
        setTimeout(() => row.classList.remove('row-flash'), 1800);
    }, delay);
}

// Collapse / expand the whole tree section.
function toggleTree(btn) {
    const body = document.getElementById('tree-body');
    const collapsed = !body.classList.contains('collapsed');
    setTreeCollapsed(collapsed);
    saveTreeCollapsed(collapsed);      // remembered with the argument
}

document.addEventListener('DOMContentLoaded', () => {
    const scroller = document.getElementById('tree-scroll');
    if (!scroller) return;

    const settings = window.QadiyyaSettings;
    treeFlipped = !!settings && settings.values.tree_conclusion === 'top';
    syncTreeFlipUI();
    loadTree();

    // Apply changes made in the settings panel straight away.
    document.addEventListener('qadiyya:settings', e => applySettingChange(e.detail));

    // Web fonts change box heights, so redraw once they have loaded.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { if (treeData) renderTree(); });
    }

    // Redraw when the available width changes (window resize, scrollbar, etc.).
    if (window.ResizeObserver) {
        new ResizeObserver(() => {
            if (treeData && scroller.clientWidth !== treeLastWidth) renderTree();
        }).observe(scroller);
    }
});

// ══════════════════════════════════════════════════════════════════════
//  EXPORT THE TREE AS A PNG
//  Draws the tree on a canvas straight from what is on screen: box positions, the lines each
//  box wraps onto, and the connectors. The canvas uses the page's already-loaded fonts, so the
//  picture matches the screen. It always shows the current orientation (conclusion top/bottom).
// ══════════════════════════════════════════════════════════════════════
async function exportTree() {
    const menu = document.getElementById('export-menu');
    if (menu) menu.classList.remove('open');

    const body = document.getElementById('tree-body');
    const canvasEl = document.getElementById('tree-canvas');
    if (!body || !canvasEl) return;

    if (!treeData) await loadTree();
    if (!treeData) { alert('The tree could not be loaded.'); return; }

    // The tree can't be measured while folded away: open it for a moment, then put it back.
    const wasCollapsed = body.classList.contains('collapsed');
    if (wasCollapsed) body.classList.remove('collapsed');
    try {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        renderTree();

        const origin = canvasEl.getBoundingClientRect();
        const cards = Array.from(canvasEl.querySelectorAll('.tree-card')).map(card => {
            const r = card.getBoundingClientRect();
            const cs = getComputedStyle(card);

            // Which words sit on which line: group characters by their on-screen height.
            const lines = [];
            const node = card.firstChild;
            if (node && node.nodeType === Node.TEXT_NODE) {
                const range = document.createRange();
                let current = null;
                for (let i = 0; i < node.length; i++) {
                    range.setStart(node, i); range.setEnd(node, i + 1);
                    const cr = range.getClientRects()[0];
                    if (!cr) continue;                                  // collapsed whitespace
                    if (!current || Math.abs(cr.top - current.top) > 3) {
                        current = { top: cr.top, bottom: cr.bottom, text: '' };
                        lines.push(current);
                    }
                    current.text += node.data[i];
                }
            }
            const badgeEl = card.querySelector('.tree-fn');
            const br = badgeEl ? badgeEl.getBoundingClientRect() : null;
            return {
                badge: br ? { n: badgeEl.textContent, x: br.left - origin.left, y: br.top - origin.top, w: br.width, h: br.height } : null,
                x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height,
                lines: lines.map(l => ({ text: l.text.trim(), mid: (l.top + l.bottom) / 2 - origin.top })),
                font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
                fill: cs.backgroundColor, stroke: cs.borderTopColor,
                strokeW: parseFloat(cs.borderTopWidth) || 1, ink: cs.color,
            };
        });

        const paths = Array.from(canvasEl.querySelectorAll('#tree-lines path'))
            .filter(p => p.getAttribute('d'))
            .map(p => ({ d: p.getAttribute('d'), arrow: p.hasAttribute('marker-end') }));
        const lineStyle = getComputedStyle(document.querySelector('#tree-lines path'));

        // Crop to the tree itself, plus a margin, and a title line above it.
        const PAD = 28;
        const titleEl = document.querySelector('.argument-title');
        const rawTitle = titleEl
            ? Array.from(titleEl.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim()
            : '';
        const title = rawTitle.replace(/^High-Level\s+/i, '');   // "Argument For …", not "High-Level Argument For …"
        const rootStyle = getComputedStyle(document.documentElement);
        const color = name => rootStyle.getPropertyValue(name).trim();
        const titleFont = `600 24px 'EB Garamond', Georgia, serif`;

        const probe = document.createElement('canvas').getContext('2d');
        probe.font = titleFont;
        const minX = Math.min(...cards.map(c => c.x));
        const maxX = Math.max(...cards.map(c => c.x + c.w));
        const maxY = Math.max(...cards.map(c => c.y + c.h));
        const treeW = maxX - minX;
        // The notes under the tree (empty when the setting is off or nothing is annotated).
        const notes = Array.from(document.querySelectorAll('#tree-notes-list li')).map(li => ({
            n: li.children[0].textContent, prem: li.children[1].textContent, text: li.children[2].textContent,
        }));
        const contentW = Math.max(treeW, notes.length ? 560 : 0);
        const W = Math.ceil(contentW + PAD * 2);
        // Wrap the title to the tree's width so a long title doesn't stretch the picture.
        const titleLines = [];
        let cur = '';
        title.split(/\s+/).filter(Boolean).forEach(word => {
            const trial = cur ? cur + ' ' + word : word;
            if (cur && probe.measureText(trial).width > contentW) { titleLines.push(cur); cur = word; } else { cur = trial; }
        });
        if (cur) titleLines.push(cur);
        const TITLE_LH = 30;
        const bas = document.getElementById('basmala');
        const basFont = bas ? (() => { const b = getComputedStyle(bas); return `${b.fontStyle} ${b.fontWeight} 26px ${b.fontFamily}`; })() : '';
        const basH = bas ? 50 : 0;
        const titleH = (titleLines.length ? titleLines.length * TITLE_LH + 22 : 0) + basH;
        const FOOT = 118;                                          // room for the watermark footer

        // Wrap each note to the content width (numbers hang in a 30px column).
        const noteFont = "15px 'EB Garamond', Georgia, serif";
        const premFont = "italic 14px 'EB Garamond', Georgia, serif";
        const NOTE_LH = 21, NOTE_COL = 30;
        const wrap = (text, font, width) => {
            probe.font = font;
            const out = [];
            text.split('\n').forEach(para => {
                let line = '';
                para.split(/\s+/).filter(Boolean).forEach(word => {
                    const trial = line ? line + ' ' + word : word;
                    if (line && probe.measureText(trial).width > width) { out.push(line); line = word; } else { line = trial; }
                });
                out.push(line);
            });
            return out;
        };
        notes.forEach(n => {
            n.premLine = wrap(n.prem, premFont, contentW - NOTE_COL)[0];
            n.lines = wrap(n.text, noteFont, contentW - NOTE_COL);
            n.h = NOTE_LH * (1 + n.lines.length) + 12;
        });
        const notesH = notes.length ? 54 + notes.reduce((a, n) => a + n.h, 0) : 0;

        const H = Math.ceil(maxY + PAD * 2 + titleH + notesH + FOOT);
        const dx = PAD + (W - PAD * 2 - treeW) / 2 - minX;
        const dy = PAD + titleH;

        const SCALE = 2;
        const cv = document.createElement('canvas');
        cv.width = W * SCALE; cv.height = H * SCALE;
        const ctx = cv.getContext('2d');
        ctx.scale(SCALE, SCALE);
        ctx.fillStyle = color('--parchment') || '#f5f0e8';
        ctx.fillRect(0, 0, W, H);

        if (bas) {
            ctx.font = basFont;
            ctx.fillStyle = color('--emerald') || '#1a5c3a';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(bas.textContent.trim(), W / 2, PAD + 16);
        }
        if (titleLines.length) {
            ctx.font = titleFont;
            ctx.fillStyle = color('--emerald') || '#1a5c3a';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            titleLines.forEach((ln, i) => ctx.fillText(ln, W / 2, PAD + basH + 12 + i * TITLE_LH));
        }

        // Connectors (their paths only use M, H and V).
        ctx.strokeStyle = lineStyle.stroke;
        ctx.lineWidth = parseFloat(lineStyle.strokeWidth) || 1.5;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        paths.forEach(p => {
            const tokens = p.d.match(/[MHV]|-?\d*\.?\d+/g) || [];
            let x = 0, y = 0, px = 0, py = 0;
            ctx.beginPath();
            for (let i = 0; i < tokens.length;) {
                const cmd = tokens[i++];
                if (cmd === 'M') { x = +tokens[i++]; y = +tokens[i++]; ctx.moveTo(x + dx, y + dy); }
                else if (cmd === 'H') { px = x; x = +tokens[i++]; ctx.lineTo(x + dx, y + dy); }
                else if (cmd === 'V') { py = y; y = +tokens[i++]; ctx.lineTo(x + dx, y + dy); }
            }
            ctx.stroke();
            if (p.arrow) {                                    // a small open arrowhead at the end
                const dir = y >= py ? 1 : -1;
                ctx.beginPath();
                ctx.moveTo(x + dx - 4, y + dy - dir * 6);
                ctx.lineTo(x + dx, y + dy);
                ctx.lineTo(x + dx + 4, y + dy - dir * 6);
                ctx.stroke();
            }
        });

        // Boxes and their text.
        cards.forEach(c => {
            ctx.fillStyle = c.fill;
            ctx.fillRect(c.x + dx, c.y + dy, c.w, c.h);
            ctx.strokeStyle = c.stroke; ctx.lineWidth = c.strokeW;
            ctx.strokeRect(c.x + dx + c.strokeW / 2, c.y + dy + c.strokeW / 2, c.w - c.strokeW, c.h - c.strokeW);
            ctx.font = c.font; ctx.fillStyle = c.ink;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            c.lines.forEach(l => ctx.fillText(l.text, c.x + dx + c.w / 2, l.mid + dy));
        });

        // Note markers on the boxes.
        const gold0 = '#b8860b';
        cards.forEach(c => {
            if (!c.badge) return;
            const b = c.badge, bx = b.x + dx, by = b.y + dy;
            ctx.fillStyle = gold0;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(bx, by, b.w, b.h, b.h / 2); else ctx.rect(bx, by, b.w, b.h);
            ctx.fill();
            ctx.fillStyle = color('--parchment') || '#f5f0e8';
            ctx.font = "600 11px 'EB Garamond', Georgia, serif";
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(b.n, bx + b.w / 2, by + b.h / 2 + 0.5);
        });

        // The notes, listed under the tree.
        if (notes.length) {
            const nx = PAD, nw = W - PAD * 2;
            let ny = maxY + dy + 34;
            ctx.strokeStyle = '#c8b89a'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + nw, ny); ctx.stroke();
            ny += 20;
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.font = "600 13px 'Cormorant SC', 'EB Garamond', serif";
            ctx.fillStyle = color('--ink-muted') || '#6b5d50';
            if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
            ctx.fillText('NOTES', nx, ny);
            if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
            ny += 22;
            notes.forEach(n => {
                ctx.textAlign = 'right'; ctx.fillStyle = gold0; ctx.font = "600 15px 'EB Garamond', Georgia, serif";
                ctx.fillText(n.n, nx + NOTE_COL - 8, ny);
                ctx.textAlign = 'left';
                ctx.font = premFont; ctx.fillStyle = color('--ink-muted') || '#6b5d50';
                ctx.fillText(n.premLine, nx + NOTE_COL, ny);
                ctx.font = noteFont; ctx.fillStyle = color('--ink') || '#1a1410';
                n.lines.forEach((ln, i) => ctx.fillText(ln, nx + NOTE_COL, ny + NOTE_LH * (i + 1)));
                ny += n.h;
            });
        }

        // Footer, as in the PDF export: a rule, a small ornament, then the watermark.
        const fy = H - FOOT + 14;
        const gold = '#b8860b';
        ctx.strokeStyle = '#c8b89a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD, fy); ctx.lineTo(W - PAD, fy); ctx.stroke();
        const orn = Math.min(W * 0.5, 420), ox = (W - orn) / 2, oy = fy + 24;
        [[ox, ox + orn / 2 - 16, false], [ox + orn / 2 + 16, ox + orn, true]].forEach(([x1, x2, fadeOut]) => {
            const g = ctx.createLinearGradient(x1, 0, x2, 0);
            g.addColorStop(0, fadeOut ? gold : 'rgba(184,134,11,0)');
            g.addColorStop(0.5, gold);
            g.addColorStop(1, fadeOut ? 'rgba(184,134,11,0)' : gold);
            ctx.strokeStyle = g;
            ctx.beginPath(); ctx.moveTo(x1, oy); ctx.lineTo(x2, oy); ctx.stroke();
        });
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = gold;
        ctx.globalAlpha = 0.7; ctx.font = "13px 'Amiri', serif"; ctx.fillText('❧', W / 2, oy);
        ctx.globalAlpha = 0.85; ctx.font = "italic 15px 'Amiri', serif";
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0.9px';
        ctx.fillText('Made with Qaḍiyya', W / 2, oy + 26);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.globalAlpha = 0.65; ctx.font = "18px 'Amiri', serif";
        ctx.fillText('قضية', W / 2, oy + 50);
        ctx.globalAlpha = 1;

        const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const base = (title || 'argument').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'argument';
        a.href = url; a.download = base + '_tree.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
        if (wasCollapsed) body.classList.add('collapsed');
    }
}