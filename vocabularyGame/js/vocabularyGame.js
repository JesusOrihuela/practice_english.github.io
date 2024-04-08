document.addEventListener('DOMContentLoaded', (event) => {
    let words = [];
    let selectedWord = '';
    let hiddenWord = '';
    let incorrectGuesses = 0; // Contador de intentos incorrectos

    // Función para cargar las palabras desde el archivo JSON
    function loadWords() {
        fetch('../json/words.json')
            .then(response => response.json())
            .then(data => {
                words = data.words;
                selectRandomWord();
                createKeyboard();
            })
            .catch(error => console.error('Error al cargar las palabras:', error));
    }

    // Función para seleccionar una palabra aleatoria
    function selectRandomWord() {
        selectedWord = words[Math.floor(Math.random() * words.length)];
        hiddenWord = selectedWord.split('').map(() => '_').join(' ');
        wordDisplay.textContent = hiddenWord;
    }

    // Función para crear el teclado
    function createKeyboard() {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        letters.split('').forEach(letter => {
            const button = document.createElement('button');
            button.textContent = letter;
            button.id = `letter-${letter}`; // Asigna un identificador único
            button.addEventListener('click', () => guessLetter(letter));
            keyboard.appendChild(button);
        });
    }

    // Función para adivinar una letra
    function guessLetter(letter) {
        if (selectedWord.includes(letter)) {
            selectedWord.split('').forEach((char, index) => {
                if (char === letter) {
                    const wordArray = hiddenWord.split(' ');
                    wordArray[index] = letter;
                    hiddenWord = wordArray.join(' ');
                }
            });
            wordDisplay.textContent = hiddenWord;
            document.getElementById(`letter-${letter}`).classList.add('correct');

            // Verifica si el usuario ha adivinado la palabra completa
            if (!hiddenWord.includes('_')) {
                disableKeyboard();
                document.getElementById('restart-button').disabled = false; // Activa el botón de reinicio
            }

        } else {
            incorrectGuesses++; // Incrementa el contador de intentos incorrectos
            document.getElementById(`letter-${letter}`).classList.add('incorrect');
            document.getElementById(`letter-${letter}`).disabled = true; // Desactiva el botón

            // Verifica si el usuario ha perdido
            if (incorrectGuesses >= 7) {
                disableKeyboard();
                document.getElementById('restart-button').disabled = false; // Activa el botón de reinicio
            }
        }

        // Función para desactivar todos los botones del teclado
        function disableKeyboard() {
            const buttons = document.querySelectorAll('#keyboard button');
            buttons.forEach(button => {
                button.disabled = true;
            });
        }

        // Verifica si el usuario ha ganado
        if (hiddenWord === selectedWord) {
            disableKeyboard();
            document.getElementById('restart-button').disabled = false; // Activa el botón de reinicio
        }
    }

    // Obtener referencias a los elementos del DOM
    const wordDisplay = document.getElementById('word-display');
    const keyboard = document.getElementById('keyboard');

    // Inicializar el juego
    loadWords();
});

document.getElementById('restart-button').addEventListener('click', () => {
    // Reinicia el juego
    location.reload();
});