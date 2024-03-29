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

    // Establece un texto inicial para recognizedText
    const message = document.getElementById('recognizedText');
    message.textContent = "Pronuncia la frase correctamente para comenzar.";

    // Inicializa la librería de confeti
    const jsConfetti = new JSConfetti();
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para el botón de pronunciación de la frase
function startSpeaking() {
    const phraseElement = document.getElementById('Phrase');
    const phrase = phraseElement.textContent; // Obtiene la frase actual

    const speechSynthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = 'es-ES'; // Configura el idioma a español
    speechSynthesis.speak(utterance); // Inicia la lectura de la frase
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para el botón de escuchar al usuario
function startListening() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
    recognition.lang = 'es-US'; // Configura el idioma a inglés
    recognition.interimResults = false; // Solo queremos los resultados finales
    recognition.maxAlternatives = 1; // Solo queremos la mejor alternativa

    // Inicializa variables
    let understood = false;
    let microphone = false;

    // Establece un texto inicial para recognizedText
    message.textContent = "Pronuncia la frase correctamente para comenzar."; 

    recognition.start(); // Inicia el reconocimiento de voz

    recognition.onstart = function() {
        microphone = true;

        // Actualiza recognizedText a "Listening..." cuando el micrófono esté activo
        message.textContent = "Listening...";

        // Desactiva los botones de escucha y hablar
        listenButton.disabled = true;
        speakButton.disabled = true;

        // Activa los botones de intentar de nuevo y intentar otro
        tryAnotherButton.disabled = false;
        tryAgainButton.disabled = false;

        // Understood se reinicia a falso
        understood = false;
    }

    // Acciones cuando se detecta un resultado
    recognition.onresult = function(event) {
        const speechResult = event.results[0][0].transcript; // Obtiene el resultado del reconocimiento de voz
        displayRecognizedText(speechResult);
    };

    // Acciones cuando se detecta un error
    recognition.onerror = function(event) {
        console.error('Error de reconocimiento de voz:', event.error);
    };

}

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para mostrar el texto reconocido
function displayRecognizedText(text) {
    const message = document.getElementById('recognizedText');
    const phraseElement = document.getElementById('Phrase');
    const originalPhrase = phraseElement.textContent.trim(); // Obtiene la frase original
    const cleanedPhrase = cleanContractions(originalPhrase); // Limpia la frase original
    const cleanedText = cleanContractions(text); // Limpia el texto reconocido

    console.log('Frase original:', originalPhrase);
    console.log('Frase limpiada:', cleanedPhrase);
    console.log('Texto reconocido:', text);
    console.log('Texto limpiado:', cleanedText);

    if (cleanedText.trim().toLowerCase() === cleanedPhrase.toLowerCase()) {
        message.textContent = "Correct";
    } else {
        // Muestra el texto original con contracciones en caso de error
        message.textContent = `Incorrect. You said: "${text}"`;
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
    const phraseElement = document.getElementById('Phrase');
    phraseElement.textContent = phrase; // Muestra la frase en el contenedor 'Phrase'

    const translationElement = document.getElementById('Traduction');
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

