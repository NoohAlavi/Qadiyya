// ══════════════════════════════════════════════════════════════════
//  SETTINGS PANEL  (shared by the editor and My Arguments pages)
//
//  Adds a gear to the nav bar and builds the panel. Every change is saved to the
//  server straight away, and announced to the page with a 'qadiyya:settings' event
//  so that page can apply it live (the editor does this in index.js).
//
//  The current values arrive in <script id="qadiyya-settings" type="application/json">.
// ══════════════════════════════════════════════════════════════════
(function () {
    const dataEl = document.getElementById('qadiyya-settings');
    let values;
    try { values = JSON.parse(dataEl.textContent); } catch (err) { return; }   // no data: do nothing

    // ── Shared API: window.QadiyyaSettings ────────────────────────
    const Settings = {
        values,

        // Change one setting. The page updates immediately; if the save fails it is put back.
        set(key, value) {
            if (values[key] === value) return Promise.resolve(true);
            const previous = values[key];
            values[key] = value;
            announce(key);

            return fetch('/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value })
            })
                .then(res => { if (!res.ok) throw new Error('save failed'); return true; })
                .catch(() => {
                    values[key] = previous;
                    announce(key);
                    say("Couldn't save that setting. Please try again.", true);
                    return false;
                });
        }
    };
    window.QadiyyaSettings = Settings;

    function announce(key) {
        syncControls();
        document.dispatchEvent(new CustomEvent('qadiyya:settings', {
            detail: { key, value: values[key], values: Object.assign({}, values) }
        }));
    }

    // ── Gear button in the nav bar ────────────────────────────────
    const GEAR_SVG =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 ' +
        '1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 ' +
        '2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 ' +
        '1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 ' +
        '-2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 ' +
        '-2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/>' +
        '<path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>';

    const nav = document.getElementById('nav-links');
    const gear = document.createElement('button');
    gear.type = 'button';
    gear.id = 'settings-btn';
    gear.className = 'nav-icon-btn';
    gear.title = 'Settings';
    gear.setAttribute('aria-label', 'Settings');
    gear.setAttribute('aria-haspopup', 'dialog');
    gear.setAttribute('aria-expanded', 'false');
    gear.innerHTML = GEAR_SVG;

    if (nav) {
        const sep = document.createElement('span');
        sep.className = 'nav-sep';
        sep.textContent = '·';
        const arabic = document.getElementById('logo-arabic');
        nav.insertBefore(sep, arabic);
        nav.insertBefore(gear, arabic);
    }

    // ── The panel (static markup only; no user text goes in here) ──
    const panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Settings');
    panel.innerHTML = `
        <div class="sp-head">
            <h2>Settings</h2>
            <button type="button" class="sp-close" aria-label="Close settings">✕</button>
        </div>
        <div class="sp-body">
            <section class="sp-group">
                <h3>Argument tree</h3>
                <label class="sp-switch">
                    <input type="checkbox" data-key="tree_open">
                    <span class="sp-track"></span>
                    <span class="sp-text">Open the tree by default</span>
                </label>
                <div class="sp-row">
                    <span class="sp-text">Conclusion position</span>
                    <div class="sp-seg" role="radiogroup" aria-label="Conclusion position">
                        <button type="button" role="radio" data-key="tree_conclusion" data-value="bottom">Bottom</button>
                        <button type="button" role="radio" data-key="tree_conclusion" data-value="top">Top</button>
                    </div>
                </div>
                <label class="sp-switch sp-switch-spaced">
                    <input type="checkbox" data-key="tree_notes">
                    <span class="sp-track"></span>
                    <span class="sp-text">Show notes under the tree</span>
                </label>
                <label class="sp-switch sp-switch-spaced">
                    <input type="checkbox" data-key="tree_numbers">
                    <span class="sp-track"></span>
                    <span class="sp-text">Show premise numbers in the tree</span>
                </label>
            </section>

            <section class="sp-group">
                <h3>Sub-arguments</h3>
                <label class="sp-switch">
                    <input type="checkbox" data-key="subargs_open">
                    <span class="sp-track"></span>
                    <span class="sp-text">Open sub-arguments by default</span>
                </label>
            </section>

            <section class="sp-group">
                <h3>Display</h3>
                <div class="sp-row">
                    <span class="sp-text">Table text size</span>
                    <div class="sp-seg" role="radiogroup" aria-label="Table text size">
                        <button type="button" role="radio" data-key="text_size" data-value="small">Small</button>
                        <button type="button" role="radio" data-key="text_size" data-value="medium">Medium</button>
                        <button type="button" role="radio" data-key="text_size" data-value="large">Large</button>
                    </div>
                </div>
            </section>

            <p class="sp-hint">
                Defaults apply to any argument or section you haven't opened or closed yourself.
                <button type="button" class="sp-link" id="sp-reset">Make every argument follow them</button>
            </p>

            <section class="sp-group">
                <h3>Backup</h3>
                <button type="button" class="sp-btn" id="sp-backup">Download all arguments</button>
                <p class="sp-hint sp-hint-small">One file with every argument in this session. Import it from My Arguments to restore.</p>
            </section>

            <p class="sp-status" role="status" aria-live="polite"></p>
        </div>`;
    document.body.appendChild(panel);

    const statusEl = panel.querySelector('.sp-status');
    let statusTimer = null;
    function say(message, isError) {
        statusEl.textContent = message;
        statusEl.classList.toggle('is-error', !!isError);
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 3500);
    }

    // Show the current values in the controls.
    function syncControls() {
        panel.querySelectorAll('input[type="checkbox"][data-key]').forEach(box => {
            box.checked = !!values[box.dataset.key];
        });
        panel.querySelectorAll('button[role="radio"][data-key]').forEach(btn => {
            const on = values[btn.dataset.key] === btn.dataset.value;
            btn.setAttribute('aria-checked', on ? 'true' : 'false');
            btn.classList.toggle('is-active', on);
        });
    }
    syncControls();

    panel.addEventListener('change', e => {
        const box = e.target.closest('input[type="checkbox"][data-key]');
        if (box) Settings.set(box.dataset.key, box.checked);
    });
    panel.addEventListener('click', e => {
        const btn = e.target.closest('button[role="radio"][data-key]');
        if (btn) Settings.set(btn.dataset.key, btn.dataset.value);
    });

    // ── Open / close ──────────────────────────────────────────────
    function isOpen() { return panel.classList.contains('is-open'); }

    function openPanel() {
        panel.classList.add('is-open');
        gear.setAttribute('aria-expanded', 'true');
        const first = panel.querySelector('input, button[role="radio"]');
        if (first) first.focus({ preventScroll: true });
    }
    function closePanel(returnFocus) {
        panel.classList.remove('is-open');
        gear.setAttribute('aria-expanded', 'false');
        if (returnFocus) gear.focus({ preventScroll: true });
    }

    gear.addEventListener('click', () => (isOpen() ? closePanel(false) : openPanel()));
    panel.querySelector('.sp-close').addEventListener('click', () => closePanel(true));
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isOpen()) closePanel(true);
    });
    document.addEventListener('mousedown', e => {
        if (isOpen() && !panel.contains(e.target) && !gear.contains(e.target)) closePanel(false);
    });

    // ── Reset every argument's own open/closed choices ────────────
    panel.querySelector('#sp-reset').addEventListener('click', async () => {
        if (!confirm('Make every argument and sub-argument follow the default settings again?')) return;
        try {
            const res = await fetch('/reset_view_states', { method: 'POST' });
            if (!res.ok) throw new Error();
            window.location.reload();
        } catch (err) {
            say("Couldn't reset that. Please try again.", true);
        }
    });

    // ── Backup: download every argument as one file ───────────────
    panel.querySelector('#sp-backup').addEventListener('click', async () => {
        try {
            const res = await fetch('/export_all');
            if (!res.ok) {
                let message = "Couldn't create the backup.";
                try { message = (await res.json()).error || message; } catch (err) { /* keep default */ }
                say(message, true);
                return;
            }
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = /filename="?([^";]+)"?/.exec(disposition);
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = match ? match[1] : 'qadiyya_backup.json';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            say('Backup downloaded.');
        } catch (err) {
            say("Couldn't create the backup.", true);
        }
    });
})();