/* ============================================================
   activity.js — AppActivity: shared boilerplate every activity's init runs.

   Each activity's DOMContentLoaded opened with the same three steps (load the
   active pair's topics + grammar, read the URL, and enter path mode). Centralized
   here so the sequence stays identical across activities and future pairs.

     await AppActivity.loadData()        — AppTopics + AppPath (pair-aware) loaded
     AppActivity.pathParams()            — { topic, path, card } from the URL
     AppActivity.startPathMode()         — hide the back button, start the session

   This is a lifecycle *helper*, not a control-flow factory: activities still drive
   their own flow, they just call these instead of re-inlining the boilerplate.
   ============================================================ */
var AppActivity = (function () {

  // Load the active pair's topic list (and grammar rules) before anything reads
  // them. Safe to await even where a module is absent.
  async function loadData() {
    if (typeof AppTopics !== 'undefined' && AppTopics.load) await AppTopics.load();
    if (typeof AppPath !== 'undefined' && AppPath.load) await AppPath.load();
  }

  // URL entry point: ?topic=<id>&path=1&card=<id>.
  function pathParams() {
    var p = new URLSearchParams(location.search);
    return { topic: p.get('topic'), path: p.get('path') === '1', card: p.get('card') };
  }

  // Enter Ruta de Aprendizaje mode: the topic picker's back button is irrelevant
  // (the session drives navigation), and the PathSession begins.
  function startPathMode() {
    var back = document.getElementById('back-btn');
    if (back) back.classList.add('hidden');
    if (typeof PathSession !== 'undefined') PathSession.start();
  }

  return { loadData: loadData, pathParams: pathParams, startPathMode: startPathMode };
})();
