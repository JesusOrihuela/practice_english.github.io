<?php include 'header.php'; ?>

<body class="practice-page">
    
    <main>
        <h1 class="main-title">How is it pronounced?</h1>
        <div id="Phrase"></div>
        <div id="Traduction"></div>
        <div class="button-container">
            <button id="listenButton">Speak 🎙️</button>
            <button id="speakButton">Listen 🔊</button>
        </div>
        <div id="recognizedText"></div>
        <div class="button-container">
            <button id="tryAgainButton" disabled>Try Again</button>
            <button id="tryAnotherButton" disabled>Try Another</button>
        </div>
    </main>

    <!-- Incluye el archivo JavaScript -->
    <script src="js/script.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/js-confetti@latest/dist/js-confetti.browser.js"></script>

</body>

<?php include 'footer.php'; ?>
