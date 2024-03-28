document.addEventListener('DOMContentLoaded', function() {
    const currentTheme = localStorage.getItem('currentTheme'); // Obtiene el tema actual del almacenamiento local
    if (currentTheme) {
        loadPhrases(`json/${currentTheme}.json`); // Carga las frases basadas en el tema actual
    }
});

function setVariables(theme) {
    localStorage.setItem('currentTheme', theme); // Guarda el tema actual en el almacenamiento local
    window.location.href = 'tryPractice.html'; // Redirige al usuario a tryPractice.html
}

function loadPhrases(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            const { phrase, translation } = getRandomPhraseAndTranslation(data.phrases, data.traductions);
            displayPhraseAndTranslation(phrase, translation);
        })
        .catch(error => console.error('Error:', error));
}

function getRandomPhraseAndTranslation(phrases, translations) {
    const randomIndex = Math.floor(Math.random() * phrases.length);
    return {
        phrase: phrases[randomIndex],
        translation: translations[randomIndex]
    };
}

function displayPhraseAndTranslation(phrase, translation) {
    const phraseElement = document.getElementById('Phrase');
    phraseElement.textContent = phrase; // Muestra la frase en el contenedor 'Phrase'

    const translationElement = document.getElementById('Traduction');
    translationElement.textContent = translation; // Muestra la traducción en el contenedor 'Traduction'
}