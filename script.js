let CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";
const KEY_LENGTH = 6;
const ATTACK_DELAY_MS = 150;
const BRUTE_DELAY_MS = 40;

const CHAR_CLASSES = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  digit: "0123456789",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  symbol: "!@#$%^&*"
};

let secretKey = "";

// ---------- write-up copy ----------

function bruteTotal() {
  return Math.pow(CHARSET.length, KEY_LENGTH);
}

function noLeakText() {
  return "No leak to exploit, so the attacker is stuck brute-forcing all " + bruteTotal().toLocaleString() + " possibilities.";
}

function attackLeakText(guesses) {
  return "This is a timing attack, a kind of side-channel attack. Because the checker leaked how many characters were wrong, the attacker never had to guess the whole key at once; it solved one position at a time. That took " + guesses + " guesses. Brute force would need " + bruteTotal().toLocaleString() + " guesses. Turn the leak off and the same attack collapses into blind brute force.";
}

function versusLeakText(guesses) {
  return "You only ever saw how many characters were right, not which ones. The attacker exploited that same leak, a timing side-channel, to recover one position at a time. It needed " + guesses + " guesses against " + bruteTotal().toLocaleString() + " for brute force, which is why trial-and-error can't keep pace.";
}

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
async function waitWhilePaused(isPaused, shouldStop) {
  while (isPaused && isPaused() && !shouldStop()) {
    await sleep(60);
  }
}

async function sweepAttack(boxes, barCorrect, barWrong, onProgress, shouldStop, onGuess, isPaused) {
  let guesses = 0;
  const current = new Array(KEY_LENGTH).fill(CHARSET[0]);
  for (let pos = 0; pos < KEY_LENGTH; pos++) {
    // The correct char is the one that lowers the leaked mismatch count
    let correctC = 0;
    let bestWrong = KEY_LENGTH + 1;
    for (let c = 0; c < CHARSET.length; c++) {
      current[pos] = CHARSET[c];
      const wrong = mismatchCount(current.join(""));
      if (wrong < bestWrong) {
        bestWrong = wrong;
        correctC = c;
      }
    }
    // Cycle through letters and stop the moment the leak says this one is right
    for (let c = 0; c <= correctC; c++) {
      await waitWhilePaused(isPaused, shouldStop);
      if (shouldStop()) {
        return null;
      }
      current[pos] = CHARSET[c];
      guesses++;
      if (onGuess) {
        onGuess(guesses);
      }
      setBoxes(boxes, current.slice(0, pos + 1).join(""));
      await sleep(ATTACK_DELAY_MS);
    }
    current[pos] = CHARSET[correctC];
    setBarByCorrect(barCorrect, barWrong, pos + 1);
    if (onProgress) {
      onProgress(pos, current);
    }
  }
  return { recovered: current.join(""), guesses: guesses };
}

