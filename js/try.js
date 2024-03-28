document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado');
    // Obtener la sección del almacenamiento local
    var section = localStorage.getItem('section');

    // Si hay una sección guardada, cargar las frases y traducciones
    if (section) {
        loadPhrases(`json/${section}.json`);
        console.log('Sección cargada:', section);
    }
});

function setVariables(section) {
    console.log('Sección seleccionada:', section);
    // Guardar la sección en el almacenamiento local
    localStorage.setItem('section', section);
    // Cargar las frases y traducciones para la sección seleccionada
    loadPhrases(`../json/${section}.json`);
}

function loadPhrases(jsonFile) {
    console.log('Cargando frases y traducciones:', jsonFile);
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            displayRandomPhraseAndTranslation(data.phrases, data.traductions);
        })
        .catch(error => console.error('Error:', error));
}

function displayRandomPhraseAndTranslation(phrases, translations) {
    console.log('Mostrando frase y traducción aleatoria');
    const phrasesContainer = document.getElementById('Phrase');
    const translationsContainer = document.getElementById('Traduction');
    const randomIndex = Math.floor(Math.random() * phrases.length);
    phrasesContainer.textContent = phrases[randomIndex];
    translationsContainer.textContent = translations[randomIndex];
}