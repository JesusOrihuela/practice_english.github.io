// ----------------------------------------------------------------------------------------------------------------------------------
// Variables
const listenButton = document.getElementById('listenButton');
const phraseElement = document.getElementById('Phrase');
const message = document.getElementById('recognizedText');
const tryAgainButton = document.getElementById('tryAgainButton');
const tryAnotherButton = document.getElementById('tryAnotherButton');
let understood = false;
let microphone = false;
let jsConfetti = new JSConfetti();

// ----------------------------------------------------------------------------------------------------------------------------------
// Función para 
document.addEventListener('DOMContentLoaded', function() {
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

// Inicializa recognizedText con el mensaje inicial
message.textContent = "Press the button when you're ready to talk";

listenButton.addEventListener('click', function() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // Actualiza el mensaje inicial
    message.textContent = "Press the button when you're ready to talk";

    recognition.start();

    recognition.onstart = function() {
        microphone = true;
        // Actualiza recognizedText a "Listening..." cuando el micrófono esté activo
        message.textContent = "Listening...";
        // Mantiene desactivado el botón, le cambia el color de fondo, y no permite el click
        listenButton.disabled = true;
        speakButton.disabled = true;
        // Reactiva los botones Try Again y Try Another
        tryAgainButton.disabled = false;
        tryAnotherButton.disabled = false;
        // Understood se reinicia a falso
        understood = false;
        console.log('OnStart: ', understood);
    };

    recognition.onresult = function(event) {
        console.log('OnResult 1: ', understood);
        const speechResult = (event.results[0][0].transcript.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿¡?!]/g,""));
        const targetPhrase = (phraseElement.textContent.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿¡?!]/g,""));
        console.log('Speech Result:');
        console.log(event.results[0][0].transcript);
        //console.log(expandContractions(speechResult));
        console.log('Target Phrase:');
        console.log(phraseElement.textContent);
        //console.log(expandContractions(targetPhrase));
        console.log(speechResult, " = ", targetPhrase, ": ", speechResult === targetPhrase);
        if (speechResult === targetPhrase) {
            message.textContent = 'Correct, but could be better!';
            // Actualiza recognizedText con el texto reconocido dependiendo del nivel de confianza
            if (event.results[0][0].confidence >= 0.975) {
                message.textContent = 'Excellent!';
                jsConfetti.addConfetti({confettiNumber: 1000});
            }
            else if (event.results[0][0].confidence >= 0.95) {
                message.textContent = 'Great!';
                jsConfetti.addConfetti({confettiNumber: 400});
            }
            else if (event.results[0][0].confidence >= 0.9) {
                message.textContent = 'Good!';
                jsConfetti.addConfetti({confettiNumber: 150});
            }
            else {
                jsConfetti.addConfetti({confettiNumber: 50});
            }
            // Agrega el porcentaje de confianza al mensaje, redondeado a dos decimales
            message.textContent += '\nConfidence: ' + (event.results[0][0].confidence * 100).toFixed(2) + '%';
            understood = true;
        } else {
            // Actualiza recognizedText con el texto reconocido
            let recognizedText = event.results[0][0].transcript;
            // Si dentro de recognizedText se encuentra la palabra "i", se reemplaza por "I"
            recognizedText = recognizedText.replace(/\bi\b/g, 'I');
            // Se pone la primera letra de recognizedText en mayúscula
            recognizedText = recognizedText.charAt(0).toUpperCase() + recognizedText.slice(1);
            // Se actualiza recognizedText con el mensaje
            message.textContent = 'Try Again. I understood: "' + recognizedText + '"';
            understood = true;
        }
        console.log('OnResult 2: ', understood);
    };

    recognition.onspeechend = function() {
        recognition.stop();
    };

    recognition.onerror = function(event) {
        console.log('OnError: ', understood);
        // Mantiene desactivado el botón, le cambia el color de fondo, y no permite el click
        listenButton.disabled = true;
        speakButton.disabled = true;
        // Reactiva los botones Try Again y Try Another
        tryAgainButton.disabled = false;
        tryAnotherButton.disabled = false;
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

    recognition.onend = function() {
        console.log('OnEnd: ', understood);
        if (!microphone) {
            // Actualiza recognizedText con el mensaje de error
            message.textContent = 'No microphone was found. Connect a microphone and try again!';
        }
        else if (!understood) {
            // Actualiza recognizedText con el mensaje de error
            message.textContent = 'Try Again. I did not understand you!';
        }
    };

});