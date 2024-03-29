// ---------------------------------------------------------------------------------------------------------------------------------
// Inicialización de los elementos de la página
document.addEventListener('DOMContentLoaded', function() {
    // Obtiene el tema actual del almacenamiento local
    const currentTheme = localStorage.getItem('currentTheme'); 
    // Carga las frases basadas en el tema actual
    if (currentTheme) {
        loadPhrases(`json/${currentTheme}.json`);
    }

    // Inicializa el botón de escucha
    const listenButton = document.getElementById('listenButton');
    listenButton.addEventListener('click', startListening);

    // Inicializa el botón de hablar
    const speakButton = document.getElementById('speakButton');
    speakButton.addEventListener('click', startSpeaking);

    // Inicializa el botón de intentar de nuevo
    const tryAnotherButton = document.getElementById('tryAnotherButton');
    tryAnotherButton.addEventListener('click', function() {
        location.reload(); // Reinicia la página
    });

    // Inicializa el botón de intentar de nuevo
    const tryAgainButton = document.getElementById('tryAgainButton');
    tryAgainButton.addEventListener('click', function() {
        // Habilita los botones de escucha y hablar
        listenButton.disabled = false;
        speakButton.disabled = false;
    });
});

function startSpeaking() {
    const phraseElement = document.getElementById('Phrase');
    const phrase = phraseElement.textContent; // Obtiene la frase actual

    const speechSynthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = 'es-ES'; // Configura el idioma a español
    speechSynthesis.speak(utterance); // Inicia la lectura de la frase
}

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
    const phraseElement = document.getElementById('Phrase');
    const phrase = phraseElement.textContent.trim(); // Obtiene la frase actual

    if (text.trim().toLowerCase() === phrase.toLowerCase()) {
        recognizedTextElement.textContent = "Correct";
    } else {
        recognizedTextElement.textContent = `Incorrect. You said: "${text}"`;
    }
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

