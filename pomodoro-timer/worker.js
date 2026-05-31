let intervalId = null;

const stopTicker = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const emitTick = () => {
  self.postMessage({ type: 'tick', now: Date.now() });
};

self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  if (type === 'start') {
    stopTicker();
    emitTick();
    intervalId = setInterval(emitTick, 1000);
  }

  if (type === 'stop') {
    stopTicker();
  }
});
