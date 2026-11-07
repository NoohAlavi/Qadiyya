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

// Remember on the server whether a sub-argument table is collapsed (the flag is stored on the
// premise itself). `keepalive` lets the request finish even if the page reloads straight after.
function saveCollapsed(wrapper, collapsed) {
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
//  bottom; the toggle above the tree moves it to the top (and flips the arrows).
// ══════════════════════════════════════════════════════════════════
const TREE = {
    cardW: 210,     // width of every box
    gapX: 18,       // horizontal gap between neighbouring boxes
    gapY: 44,       // vertical gap between rows (the connector "bus" runs through the middle)
};

let treeData = null;       // last nested tree fetched from /tree_data
let treeLastWidth = 0;     // used to re-render only when the available width changes
let treeFlipped = false;   // false: conclusion at the bottom (default); true: conclusion on top

// The choice is remembered per browser. Storage can be unavailable (private mode, blocked
// cookies), so it must never be allowed to break the page.
function readTreeFlip() {
    try { return localStorage.getItem('qadiyyaTreeFlipped') === '1'; } catch (err) { return false; }
}
function saveTreeFlip(flipped) {
    try { localStorage.setItem('qadiyyaTreeFlipped', flipped ? '1' : '0'); } catch (err) { /* ignore */ }
}

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

// Switch the conclusion between the bottom and the top of the tree.
function flipTree() {
    treeFlipped = !treeFlipped;
    saveTreeFlip(treeFlipped);
    syncTreeFlipUI();
    renderTree();
}

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

    // One div per row. Default: deepest premises first (top) and the conclusion last (bottom).
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
    const collapsed = body.classList.toggle('collapsed');
    btn.textContent = collapsed ? '▼' : '▲';
    btn.title = collapsed ? 'Expand' : 'Collapse';
    if (!collapsed) renderTree();
}

document.addEventListener('DOMContentLoaded', () => {
    const scroller = document.getElementById('tree-scroll');
    if (!scroller) return;

    treeFlipped = readTreeFlip();
    syncTreeFlipUI();
    loadTree();

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