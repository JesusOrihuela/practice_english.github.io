let currentTheme = ''; // Variable global para almacenar el tema actual

function setVariables(theme) {
    currentTheme = theme; // Asigna el tema actual
    loadPhrases(`json/${currentTheme}.json`); // Carga las frases basadas en el tema actual
}

function loadPhrases(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            displayPhrases(data.phrases);
        })
        .catch(error => console.error('Error:', error));
}

function displayPhrases(phrases) {
    const phrasesContainer = document.getElementById('phrasesContainer');
    phrasesContainer.innerHTML = ''; // Limpiar el contenedor antes de mostrar nuevas frases
    phrases.forEach(phrase => {
        const p = document.createElement('p');
        p.textContent = phrase;
        phrasesContainer.appendChild(p);
    });
}