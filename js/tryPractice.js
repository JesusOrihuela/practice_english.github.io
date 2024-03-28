document.addEventListener('DOMContentLoaded', function() {
    const currentTheme = localStorage.getItem('currentTheme'); // Obtiene el tema actual del almacenamiento local
    if (currentTheme) {
        loadPhrases(`json/${currentTheme}.json`); // Carga las frases basadas en el tema actual
        loadContractions(); // Carga las contracciones
    }
});

function loadPhrases(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            const { phrase, translation } = getRandomPhraseAndTranslation(data.phrases, data.traductions);
            displayPhraseAndTranslation(phrase, translation);
            applyContractions(phrase); // Aplica las contracciones a la frase
        })
        .catch(error => console.error('Error:', error));
}

function loadContractions() {
    fetch('json/contractions.json')
        .then(response => response.json())
        .then(data => {
            const contractions = data.contractions;
            // Aquí puedes hacer lo que necesites con las contracciones, por ejemplo, aplicarlas a una frase
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

    console.log(applyContractions(phrase));
}

function applyContractions(phrase) {
    fetch('json/contractions.json')
        .then(response => response.json())
        .then(data => {
            const contractions = data.contractions;
            let modifiedPhrase = phrase;
            contractions.forEach(contraction => {
                const regex = new RegExp(contraction.original, 'g');
                modifiedPhrase = modifiedPhrase.replace(regex, contraction.expanded);
            });
        })
        .catch(error => console.error('Error:', error));
}