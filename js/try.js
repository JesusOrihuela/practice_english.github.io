let currentTheme = ''; // Variable global para almacenar el tema actual

function setVariables(theme) {
    currentTheme = theme; // Asigna el tema actual
    localStorage.setItem('currentTheme', currentTheme); // Almacena el tema actual en el almacenamiento local
    window.location.href = 'practice.html'; // Redirige a practice.html
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

// Función para cargar las frases cuando se carga la página
function loadPhrasesOnPageLoad() {
    const theme = localStorage.getItem('currentTheme');
    if (theme) {
        loadPhrases(`json/${theme}.json`);
    }
}

// Llama a la función para cargar las frases cuando se carga la página
loadPhrasesOnPageLoad();