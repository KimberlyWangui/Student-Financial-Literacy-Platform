// Wakes the free simulator service in the background. Does nothing if the address is not set.
export const wakeSimulator = () => {
  const url = import.meta.env.VITE_SIMULATOR_HEALTH_URL;
  if (!url) return;
  fetch(url, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
};