import assert from 'node:assert/strict';
import {
  chooseChunkSize,
  getChunkRange,
  parseDriveUploadedBytes,
} from '../services/resumableUploadUtils.js';

assert.equal(chooseChunkSize(10 * 1024 ** 3), 64 * 1024 ** 2);
assert.equal(chooseChunkSize(50 * 1024 ** 2), 8 * 1024 ** 2);

assert.deepEqual(getChunkRange(0, 10, 4), { start: 0, end: 3 });
assert.deepEqual(getChunkRange(4, 10, 4), { start: 4, end: 7 });
assert.deepEqual(getChunkRange(8, 10, 4), { start: 8, end: 9 });

assert.equal(parseDriveUploadedBytes(null), 0);
assert.equal(parseDriveUploadedBytes('bytes=0-0'), 1);
assert.equal(parseDriveUploadedBytes('bytes=0-67108863'), 67108864);
assert.equal(parseDriveUploadedBytes('bytes=1048576-2097151'), 2097152);

console.log('drive resumable upload utils ok');
