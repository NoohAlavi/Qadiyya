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
            const fieldType = e.target.classList.contains('barebones') ? 'barebones' : 'written_premise';

            console.log(`Updating ${fieldType} for premise ${premiseNumber}: ${newText}`);

            await fetch('/update_premise', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: premiseNumber, field: fieldType, value: newText })
            });

            // update old value so next blur works correctly
            e.target.dataset.oldValue = newText;

            window.location.reload();
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

            await fetch('/update_proposition_type', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: newValue, number: premiseNumber })
            });

            // update old value
            e.target.dataset.oldValue = newValue;

            window.location.reload();
        });
    });

});
