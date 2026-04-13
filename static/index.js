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