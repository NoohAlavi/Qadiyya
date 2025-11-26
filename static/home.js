function newProject() {
    document.getElementById("myForm").style.display = "flex";
}

function openProject() {
    document.location = "/editor";
}

function closeForm() {
    document.getElementById("myForm").style.display = "none";
}

function createNewProject(event) {
    event.preventDefault();

    console.log(document.getElementById('title').value);
    fetch('/create_new_argument', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: document.getElementById('title').value
        })
    }).then(res => res.json())
        .then(data => {
            window.location.href = data.redirect; // 🔥 Navigate to /editor
        });;
}