const STORAGE_KEY = 'nsoc26:pomodoro-timer:v1';
const ORIGINAL_TITLE = document.title;
const PHASES = {
  work: { label: 'Work Session', next: 'shortBreak', tone: 660 },
  shortBreak: { label: 'Short Break', next: 'work', tone: 440 },
  longBreak: { label: 'Long Break', next: 'work', tone: 330 },
};
const DEFAULT_SETTINGS = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakEvery: 4,
};

const elements = {
  phaseLabel: document.querySelector('#phaseLabel'),
  statusBadge: document.querySelector('#statusBadge'),
  timeDisplay: document.querySelector('#timeDisplay'),
  targetTime: document.querySelector('#targetTime'),
  progressBar: document.querySelector('#progressBar'),
  startPauseBtn: document.querySelector('#startPauseBtn'),
  resetBtn: document.querySelector('#resetBtn'),
  skipBtn: document.querySelector('#skipBtn'),
  phaseTabs: document.querySelectorAll('.phase-tab'),
  timerCard: document.querySelector('.timer-card'),
  inputs: {
    work: document.querySelector('#workInput'),
    shortBreak: document.querySelector('#shortInput'),
    longBreak: document.querySelector('#longInput'),
    longBreakEvery: document.querySelector('#cycleInput'),
  },
};

let worker;
let audioContext;
const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
let state = {
  phase: 'work',
  status: 'idle',
  targetTimestamp: null,
  startedAt: null,
  durationMs: DEFAULT_SETTINGS.work * 60 * 1000,
  completedWorkSessions: 0,
  settings: { ...DEFAULT_SETTINGS },
};

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const getPhaseDuration = (phase = state.phase) => state.settings[phase] * 60 * 1000;

const formatTime = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const persistState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const calculateRemainingMs = (now = Date.now()) => {
  if (state.status !== 'running' || !state.targetTimestamp) {
    return state.durationMs;
  }
  return Math.max(0, state.targetTimestamp - now);
};

const setDocumentTitle = (remainingMs = calculateRemainingMs()) => {
  document.title = state.status === 'running'
    ? `${formatTime(remainingMs)} · ${PHASES[state.phase].label}`
    : ORIGINAL_TITLE;
};

const updatePhaseTabs = () => {
  elements.phaseTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.phase === state.phase);
  });
};

