document.addEventListener('DOMContentLoaded', function() {
    const image = document.getElementById('skewingImage');

    image.addEventListener('mousemove', function(e) {
        const rect = image.getBoundingClientRect();
        const x = e.clientX - rect.left; // Obtiene la posición X del cursor dentro del elemento
        const y = e.clientY - rect.top; // Obtiene la posición Y del cursor dentro del elemento
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const skewX = (x - centerX) / 150; // Reducido el valor para una inclinación más sutil
        const skewY = (y - centerY) / 150; // Reducido el valor para una inclinación más sutil

        image.style.transform = `skew(${skewX}deg, ${skewY}deg)`;
    });

    image.addEventListener('mouseleave', function() {
        image.style.transform = 'skew(0deg, 0deg)';
    });
});