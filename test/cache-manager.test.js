const { describe, it, beforeEach, after } = require('node:test');
const assert = require('assert');
const fs = require('fs/promises');
const store = require('../index.js');
const cacheManagerV7 = require('cache-manager-v7');
const cacheManagerV5 = require('cache-manager-v5');
const cacheManagerV4 = require('cache-manager-v4');
const countFiles = require('./utils/count-files');
const cacheDirectory = __dirname + '/cache-manager';


describe('cache-manager with DiskStore', { timeout: 10000 }, function () {

    // remove test directory before each test
    beforeEach(async function () {
        await fs.rm(cacheDirectory, { recursive: true, force: true });
    });
    // remove test directory after last test
    after(async function () {
       await fs.rm(cacheDirectory, { recursive: true, force: true });
    });

    describe('cache-manager-v4', function () {

        it('should work with caching()', async function () {
            const cache = cacheManagerV4.caching(new store.DiskStore({ path: cacheDirectory }));
            await testBasicCacheManagerObjectFunctionality(cache);
        });

        it('should work with old example code', async function () {
            const cache = cacheManagerV4.caching({
                store: store,
                options: {
                    path: cacheDirectory
                }
            });
            await testBasicCacheManagerObjectFunctionality(cache);
        });
    });

    describe('cache-manager-v5', function () {

        it('should work with createCache()', async function () {
            const cache = cacheManagerV5.createCache(new store.DiskStore({ path: cacheDirectory }));
            await testBasicCacheManagerObjectFunctionality(cache);
        });

        it('should work with caching()', async function () {
            const cache = await cacheManagerV5.caching(new store.DiskStore({ path: cacheDirectory }));
            await testBasicCacheManagerObjectFunctionality(cache);
        });
    });

    describe('cache-manager-v7', function () {

        it('should work with createCache()', async function () {
            const cache = cacheManagerV7.createCache(new store.DiskStore({ path: cacheDirectory }));
            await testV7CacheManagerObjectFunctunality(cache);
        });

        it('should work with createCache({stores: []})', async function () {
            const cache = cacheManagerV7.createCache({
                stores: [new store.DiskStore({ path: cacheDirectory })]
            });
            await testV7CacheManagerObjectFunctunality(cache);
        });


    });

});

async function testV7CacheManagerObjectFunctunality(cache) {
    await testBasicCacheManagerObjectFunctionality(cache);
    await cache.clear();
}

async function testBasicCacheManagerObjectFunctionality(cache) {
    await fs.access(cacheDirectory);

    await cache.set('key', 'value');
    assert.strictEqual(await countFiles(cacheDirectory), 1, "Es sollte genau 1 Datei im cahce ordner angelegt werden");
    assert.strictEqual(await cache.get('key'), 'value');
    await cache.del('key');
    assert.strictEqual(await countFiles(cacheDirectory), 0);
    assert.strictEqual(await cache.get('key'), undefined);

    await cache.set('key2', 'value2', 0); //ttl of 0
    assert.strictEqual(await cache.get('key2'), undefined);

    assert.strictEqual(await cache.wrap('key3', () => 'value3'), 'value3');
    assert.strictEqual(await cache.get('key3'), 'value3');

    assert.strictEqual(await cache.wrap('key4', async () => 'value4'), 'value4');
    assert.strictEqual(await cache.get('key4'), 'value4');
}