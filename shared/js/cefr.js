/* ============================================================
   cefr.js — CEFR level ordering constant (single source of truth)
   All activities use this for sorting phrases/words by level.

   To add a new level: append it here. No other file needs changing
   for sorting to work — activities reference CEFR_ORDER directly.
   ============================================================ */

/* global */ const CEFR_ORDER = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
