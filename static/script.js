document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('td.barebones, td.written_premise').forEach(cell => {
        cell.addEventListener('blur', async (e) => {
            const newText = e.target.innerText;
            const premiseNumber = e.target.closest('tr').querySelector('.num').innerText || 0;
            const fieldType = e.target.classList.contains('barebones') ? 'barebones' : 'written_premise';

            console.log(`Updating ${fieldType} for premise ${premiseNumber}: ${newText}`);

            // Send update to backend
            await fetch('/update_premise', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    number: premiseNumber,
                    field: fieldType,
                    value: newText
                })
            });

            // Reload the page to reflect updated data
            window.location.reload();
        });
    });

    document.querySelectorAll('select').forEach(cell => {
        cell.addEventListener('input', async(e) => {
            let value = e.target.value;
            let premiseNumber = e.target.closest('tr').querySelector('.num').innerText || 0;

            // Send update to backend
            await fetch('/update_proposition_type', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    value: value,
                    number: premiseNumber
                })
            });

            window.location.reload();
        })
    })
});
