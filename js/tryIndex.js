//Función que establece las variables de tema y redirige al usuario a tryPractice.html
function setVariables(theme) {
    localStorage.setItem('currentTheme', theme); // Guarda el tema actual en el almacenamiento local
    window.location.href = 'tryPractice.html'; // Redirige al usuario a tryPractice.html
}