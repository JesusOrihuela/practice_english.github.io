// Declaración de variables globales
let listenButton;
let speakButton;
let tryAnotherButton;
let tryAgainButton;
let message;
let jsConfetti;

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
    listenButton = document.getElementById('listenButton');
    listenButton.addEventListener('click', startListening);

    // Inicializa el botón de hablar
    speakButton = document.getElementById('speakButton');
    speakButton.addEventListener('click', startSpeaking);

    // Inicializa el botón de intentar de nuevo
    tryAnotherButton = document.getElementById('tryAnotherButton');
    tryAnotherButton.addEventListener('click', function() {
        location.reload(); // Reinicia la página
    });

    // Inicializa el botón de intentar de nuevo
    tryAgainButton = document.getElementById('tryAgainButton');
    tryAgainButton.addEventListener('click', function() {
        // Habilita los botones de escucha y hablar
        listenButton.disabled = false;
        speakButton.disabled = false;

        // Mantiene desactivados los botones Try Again y Try Another
        tryAgainButton.disabled = true;
        tryAnotherButton.disabled = true;

        // Inicializa recognizedText con el mensaje inicial
        message.textContent = "Press the button when you're ready to talk";
    });

    // Establece un texto inicial para recognizedText
    message = document.getElementById('recognizedText');
    message.textContent = "Pronuncia la frase correctamente para comenzar.";
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para el botón de pronunciación de la frase
function startSpeaking() {
    // Obtiene la frase actual
    const phraseElement = document.getElementById('Phrase');
    const phraseText = phraseElement.textContent; 

    // Crear una nueva instancia de SpeechSynthesisUtterance
    const utterance = new SpeechSynthesisUtterance(phraseText);
    // Establecer el idioma a inglés británico o americano aleatoriamente
    utterance.lang = Math.random() < 0.5 ? 'en-GB' : 'en-US';

    // Se desactiva el botón de hablar y escuchar mientras se reproduce el audio
    speakButton.disabled = true;
    listenButton.disabled = true;

    // Agregar un evento para reactivar el botón una vez que el audio haya terminado
    utterance.onend = function() {
        speakButton.disabled = false;
        listenButton.disabled = false;
    };

    // Inicia la lectura de la frase
    speechSynthesis.speak(utterance); 
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

        // Understood se reinicia a falso
        understood = false;
    }

    // Acciones cuando se detecta un resultado
    recognition.onresult = function(event) {
        const speechResult = event.results[0][0].transcript; // Obtiene el resultado del reconocimiento de voz
        const speechConfidence = event.results[0][0].confidence; // Obtiene la confianza del resultado
        displayRecognizedText(speechResult, speechConfidence);
        understood = true;
    };

    // Acciones cuando se detiene el reconocimiento de voz
    recognition.onspeechend = function() {
        recognition.stop(); // Detiene el reconocimiento de voz
    };

    // Acciones cuando se detecta un error
    recognition.onerror = function(event) {
        // Mantiene desactivado el botón de escucha y hablar
        listenButton.disabled = true;
        speakButton.disabled = true;

        // Reactiva los botones Try Again y Try Another
        tryAgainButton.disabled = false;
        tryAnotherButton.disabled = false;
        // Actualiza recognizedText con el mensaje de error correspondiente
        if (event.error === 'no-speech') {
            message.textContent = "I didn't understand you. Try again!";
        }
        else if (event.error === 'audio-capture') {
            message.textContent = 'No microphone was found. Connect a microphone and try again!';
        }
        else if (event.error === 'not-allowed') {
            message.textContent = 'Permission to use the microphone is blocked. Change the permission in the settings and try again!';
        }
        else {
            message.textContent = 'An error occurred. Try again!';
        }
    };

    // Acciones cuando se termina el reconocimiento de voz
    recognition.onend = function() {
        // Si no se ha entendido o no se ha encontrado un micrófono, se muestra el mensaje correspondiente
        if (!microphone) {
            message.textContent = 'No microphone was found. Connect a microphone and try again!';
        }
        else if (!understood) {
            message.textContent = 'Try Again. I did not understand you!';
        }

        // Activa los botones de intentar de nuevo y intentar otro
        tryAnotherButton.disabled = false;
        tryAgainButton.disabled = false;
    };

}

// ---------------------------------------------------------------------------------------------------------------------------------
// Función para mostrar el texto reconocido
function displayRecognizedText(text, confidence) {
    const phraseElement = document.getElementById('Phrase'); // Obtiene la frase a pronunciar
    const originalPhrase = phraseElement.textContent.trim(); // Obtiene la frase del usuario
    const cleanedPhrase = expandContractions(originalPhrase).trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿¡?!]/g,""); // Limpia la frase original
    const cleanedText = expandContractions(text).toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿¡?!]/g,""); // Limpia el texto reconocido
    jsConfetti = new JSConfetti(); // Inicializa la librería de confeti

    if (cleanedText === cleanedPhrase) {
        // Actualiza recognizedText con el texto reconocido dependiendo del nivel de confianza
        if (confidence >= 0.975) {
            message.textContent = 'Excellent!';
            jsConfetti.addConfetti({confettiNumber: 1000});
        }
        else if (confidence >= 0.95) {
            message.textContent = 'Great!';
            jsConfetti.addConfetti({confettiNumber: 400});
        }
        else if (confidence >= 0.9) {
            message.textContent = 'Good!';
            jsConfetti.addConfetti({confettiNumber: 150});
        }
        else {
            message.textContent = 'Correct, but could be better!';
            jsConfetti.addConfetti({confettiNumber: 50});
        }
        // Agrega el porcentaje de confianza al mensaje, redondeado a dos decimales
        message.textContent += '\nConfidence: ' + (confidence * 100).toFixed(2) + '%';
    } else {
        // Actualiza recognizedText con el texto reconocido
        let recognizedText = text;
        // Si dentro de recognizedText se encuentra la palabra "i", se reemplaza por "I"
        recognizedText = recognizedText.replace(/\bi\b/g, 'I');
        // Se pone la primera letra de recognizedText en mayúscula
        recognizedText = recognizedText.charAt(0).toUpperCase() + recognizedText.slice(1);
        // Se actualiza recognizedText con el mensaje
        message.textContent = 'Try Again. I understood: "' + recognizedText + '"';
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
function expandContractions(text) {
    if (!contractionsData) return text; // Si no se han cargado las contracciones, retorna el texto sin cambios

    contractionsData.forEach(contraction => {
        const regex = new RegExp(contraction.original, 'gi');
        text = text.replace(regex, contraction.expanded);
    });

    return text;
}

