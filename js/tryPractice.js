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

    // Inicializa variables
    const phraseElement = document.getElementById('Phrase');
    const recognizedTextElement = document.getElementById('recognizedText');
    const translationElement = document.getElementById('Traduction');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para el botón de pronunciación de la frase
function startSpeaking() {
    const phrase = phraseElement.textContent; // Obtiene la frase actual

    const speechSynthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = 'es-ES'; // Configura el idioma a español
    speechSynthesis.speak(utterance); // Inicia la lectura de la frase
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para el botón de escuchar al usuario
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

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para mostrar el texto reconocido
function displayRecognizedText(text) {
    const originalPhrase = phraseElement.textContent.trim(); // Obtiene la frase original
    const cleanedPhrase = cleanContractions(originalPhrase); // Limpia la frase original
    const cleanedText = cleanContractions(text); // Limpia el texto reconocido

    console.log('Frase original:', originalPhrase);
    console.log('Frase limpiada:', cleanedPhrase);
    console.log('Texto reconocido:', text);
    console.log('Texto limpiado:', cleanedText);

    if (cleanedText.trim().toLowerCase() === cleanedPhrase.toLowerCase()) {
        recognizedTextElement.textContent = "Correct";
    } else {
        // Muestra el texto original con contracciones en caso de error
        recognizedTextElement.textContent = `Incorrect. You said: "${text}"`;
    }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para cargar las frases basadas en el tema actual dependiendo del botón presionado a partir de un archivo JSON
function loadPhrases(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            const { phrase, translation } = getRandomPhraseAndTranslation(data.phrases, data.traductions);
            displayPhraseAndTranslation(phrase, translation);
        })
        .catch(error => console.error('Error:', error));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para obtener una frase y su traducción aleatoria
function getRandomPhraseAndTranslation(phrases, translations) {
    const randomIndex = Math.floor(Math.random() * phrases.length);
    return {
        phrase: phrases[randomIndex],
        translation: translations[randomIndex]
    };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para mostrar la frase y su traducción
function displayPhraseAndTranslation(phrase, translation) {
    phraseElement.textContent = phrase; // Muestra la frase en el contenedor 'Phrase'
    translationElement.textContent = translation; // Muestra la traducción en el contenedor 'Traduction'
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Carga el archivo contractions.json
let contractionsData = null;
fetch('json/contractions.json')
    .then(response => response.json())
    .then(data => {
        contractionsData = data.contractions;
    })
    .catch(error => console.error('Error al cargar contracciones:', error));

// Función para limpiar las contracciones
function cleanContractions(text) {
    if (!contractionsData) return text; // Si no se han cargado las contracciones, retorna el texto sin cambios

    contractionsData.forEach(contraction => {
        const regex = new RegExp(contraction.original, 'gi');
        text = text.replace(regex, contraction.expanded);
    });

    return text;
}

