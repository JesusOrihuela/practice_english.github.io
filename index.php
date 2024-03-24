<?php include 'header.php'; ?>

<body class="index-page">

    <main>
        <section class="practice-section">
            <h2>Daily Life</h2>
            <img src="img/cotidiano.jpg" alt="Daily Life">
            <button onclick="setVariables('DailyLife_phrases', 'DailyLife_traductions')" class="practice-button">Practicar</button>
        </section>

        <section class="practice-section">
            <h2>Accountability</h2>
            <img src="img/contabilidad.jpg" alt="Accountability">
            <button onclick="setVariables('Accountability_phrases', 'Accountability_traductions')" class="practice-button">Practicar</button>
        </section>

        <section class="practice-section">
            <h2>Gym</h2>
            <img src="img/gym.jpg" alt="Gym">
            <button onclick="setVariables('Gym_phrases', 'Gym_traductions')" class="practice-button">Practicar</button>
        </section>

        <section class="practice-section">
            <h2>Restaurant</h2>
            <img src="img/restaurante.jpg" alt="Restaurant">
            <button onclick="setVariables('Restaurant_phrases', 'Restaurant_traductions')" class="practice-button">Practicar</button>
        </section>

        <section class="practice-section">
            <h2>Kitchen</h2>
            <img src="img/cocina.jpg" alt="Kitchen">
            <button onclick="setVariables('Kitchen_phrases', 'Kitchen_traductions')" class="practice-button">Practicar</button>
        </section>

        <section class="practice-section">
            <h2>Traveling</h2>
            <img src="img/aeropuerto.jpg" alt="Traveling">
            <button onclick="setVariables('Traveling_phrases', 'Traveling_traductions')" class="practice-button">Practicar</button>
        </section>
    </main>

    <script>
        function setVariables(lista1, lista2) {
            localStorage.setItem('lista1', lista1);
            localStorage.setItem('lista2', lista2);
            window.location.href = 'practice.php';
        }
    </script>

</body>

<?php include 'footer.php'; ?>
