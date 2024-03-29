document.addEventListener('DOMContentLoaded', function() {
    const currentTheme = localStorage.getItem('currentTheme'); // Obtiene el tema actual del almacenamiento local
    if (currentTheme) {
        loadPhrases(`json/${currentTheme}.json`); // Carga las frases basadas en el tema actual
    }

    document.getElementById('listenButton').addEventListener('click', startSpeechRecognition);
});

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

function startSpeechRecognition() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();

    recognition.onresult = function(event) {
        const speechResult = event.results[0][0].transcript;
        const phraseElement = document.getElementById('Phrase');
        const recognitionResultElement = document.getElementById('recognitionResult');

        if (speechResult.toLowerCase() === phraseElement.textContent.toLowerCase()) {
            recognitionResultElement.textContent = '¡Correcto!';
        } else {
            recognitionResultElement.textContent = 'Incorrecto. Intenta de nuevo.';
        }
    };

    recognition.onspeechend = function() {
        recognition.stop();
    };

    recognition.onerror = function(event) {
        console.error('Error:', event.error);
    };
}