const render = (now = Date.now()) => {
  const remainingMs = calculateRemainingMs(now);
  const elapsed = state.durationMs - remainingMs;
  const progress = state.durationMs > 0 ? Math.min(100, Math.max(0, (elapsed / state.durationMs) * 100)) : 0;

  elements.phaseLabel.textContent = PHASES[state.phase].label;
  elements.statusBadge.textContent = state.status === 'running' ? 'Running' : state.status === 'paused' ? 'Paused' : 'Ready';
  elements.timeDisplay.textContent = formatTime(remainingMs);
  elements.progressBar.style.width = `${progress}%`;
  elements.startPauseBtn.textContent = state.status === 'running' ? 'Pause' : 'Start';
  elements.timerCard.dataset.status = state.status;

  if (state.status === 'running' && state.targetTimestamp) {
    elements.targetTime.textContent = `Target expiry: ${new Date(state.targetTimestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  } else {
    elements.targetTime.textContent = 'State is saved locally and restored after refresh.';
  }

  updatePhaseTabs();
  setDocumentTitle(remainingMs);
};

const saveSettingsFromInputs = () => {
  state.settings = {
    work: clampNumber(elements.inputs.work.value, DEFAULT_SETTINGS.work, 1, 180),
    shortBreak: clampNumber(elements.inputs.shortBreak.value, DEFAULT_SETTINGS.shortBreak, 1, 60),
    longBreak: clampNumber(elements.inputs.longBreak.value, DEFAULT_SETTINGS.longBreak, 1, 90),
    longBreakEvery: clampNumber(elements.inputs.longBreakEvery.value, DEFAULT_SETTINGS.longBreakEvery, 2, 12),
  };

  Object.entries(state.settings).forEach(([key, value]) => {
    elements.inputs[key].value = value;
  });

  if (state.status !== 'running') {
    state.durationMs = getPhaseDuration();
  }

  persistState();
  render();
};

const playPhaseAlert = () => {
  if (!AudioContextConstructor) {
    return;
  }

  audioContext = audioContext || new AudioContextConstructor();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(PHASES[state.phase].tone, audioContext.currentTime);
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, audioContext.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.45);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.5);
};

const notifyPhaseChange = () => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`${PHASES[state.phase].label} started`, {
      body: `Next countdown: ${formatTime(state.durationMs)}`,
    });
  }
  playPhaseAlert();
};

const chooseNextPhase = () => {
  if (state.phase !== 'work') {
    return 'work';
  }

  const nextWorkCount = state.completedWorkSessions + 1;
  return nextWorkCount % state.settings.longBreakEvery === 0 ? 'longBreak' : 'shortBreak';
};

const switchPhase = (phase, shouldAutostart = true) => {
  if (state.phase === 'work') {
    state.completedWorkSessions += 1;
  }

  state.phase = phase;
  state.durationMs = getPhaseDuration(phase);
  state.startedAt = shouldAutostart ? Date.now() : null;
  state.targetTimestamp = shouldAutostart ? state.startedAt + state.durationMs : null;
  state.status = shouldAutostart ? 'running' : 'idle';
  persistState();
  render();
  notifyPhaseChange();

  if (shouldAutostart) {
    startWorker();
  }
};

const completeCurrentPhase = () => {
  switchPhase(chooseNextPhase(), true);
};

const startWorker = () => {
  if (worker) {
    worker.postMessage({ type: 'start' });
  }
};

const stopWorker = () => {
  if (worker) {
    worker.postMessage({ type: 'stop' });
  }
};

const startTimer = () => {
  const now = Date.now();
  const remaining = state.status === 'paused' ? state.durationMs : getPhaseDuration();

  state.status = 'running';
  state.startedAt = now;
  state.durationMs = remaining;
  state.targetTimestamp = now + remaining;
  persistState();
  render(now);
  startWorker();
};

const pauseTimer = () => {
  state.durationMs = calculateRemainingMs();
  state.targetTimestamp = null;
  state.startedAt = null;
  state.status = 'paused';
  persistState();
  render();
  stopWorker();
};

const resetTimer = () => {
  state.status = 'idle';
  state.targetTimestamp = null;
  state.startedAt = null;
  state.durationMs = getPhaseDuration();
  persistState();
  render();
  stopWorker();
};

const selectPhase = (phase) => {
  state.phase = phase;
  state.status = 'idle';
  state.targetTimestamp = null;
  state.startedAt = null;
  state.durationMs = getPhaseDuration(phase);
  persistState();
  render();
  stopWorker();
};

const primeAudioContext = () => {
  if (!AudioContextConstructor) {
    return;
  }

  audioContext = audioContext || new AudioContextConstructor();
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
};

const requestNotificationPermission = () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

const hydrateState = () => {
  const rawState = localStorage.getItem(STORAGE_KEY);
  if (!rawState) {
    return;
  }

  try {
    const saved = JSON.parse(rawState);
    state = {
      ...state,
      ...saved,
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    };

    if (!PHASES[state.phase]) {
      state.phase = 'work';
    }

    Object.entries(state.settings).forEach(([key, value]) => {
      elements.inputs[key].value = value;
    });

    if (state.status === 'running' && state.targetTimestamp && Date.now() >= state.targetTimestamp) {
      completeCurrentPhase();
      return;
    }

    if (state.status === 'running') {
      startWorker();
    }
  } catch (error) {
    console.warn('Unable to hydrate pomodoro timer state.', error);
    localStorage.removeItem(STORAGE_KEY);
  }
};

const setupWorker = () => {
  if (!window.Worker) {
    window.setInterval(() => {
      if (state.status === 'running') {
        render();
        if (calculateRemainingMs() <= 0) {
          completeCurrentPhase();
        }
      }
    }, 1000);
    return;
  }

  worker = new Worker('worker.js');
  worker.addEventListener('message', (event) => {
    if (event.data?.type !== 'tick' || state.status !== 'running') {
      return;
    }

    render(event.data.now);
    if (calculateRemainingMs(event.data.now) <= 0) {
      completeCurrentPhase();
    }
  });
};

elements.startPauseBtn.addEventListener('click', () => {
  requestNotificationPermission();
  primeAudioContext();
  if (state.status === 'running') {
    pauseTimer();
  } else {
    startTimer();
  }
});

elements.resetBtn.addEventListener('click', resetTimer);
elements.skipBtn.addEventListener('click', completeCurrentPhase);
elements.phaseTabs.forEach((tab) => {
  tab.addEventListener('click', () => selectPhase(tab.dataset.phase));
});
Object.values(elements.inputs).forEach((input) => input.addEventListener('change', saveSettingsFromInputs));
window.addEventListener('beforeunload', persistState);
document.addEventListener('visibilitychange', () => render());

setupWorker();
hydrateState();
render();
