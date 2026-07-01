/**
 * Oyuncu verisi — volume snapshot + periyodik tam yedek (deploy güvenli).
 */
const _userTimers = new Map();
let _fullTimer = null;

function schedulePlayerSnapshotPersist(db, userId, delayMs = 20000) {
  if (!userId) return;
  const prev = _userTimers.get(userId);
  if (prev) clearTimeout(prev);
  _userTimers.set(
    userId,
    setTimeout(() => {
      _userTimers.delete(userId);
      const { updatePlayerSeedSnapshot } = require("./oyuncuRestoreService");
      updatePlayerSeedSnapshot(db, userId).catch((err) => {
        console.warn("[persist] Oyuncu snapshot atlandi:", err.message);
      });
      scheduleFullGamePersist(db, 90000);
    }, delayMs)
  );
}

function scheduleFullGamePersist(db, delayMs = 5 * 60 * 1000) {
  if (_fullTimer) clearTimeout(_fullTimer);
  _fullTimer = setTimeout(() => {
    _fullTimer = null;
    const { persistLiveGameState } = require("./veriKorumaService");
    persistLiveGameState(db).catch((err) => {
      console.warn("[persist] Tam yedek atlandi:", err.message);
    });
  }, delayMs);
}

function flushPlayerSnapshotPersist(db, userId) {
  const prev = _userTimers.get(userId);
  if (prev) clearTimeout(prev);
  _userTimers.delete(userId);
  const { updatePlayerSeedSnapshot } = require("./oyuncuRestoreService");
  return updatePlayerSeedSnapshot(db, userId);
}

module.exports = {
  schedulePlayerSnapshotPersist,
  scheduleFullGamePersist,
  flushPlayerSnapshotPersist,
};