// Blind brute force used when the leak is off.
// onGuess(count) fires each attempt. shouldStop() aborts and returns null.
async function bruteAttack(boxes, onGuess, shouldStop, isPaused) {
  let guesses = 0;
  while (true) {
    await waitWhilePaused(isPaused, shouldStop);
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
const attackWriteup = document.getElementById("attack-writeup");
const attackStartBtn = document.getElementById("attack-start");

let attackRunning = false;
let attackStop = false;
let attackPaused = false;

function setAttackBtn() {
  if (!attackRunning) {
    attackStartBtn.textContent = "▶ Run attack";
    attackStartBtn.classList.remove("attackBtn");
  } else if (attackPaused) {
    attackStartBtn.textContent = "▶ Resume attack";
    attackStartBtn.classList.remove("attackBtn");
  } else {
    attackStartBtn.textContent = "⏸ Pause attack";
    attackStartBtn.classList.add("attackBtn");
  }
}

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
  hide(attackWriteup);
  attackWriteup.textContent = "";
  attackPaused = false;
  attackStartBtn.textContent = "▶ Run attack";
  attackStartBtn.classList.remove("attackBtn");
  setClassBoxesDisabled(false);
}

async function runAttackOnly() {
  if (attackRunning) {
    return;
  }
  attackRunning = true;
  attackStop = false;
  attackPaused = false;
  attackStartBtn.classList.add("attackBtn");
  setAttackBtn();
  setClassBoxesDisabled(true);
  const start = performance.now();
  show(attackRecoveredRow);
  recoveredKeyEl.textContent = "*".repeat(KEY_LENGTH);

  const attackIsPaused = function () {
    return attackPaused;
  };

  let result;
  if (attackLeak.checked) {
    result = await sweepAttack(attackBoxes, attackBarCorrect, attackBarWrong, function (pos, current) {
      recoveredKeyEl.textContent = current.slice(0, pos + 1).join("") + "*".repeat(KEY_LENGTH - pos - 1);
    }, function () {
      return attackStop;
    }, null, attackIsPaused);
  } else {
    attackWriteup.textContent = noLeakText();
    show(attackWriteup);
    result = await bruteAttack(attackBoxes, function (count) {
      recoveredKeyEl.textContent = count + " blind guesses, still nothing";
    }, function () {
      return attackStop;
    }, attackIsPaused);
  }

  if (result) {
    const end = performance.now();
    recoveredKeyEl.textContent = result.recovered;
    leakCountEl.textContent = result.guesses;
    bruteforceCountEl.textContent = bruteTotal().toLocaleString();
    timeCountEl.textContent = ((end - start) / 1000).toFixed(2);
    show(attackCounter);
    attackWriteup.textContent = attackLeakText(result.guesses);
    show(attackWriteup);
  }
  attackRunning = false;
  attackPaused = false;
  setAttackBtn();
  setClassBoxesDisabled(false);
}

attackStartBtn.addEventListener("click", function () {
  if (!attackRunning) {
    runAttackOnly();
  } else {
    attackPaused = !attackPaused;
    setAttackBtn();
  }
});
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
const yourSubmitBtn = document.getElementById("your-submit");
const versusRecoveredRow = modeVersus.querySelector(".recoveredRow");
const versusRecoveredKeyEl = document.getElementById("versus-recovered-key");
const versusCounter = document.getElementById("versus-counter");
const versusLeakCountEl = document.getElementById("versus-leak-count");
const versusBruteforceCountEl = document.getElementById("versus-bruteforce-count");
const versusTimeCountEl = document.getElementById("versus-time-count");
const guessTally = document.getElementById("guess-tally");
const yourGuessCountEl = document.getElementById("your-guess-count");
const attackerGuessCountEl = document.getElementById("attacker-guess-count");
const versusWriteup = document.getElementById("versus-writeup");

const versusStartBtn = document.getElementById("versus-start");

let versusRunning = false;
let versusStop = false;
let versusWinner = null;
let versusGuesses = 0;
let versusRaceStart = 0;
let yourGuesses = 0;
let versusPaused = false;

function setVersusBtn() {
  if (!versusRunning) {
    versusStartBtn.textContent = "▶ Start race";
    versusStartBtn.classList.remove("attackBtn");
  } else if (versusPaused) {
    versusStartBtn.textContent = "▶ Resume race";
    versusStartBtn.classList.remove("attackBtn");
  } else {
    versusStartBtn.textContent = "⏸ Pause race";
    versusStartBtn.classList.add("attackBtn");
  }
}

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
  hide(versusCounter);
  versusLeakCountEl.textContent = "";
  versusBruteforceCountEl.textContent = "";
  versusTimeCountEl.textContent = "";
  hide(versusRecoveredRow);
  versusRecoveredKeyEl.textContent = "";
  show(yourSubmitBtn);
  hide(guessTally);
  yourGuesses = 0;
  yourGuessCountEl.textContent = "0";
  attackerGuessCountEl.textContent = "0";
  hide(versusWriteup);
  versusWriteup.textContent = "";
  versusPaused = false;
  versusStartBtn.textContent = "▶ Start race";
  versusStartBtn.classList.remove("attackBtn");
  setClassBoxesDisabled(false);
}

function declareWinner(who, message) {
  if (versusWinner) {
    return;
  }
  versusWinner = who;
  versusRunning = false;
  versusPaused = false;
  setVersusBtn();
  setClassBoxesDisabled(false);
  hide(yourSubmitBtn);
  winnerEl.textContent = message;
  show(winnerEl);
  versusLeakCountEl.textContent = versusGuesses;
  versusBruteforceCountEl.textContent = bruteTotal().toLocaleString();
  versusTimeCountEl.textContent = ((performance.now() - versusRaceStart) / 1000).toFixed(2);
  show(versusCounter);
  versusWriteup.textContent = versusLeak.checked ? versusLeakText(versusGuesses) : noLeakText();
  show(versusWriteup);
}

