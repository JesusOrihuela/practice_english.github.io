document.addEventListener('DOMContentLoaded', function() {
    const currentTheme = localStorage.getItem('currentTheme'); // Obtiene el tema actual del almacenamiento local
    if (currentTheme) {
        loadPhrases(`json/${currentTheme}.json`); // Carga las frases basadas en el tema actual
    }
});

function loadPhrases(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            const { phrase, translation } = getRandomPhraseAndTranslation(data.phrases, data.traductions);
            applyContractions(phrase).then(phraseWithContractions => {
                displayPhraseAndTranslation(phrase, translation);
            });
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

function applyContractions(phrase) {
    return fetch('json/contractions.json')
        .then(response => response.json())
        .then(contractions => {
            let phraseWithContractions = phrase;
            for (const [contraction, expansion] of Object.entries(contractions)) {
                phraseWithContractions = phraseWithContractions.replace(new RegExp(contraction, 'g'), expansion);
            }
            return phraseWithContractions;
        });
}

function displayPhraseAndTranslation(originalPhrase, translation) {
    const phraseElement = document.getElementById('Phrase');
    phraseElement.textContent = originalPhrase; // Muestra la frase original en el contenedor 'Phrase'

    const translationElement = document.getElementById('Traduction');
    translationElement.textContent = translation; // Muestra la traducción en el contenedor 'Traduction'

    console.log(phraseWithContractions); // Muestra la frase con contracciones en la consola
}