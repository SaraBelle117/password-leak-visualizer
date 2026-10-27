const CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";
const KEY_LENGTH = 6;
const ATTACK_DELAY_MS = 150;
const BRUTE_DELAY_MS = 40;

let secretKey = "";

// ---------- shared helpers ----------

function generateKey() {
  let key = "";
  for (let i = 0; i < KEY_LENGTH; i++) {
    const idx = Math.floor(Math.random() * CHARSET.length);
    key += CHARSET[idx];
  }
  return key;
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

function readBoxes(boxes) {
  return boxes.map(function (box) {
    return box.value;
  }).join("");
}

function setBoxes(boxes, str) {
  for (let i = 0; i < boxes.length; i++) {
    boxes[i].value = str[i] || "";
  }
}

function clearBoxes(boxes) {
  for (let i = 0; i < boxes.length; i++) {
    boxes[i].value = "";
  }
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

function clearBar(correctEl, wrongEl) {
  correctEl.style.flexGrow = "0";
  wrongEl.style.flexGrow = "0";
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function show(el) {
  el.classList.remove("hidden");
}

function hide(el) {
  el.classList.add("hidden");
}

// ---------- attacker routines ----------

// Per-position sweep that exploits the mismatch leak.
// onProgress(pos, currentArray) fires after each position locks in.
// shouldStop() aborts the run and returns null.
async function sweepAttack(boxes, barCorrect, barWrong, onProgress, shouldStop) {
  let guesses = 0;
  const current = new Array(KEY_LENGTH).fill(CHARSET[0]);
  for (let pos = 0; pos < KEY_LENGTH; pos++) {
    let bestChar = CHARSET[0];
    let bestWrong = KEY_LENGTH;
    for (let c = 0; c < CHARSET.length; c++) {
      if (shouldStop()) {
        return null;
      }
      current[pos] = CHARSET[c];
      const trial = current.join("");
      const wrong = mismatchCount(trial);
      guesses++;
      setBoxes(boxes, trial);
      if (wrong < bestWrong) {
        bestWrong = wrong;
        bestChar = CHARSET[c];
      }
      await sleep(ATTACK_DELAY_MS);
    }
    current[pos] = bestChar;
    setBoxes(boxes, current.join(""));
    setBarByCorrect(barCorrect, barWrong, pos + 1);
    if (onProgress) {
      onProgress(pos, current);
    }
  }
  return { recovered: current.join(""), guesses: guesses };
}

// Blind brute force used when the leak is off.
// onGuess(count) fires each attempt. shouldStop() aborts and returns null.
async function bruteAttack(boxes, onGuess, shouldStop) {
  let guesses = 0;
  while (true) {
    if (shouldStop()) {
      return null;
    }
    const trial = generateKey();
    guesses++;
    setBoxes(boxes, trial);
    if (onGuess) {
      onGuess(guesses);
    }
    if (trial === secretKey) {
      return { recovered: trial, guesses: guesses };
    }
    await sleep(BRUTE_DELAY_MS);
  }
}

// ---------- navigation ----------

const landing = document.getElementById("landing");
const modeAttack = document.getElementById("mode-attack");
const modeVersus = document.getElementById("mode-versus");

document.getElementById("go-attack").addEventListener("click", function () {
  hide(landing);
  show(modeAttack);
  enterAttack();
});

document.getElementById("go-versus").addEventListener("click", function () {
  hide(landing);
  show(modeVersus);
  enterVersus();
});

document.getElementById("attack-back").addEventListener("click", function () {
  resetAttackOnly();
  hide(modeAttack);
  show(landing);
});

document.getElementById("versus-back").addEventListener("click", function () {
  resetVersus();
  hide(modeVersus);
  show(landing);
});

// ---------- attack-only mode ----------

const attackLeak = document.getElementById("attack-leak");
const attackBoxes = Array.from(document.querySelectorAll("#attack-boxes .charBox"));
const attackBarCorrect = document.querySelector("#attack-bar .bar-correct");
const attackBarWrong = document.querySelector("#attack-bar .bar-wrong");
const attackRecoveredRow = modeAttack.querySelector(".recoveredRow");
const attackCounter = document.getElementById("counter");
const recoveredKeyEl = document.getElementById("recovered-key");
const leakCountEl = document.getElementById("leak-count");
const bruteforceCountEl = document.getElementById("bruteforce-count");
const timeCountEl = document.getElementById("time-count");

let attackRunning = false;
let attackStop = false;

function enterAttack() {
  resetAttackOnly();
}

function resetAttackOnly() {
  secretKey = generateKey();
  attackStop = true;
  clearBoxes(attackBoxes);
  clearBar(attackBarCorrect, attackBarWrong);
  hide(attackRecoveredRow);
  hide(attackCounter);
  recoveredKeyEl.textContent = "";
  leakCountEl.textContent = "";
  bruteforceCountEl.textContent = "";
  timeCountEl.textContent = "";
}

async function runAttackOnly() {
  if (attackRunning) {
    return;
  }
  attackRunning = true;
  attackStop = false;
  const start = performance.now();
  show(attackRecoveredRow);
  recoveredKeyEl.textContent = "*".repeat(KEY_LENGTH);

  let result;
  if (attackLeak.checked) {
    result = await sweepAttack(attackBoxes, attackBarCorrect, attackBarWrong, function (pos, current) {
      recoveredKeyEl.textContent = current.slice(0, pos + 1).join("") + "*".repeat(KEY_LENGTH - pos - 1);
    }, function () {
      return attackStop;
    });
  } else {
    result = await bruteAttack(attackBoxes, function (count) {
      recoveredKeyEl.textContent = count + " blind guesses, still nothing";
    }, function () {
      return attackStop;
    });
  }

  if (result) {
    const end = performance.now();
    recoveredKeyEl.textContent = result.recovered;
    leakCountEl.textContent = result.guesses;
    bruteforceCountEl.textContent = Math.pow(CHARSET.length, KEY_LENGTH);
    timeCountEl.textContent = ((end - start) / 1000).toFixed(2);
    show(attackCounter);
  }
  attackRunning = false;
}

document.getElementById("attack-start").addEventListener("click", runAttackOnly);
document.getElementById("attack-reset").addEventListener("click", resetAttackOnly);

// ---------- versus mode ----------

const versusLeak = document.getElementById("versus-leak");
const yourBoxes = Array.from(document.querySelectorAll("#your-boxes .charBox"));
const yourBarCorrect = document.querySelector("#your-bar .bar-correct");
const yourBarWrong = document.querySelector("#your-bar .bar-wrong");
const vAttackBoxes = Array.from(document.querySelectorAll("#versus-attack-boxes .charBox"));
const vAttackBarCorrect = document.querySelector("#versus-attack-bar .bar-correct");
const vAttackBarWrong = document.querySelector("#versus-attack-bar .bar-wrong");
const winnerEl = document.getElementById("winner");

let versusRunning = false;
let versusStop = false;
let versusWinner = null;

function enterVersus() {
  resetVersus();
}

function resetVersus() {
  secretKey = generateKey();
  versusStop = true;
  versusRunning = false;
  versusWinner = null;
  clearBoxes(yourBoxes);
  clearBoxes(vAttackBoxes);
  clearBar(yourBarCorrect, yourBarWrong);
  clearBar(vAttackBarCorrect, vAttackBarWrong);
  hide(winnerEl);
  winnerEl.textContent = "";
}

function declareWinner(who, message) {
  if (versusWinner) {
    return;
  }
  versusWinner = who;
  versusRunning = false;
  winnerEl.textContent = message;
  show(winnerEl);
}

function startRace() {
  if (versusRunning) {
    return;
  }
  resetVersus();
  versusRunning = true;
  versusStop = false;
  versusWinner = null;

  const shouldStop = function () {
    return versusStop || versusWinner !== null;
  };

  let attacker;
  if (versusLeak.checked) {
    attacker = sweepAttack(vAttackBoxes, vAttackBarCorrect, vAttackBarWrong, null, shouldStop);
  } else {
    attacker = bruteAttack(vAttackBoxes, null, shouldStop);
  }

  attacker.then(function (result) {
    if (result) {
      declareWinner("attacker", "Attacker recovered the key first.");
    }
  });
}

document.getElementById("versus-start").addEventListener("click", startRace);
document.getElementById("versus-reset").addEventListener("click", resetVersus);

document.getElementById("your-submit").addEventListener("click", function () {
  if (!versusRunning || versusWinner) {
    return;
  }
  const guess = readBoxes(yourBoxes);
  setBar(yourBarCorrect, yourBarWrong, guess);
  if (mismatchCount(guess) === 0) {
    declareWinner("you", "You recovered the key first.");
  }
});

yourBoxes.forEach(function (box, i) {
  box.addEventListener("input", function () {
    box.value = box.value.toLowerCase();
    if (box.value && i < yourBoxes.length - 1) {
      yourBoxes[i + 1].focus();
    }
  });
});

secretKey = generateKey();