document.addEventListener('DOMContentLoaded', function() {
    // Obtener la sección del almacenamiento local
    var section = localStorage.getItem('section');

    // Si hay una sección guardada, cargar las frases y traducciones
    if (section) {
        loadPhrases(`json/${section}.json`);
    }
});

function setVariables(section) {
    // Guardar la sección en el almacenamiento local
    localStorage.setItem('section', section);
    // Cargar las frases y traducciones para la sección seleccionada
    loadPhrases(`json/${section}.json`);
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