function startRace() {
  if (versusRunning) {
    return;
  }
  resetVersus();
  versusRunning = true;
  versusStop = false;
  versusWinner = null;
  versusGuesses = 0;
  versusPaused = false;
  versusRaceStart = performance.now();
  versusStartBtn.classList.add("attackBtn");
  setVersusBtn();
  setClassBoxesDisabled(true);

  const shouldStop = function () {
    return versusStop || versusWinner !== null;
  };

  const versusIsPaused = function () {
    return versusPaused;
  };

  show(guessTally);

  const onGuess = function (count) {
    versusGuesses = count;
    attackerGuessCountEl.textContent = count;
  };

  let attacker;
  if (versusLeak.checked) {
    show(versusRecoveredRow);
    versusRecoveredKeyEl.textContent = "*".repeat(KEY_LENGTH);
    attacker = sweepAttack(vAttackBoxes, vAttackBarCorrect, vAttackBarWrong, function (pos, current) {
      versusRecoveredKeyEl.textContent = current.slice(0, pos + 1).join("") + "*".repeat(KEY_LENGTH - pos - 1);
    }, shouldStop, onGuess, versusIsPaused);
  } else {
    attacker = bruteAttack(vAttackBoxes, onGuess, shouldStop, versusIsPaused);
  }

  attacker.then(function (result) {
    if (result) {
      declareWinner("attacker", "Attacker recovered the key first.");
    }
  });
}

versusStartBtn.addEventListener("click", function () {
  if (!versusRunning) {
    startRace();
  } else {
    versusPaused = !versusPaused;
    setVersusBtn();
  }
});
document.getElementById("versus-reset").addEventListener("click", resetVersus);

document.getElementById("your-submit").addEventListener("click", function () {
  if (!versusRunning || versusWinner || versusPaused) {
    return;
  }
  const guess = readBoxes(yourBoxes);
  yourGuesses++;
  yourGuessCountEl.textContent = yourGuesses;
  setBar(yourBarCorrect, yourBarWrong, guess);
  if (mismatchCount(guess) === 0) {
    declareWinner("you", "You recovered the key first.");
  }
});

yourBoxes.forEach(function (box, i) {
  box.addEventListener("focus", function () {
    box.select();
  });
  box.addEventListener("input", function () {
    let ch = box.value.slice(-1);
    if (ch) {
      if (CHARSET.indexOf(ch) === -1 && CHARSET.indexOf(ch.toLowerCase()) !== -1) {
        ch = ch.toLowerCase();
      }
      box.value = CHARSET.indexOf(ch) !== -1 ? ch : "";
    }
    if (box.value && i < yourBoxes.length - 1) {
      yourBoxes[i + 1].focus();
    }
  });
  box.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" && i < yourBoxes.length - 1) {
      e.preventDefault();
      yourBoxes[i + 1].focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      yourBoxes[i - 1].focus();
    } else if (e.key === "Enter") {
      document.getElementById("your-submit").click();
    }
  });
});

// ---------- alphabet class selection ----------

const classBoxes = Array.from(document.querySelectorAll(".class-box"));

function syncClassBox(cls, checked) {
  classBoxes.forEach(function (box) {
    if (box.dataset.class === cls) {
      box.checked = checked;
    }
  });
}

function rebuildCharset() {
  let set = "";
  ["lower", "digit", "upper", "symbol"].forEach(function (cls) {
    const box = classBoxes.find(function (b) {
      return b.dataset.class === cls;
    });
    if (box && box.checked) {
      set += CHAR_CLASSES[cls];
    }
  });
  if (set === "") {
    syncClassBox("lower", true);
    set = CHAR_CLASSES.lower;
  }
  CHARSET = set;
}

function setClassBoxesDisabled(disabled) {
  classBoxes.forEach(function (box) {
    box.disabled = disabled;
  });
}

function resetCurrentMode() {
  if (!modeAttack.classList.contains("hidden")) {
    resetAttackOnly();
  } else if (!modeVersus.classList.contains("hidden")) {
    resetVersus();
  }
}

classBoxes.forEach(function (box) {
  box.addEventListener("change", function () {
    syncClassBox(box.dataset.class, box.checked);
    rebuildCharset();
    resetCurrentMode();
  });
});

rebuildCharset();
secretKey = generateKey();