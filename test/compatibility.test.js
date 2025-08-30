const { describe, it, beforeEach, after } = require('node:test');
const assert = require('assert');
const fs = require('fs/promises');
const store = require('../index.js');
const storeV2 = require('cache-manager-fs-hash-v2');
const cacheDirectory = __dirname + '/cache-compability';




describe('DiskStore Compatibility', { timeout: 10000 }, function () {

    /**
     * @type {DiskStore}
     */
    let cache;
    // remove test directory before each test
    beforeEach(async function () {
        await fs.rm(cacheDirectory, { recursive: true, force: true });
        cache = store.create({ path: cacheDirectory });
    });
    // remove test directory after last test
    after(async function () {
        await fs.rm(cacheDirectory, { recursive: true, force: true });
    });

    it('should read cache files from version ^2.0.0 of node-cache-manager', async () => {
        cacheV2 = storeV2.create({ path: cacheDirectory });
        const originalValue = {
            smallBuffer: Buffer.from('Hello World!'),
            largeBuffer: Buffer.alloc(1000 * 1000 * 10 /* 10MB */, 5),
            largeBuffer2: Buffer.alloc(1000 * 1000 * 5 /* 5MB */, 100),
            inifity: Infinity,
        };
        await cacheV2.set('testvalue', originalValue);
        const loadedValue = await cache.get('testvalue');
        assert.deepStrictEqual(originalValue, loadedValue);
    });
});