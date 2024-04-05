//Función que establece las variables de tema y redirige al usuario
function setVariables(theme) {
    localStorage.setItem('currentTheme', theme); // Guarda el tema actual en el almacenamiento local
    window.location.href = '../../speakingExercises/html/speakingExercises.html'; // Redirige al usuario
}

document.querySelectorAll('.practice-section img').forEach(function(img) {
    img.style.width = '100%';
    img.style.objectFit = 'cover';
});