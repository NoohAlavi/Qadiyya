// The "Help" dropdown in the nav bar: opens on click, closes on Escape, a click elsewhere,
// or choosing a link. Arrow keys move between the items.
(function () {
    const btn = document.querySelector('.nav-menu-btn');
    const list = document.getElementById('nav-help-list');
    if (!btn || !list) return;
    const items = () => Array.from(list.querySelectorAll('a'));

    function open(focusFirst) {
        list.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        if (focusFirst) { const first = items()[0]; if (first) first.focus(); }
    }
    function close(returnFocus) {
        list.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        if (returnFocus) btn.focus();
    }

    btn.addEventListener('click', e => {
        e.stopPropagation();
        list.hidden ? open(false) : close(false);
    });
    btn.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); open(true); }
    });
    list.addEventListener('keydown', e => {
        const links = items(), i = links.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); links[(i + 1) % links.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
        else if (e.key === 'Home') { e.preventDefault(); links[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); links[links.length - 1].focus(); }
    });
    document.addEventListener('click', e => { if (!list.hidden && !list.contains(e.target)) close(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); close(true); } });
})();