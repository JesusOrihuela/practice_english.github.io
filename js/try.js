let currentTheme = ''; // Variable global para almacenar el tema actual

function setVariables(theme) {
    currentTheme = theme; // Asigna el tema actual
    loadPhrases(`json/${currentTheme}.json`); // Carga las frases basadas en el tema actual
}

function loadPhrases(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            displayRandomPhraseAndTranslation(data.phrases, data.traductions);
        })
        .catch(error => console.error('Error:', error));
}

function displayRandomPhraseAndTranslation(phrases, translations) {
    const phrasesContainer = document.getElementById('Phrase');
    const translationsContainer = document.getElementById('Traduction');
    const randomIndex = Math.floor(Math.random() * phrases.length);
    phrasesContainer.textContent = phrases[randomIndex];
    translationsContainer.textContent = translations[randomIndex];
}