export const DRIVE_MIN_CHUNK_SIZE = 256 * 1024;
export const SMALL_FILE_CHUNK_SIZE = 8 * 1024 * 1024;
export const LARGE_FILE_CHUNK_SIZE = 64 * 1024 * 1024;
export const LARGE_FILE_THRESHOLD = 1024 * 1024 * 1024;

export const chooseChunkSize = (fileSize) => {
  if (fileSize >= LARGE_FILE_THRESHOLD) return LARGE_FILE_CHUNK_SIZE;
  return SMALL_FILE_CHUNK_SIZE;
};

export const getChunkRange = (offset, fileSize, chunkSize) => {
  const start = Math.max(0, offset);
  const end = Math.min(fileSize - 1, start + chunkSize - 1);
  return { start, end };
};

export const parseDriveUploadedBytes = (rangeHeader) => {
  if (!rangeHeader) return 0;
  const match = String(rangeHeader).match(/bytes=(\d+)-(\d+)/i);
  if (!match) return 0;
  return Number(match[2]) + 1;
};
