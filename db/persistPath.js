/** Platform-agnostic persistent volume path (Northflank / Railway / manual). */
function getPersistentDataPath() {
  const path = process.env.PERSISTENT_DATA_PATH || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  return path ? String(path).trim() : null;
}

module.exports = { getPersistentDataPath };
