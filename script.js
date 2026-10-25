const CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";
const KEY_LENGTH = 6;
const ATTACK_DELAY_MS = 150;

let secretKey = "";
let attackRunning = false;

const randomizeKeyBtn = document.getElementById("randomize-key");
const charBoxes = Array.from(document.querySelectorAll("#guess-boxes .charBox"));
const attackBoxes = Array.from(document.querySelectorAll("#attack-boxes .charBox"));
const submitGuessBtn = document.getElementById("submit-guess");
const guessBarCorrect = document.querySelector("#guess-bar .bar-correct");
const guessBarWrong = document.querySelector("#guess-bar .bar-wrong");
const attackBarCorrect = document.querySelector("#attack-bar .bar-correct");
const attackBarWrong = document.querySelector("#attack-bar .bar-wrong");
const attackStartBtn = document.getElementById("attack-start");
const attackResetBtn = document.getElementById("attack-reset");
const recoveredRow = document.querySelector(".recoveredRow");
const counterSection = document.getElementById("counter");
const recoveredKeyEl = document.getElementById("recovered-key");
const leakCountEl = document.getElementById("leak-count");
const bruteforceCountEl = document.getElementById("bruteforce-count");

function generateKey() {
  let key = "";
  for (let i = 0; i < KEY_LENGTH; i++) {
    const idx = Math.floor(Math.random() * CHARSET.length);
    key += CHARSET[idx];
  }
  return key;
}

function readGuess() {
  return charBoxes.map(function (box) {
    return box.value;
  }).join("");
}

function setAttackBoxes(str) {
  for (let i = 0; i < attackBoxes.length; i++) {
    attackBoxes[i].value = str[i] || "";
  }
}

function clearGuessBoxes() {
  for (let i = 0; i < charBoxes.length; i++) {
    charBoxes[i].value = "";
  }
}

function clearAttackBoxes() {
  for (let i = 0; i < attackBoxes.length; i++) {
    attackBoxes[i].value = "";
  }
}

// Returns the number of wrong characters, or null if the length is wrong
function mismatchCount(guess) {
  if (guess.length !== secretKey.length) {
    return null;
  }
  let wrong = 0;
  for (let i = 0; i < secretKey.length; i++) {
    if (guess[i] !== secretKey[i]) {
      wrong++;
    }
  }
  return wrong;
}

function setBar(correctEl, wrongEl, guess) {
  const wrong = mismatchCount(guess);
  if (wrong === null) {
    correctEl.style.flexGrow = "0";
    wrongEl.style.flexGrow = "0";
    return;
  }
  const correct = KEY_LENGTH - wrong;
  correctEl.style.flexGrow = String(correct);
  wrongEl.style.flexGrow = String(wrong);
}

function setBarByCorrect(correctEl, wrongEl, correct) {
  correctEl.style.flexGrow = String(correct);
  wrongEl.style.flexGrow = String(KEY_LENGTH - correct);
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function runAttack() {
  if (attackRunning) {
    return;
  }
  attackRunning = true;
  recoveredKeyEl.textContent = "";
  recoveredRow.classList.remove("hidden");
  let guesses = 0;
  const current = new Array(KEY_LENGTH).fill(CHARSET[0]);

  for (let pos = 0; pos < KEY_LENGTH; pos++) {
    let bestChar = CHARSET[0];
    let bestWrong = KEY_LENGTH;
    for (let c = 0; c < CHARSET.length; c++) {
      current[pos] = CHARSET[c];
      const trial = current.join("");
      const wrong = mismatchCount(trial);
      guesses++;
      setAttackBoxes(trial);
      if (wrong < bestWrong) {
        bestWrong = wrong;
        bestChar = CHARSET[c];
      }
      await sleep(ATTACK_DELAY_MS);
    }
    current[pos] = bestChar;
    setAttackBoxes(current.join(""));
    setBarByCorrect(attackBarCorrect, attackBarWrong, pos + 1);
    recoveredKeyEl.textContent = current.join("");
  }

  leakCountEl.textContent = guesses;
  bruteforceCountEl.textContent = Math.pow(CHARSET.length, KEY_LENGTH);
  counterSection.classList.remove("hidden");
  attackRunning = false;
}

function resetAttack() {
  clearAttackBoxes();
  recoveredRow.classList.add("hidden");
  counterSection.classList.add("hidden");
  recoveredKeyEl.textContent = "";
  leakCountEl.textContent = "";
  bruteforceCountEl.textContent = "";
  setBar(attackBarCorrect, attackBarWrong, "");
  attackBarCorrect.style.flexGrow = "0";
  attackBarWrong.style.flexGrow = "0";
}

charBoxes.forEach(function (box, i) {
  box.addEventListener("input", function () {
    box.value = box.value.toLowerCase();
    if (box.value && i < charBoxes.length - 1) {
      charBoxes[i + 1].focus();
    }
  });
});

randomizeKeyBtn.addEventListener("click", function () {
  secretKey = generateKey();
  resetAttack();
  clearGuessBoxes();
  guessBarCorrect.style.flexGrow = "0";
  guessBarWrong.style.flexGrow = "0";
});

submitGuessBtn.addEventListener("click", function () {
  setBar(guessBarCorrect, guessBarWrong, readGuess());
});

attackStartBtn.addEventListener("click", runAttack);
attackResetBtn.addEventListener("click", resetAttack);

secretKey = generateKey();