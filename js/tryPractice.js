// ----------------------------------------------------------------------------------------------------------------------------------
// Variables
const listenButton = document.getElementById('listenButton');
const phraseElement = document.getElementById('Phrase');
const message = document.getElementById('recognizedText');
const tryAgainButton = document.getElementById('tryAgainButton');
const tryAnotherButton = document.getElementById('tryAnotherButton');
let understood = false;
let microphone = false;

// ----------------------------------------------------------------------------------------------------------------------------------
// Función para 
document.addEventListener('DOMContentLoaded', function() {
    // Crea una nueva instancia de JSConfetti
    const jsConfetti = new JSConfetti();
    // Obtiene el tema actual del almacenamiento local
    const currentTheme = localStorage.getItem('currentTheme'); // Obtiene el tema actual del almacenamiento local
    if (currentTheme) {
        loadPhrases(`json/${currentTheme}.json`); // Carga las frases basadas en el tema actual
    }
});

// ----------------------------------------------------------------------------------------------------------------------------------
// Función para 
function loadPhrases(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            const { phrase, translation } = getRandomPhraseAndTranslation(data.phrases, data.traductions);
            displayPhraseAndTranslation(phrase, translation);
        })
        .catch(error => console.error('Error:', error));
}

// ----------------------------------------------------------------------------------------------------------------------------------
// Función para
function getRandomPhraseAndTranslation(phrases, translations) {
    const randomIndex = Math.floor(Math.random() * phrases.length);
    return {
        phrase: phrases[randomIndex],
        translation: translations[randomIndex]
    };
}

// ----------------------------------------------------------------------------------------------------------------------------------
// Función para
function displayPhraseAndTranslation(phrase, translation) {
    phraseElement.textContent = phrase; // Muestra la frase en el contenedor 'Phrase'

    translationElement.textContent = translation; // Muestra la traducción en el contenedor 'Traduction'
}

// ----------------------------------------------------------------------------------------------------------------------------------
// Agregar el evento de clic al botón listenButton

