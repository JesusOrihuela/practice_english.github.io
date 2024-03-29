document.addEventListener('DOMContentLoaded', function() {
    const currentTheme = localStorage.getItem('currentTheme'); // Obtiene el tema actual del almacenamiento local
    if (currentTheme) {
        loadPhrases(`json/${currentTheme}.json`); // Carga las frases basadas en el tema actual
    }

    // Inicializa el botón de escucha
    const listenButton = document.getElementById('listenButton');
    listenButton.addEventListener('click', startListening);
});

function startListening() {
    const recognition = new webkitSpeechRecognition(); // Crea una nueva instancia de reconocimiento de voz
    recognition.lang = 'es-ES'; // Configura el idioma a español
    recognition.interimResults = false; // Solo queremos los resultados finales
    recognition.maxAlternatives = 1; // Solo queremos la mejor alternativa

    recognition.onresult = function(event) {
        const speechResult = event.results[0][0].transcript; // Obtiene el resultado del reconocimiento de voz
        displayRecognizedText(speechResult);
    };

    recognition.onerror = function(event) {
        console.error('Error de reconocimiento de voz:', event.error);
    };

    recognition.start(); // Inicia el reconocimiento de voz
}

function displayRecognizedText(text) {
    const recognizedTextElement = document.getElementById('recognizedText');
    recognizedTextElement.textContent = text; // Muestra el texto reconocido en el contenedor 'recognizedText'
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

