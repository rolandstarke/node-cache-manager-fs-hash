const { describe, it, beforeEach, after } = require('node:test');
const assert = require('assert');
const fs = require('fs/promises');
const store = require('../index.js');
const countFiles = require('./utils/count-files');
const cacheDirectory = __dirname + '/cache';




describe('DiskStore', { timeout: 10000 }, function () {

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


    describe('construction', function () {
        it('should create cache dir', async function () {
            await fs.access(cacheDirectory);
        });
    });


    describe('get()', function () {

        it('should return undefined on non existing key promise', async function () {
            const data = await cache.get('not existing key');
            assert.strictEqual(undefined, data);
        });

        it('should not be that slow reading the same non existing cache key sequentially', { timeout: 30 }, async function () {
            for (let i = 0; i < 30; i++) {
                const data = await cache.get('not existing key');
                assert.strictEqual(undefined, data);
            }
        });

        it('should not be that slow reading the same non existing cache key parallel', { timeout: 100 }, async function () {
            for (let i = 0; i < 20; i++) {
                await Promise.all([1, 2, 3, 4, 5].map(async function () {
                    const data = await cache.get('not existing key');
                    assert.strictEqual(undefined, data);
                }));
            }
        });

        it('should not be that slow reading different non existing cache keys parallel', { timeout: 30 }, async function () {
            await Promise.all(Array.apply(null, Array(30)).map(async function (v, i) {
                const data = await cache.get('not existing key' + i);
                assert.strictEqual(undefined, data);
            }));
        });

    });

    describe('set()', function () {

        it('should create a file for each saved value', async function () {
            await cache.set('key', 'value');
            assert.strictEqual(1, await countFiles(cacheDirectory));
            await cache.set('key2', 'value');
            assert.strictEqual(2, await countFiles(cacheDirectory));
        });

        it('should save big buffers in separate files promise', async function () {
            await cache.set('key', Buffer.alloc(100000));
            assert.strictEqual(2, await countFiles(cacheDirectory));
        });

        it('should not modify the value while saving', async function () {
            const value = {
                int: 5,
                bool: true,
                float: 0.1,
                buffer: Buffer.from('Hello World!'),
                string: '#äö=)@€²(/&%$§"',
                largeBuffer: Buffer.alloc(100000)
            };
            await cache.set('key', value);
            assert.deepStrictEqual({
                int: 5,
                bool: true,
                float: 0.1,
                buffer: Buffer.from('Hello World!'),
                string: '#äö=)@€²(/&%$§"',
                largeBuffer: Buffer.alloc(100000)
            }, value);
        });

    });

    describe('del()', function () {

        it('should not do anything deleting nonexistent key', async function () {
            const cache = store.create({ path: cacheDirectory, subdirs: false });
            await cache.del('nonexistent key');
        });

        it('should not do anything deleting nonexistent key (subdirs)', async function () {
            const cache = store.create({ path: cacheDirectory, subdirs: true });
            await cache.del('nonexistent key');
        });

    });

    describe('set() and get()', function () {

        it('should load the same value that was saved (simple object)', async function () {
            const originalValue = { int: 5, bool: true, float: 0.1, string: '#äö=)@€²(/&%$§"' };
            await cache.set('(simple object)', originalValue);
            const loadedValue = await cache.get('(simple object)');
            assert.deepStrictEqual(originalValue, loadedValue);
        });

        it('should load the same value that was saved (large buffers)', async function () {
            const originalValue = {
                smallBuffer: Buffer.from('Hello World!'),
                largeBuffer: Buffer.alloc(1000 * 1000 * 10 /* 10MB */, 5),
                largeBuffer2: Buffer.alloc(1000 * 1000 * 5 /* 5MB */, 100)
            };
            await cache.set('(large buffers)', originalValue);
            const loadedValue = await cache.get('(large buffers)');
            assert.deepEqual(originalValue, loadedValue);
        });

        it('should not load expired data (global options)', async function () {
            const cache = store.create({ path: cacheDirectory, ttl: 0 });
            await cache.set('key', 'value');
            const loadedValue = await cache.get('key');
            assert.strictEqual(undefined, loadedValue);
        });

        it('should not load expired data (set options)', async function () {
            const ttl = 0
            await cache.set('key', 'value', ttl);
            const loadedValue = await cache.get('key');
            assert.strictEqual(undefined, loadedValue);
        });

        it('should work with numeric keys', async function () {
            const originalValue = 'value';
            await cache.set(5, originalValue);
            const loadedValue = await cache.get(5);
            assert.strictEqual(originalValue, loadedValue);
        });

        it('should work with numeric keys (hash: false)', async function () {
            const cache = store.create({ path: cacheDirectory, hash: false });
            const originalValue = 'value';
            await cache.set(5, originalValue);
            const loadedValue = await cache.get(5);
            assert.strictEqual(originalValue, loadedValue);
        });

        it('should work with numeric and string keys mixed', async function () {
            const originalValue = 'value';
            await cache.set(5, originalValue);
            const loadedValue = await cache.get('5');
            assert.strictEqual(originalValue, loadedValue);
        });

        it('should be able to get a value written by an other cache instance using the same directory', async function () {
            const originalValue = 'value';
            const cache1 = store.create({ path: cacheDirectory });
            const cache2 = store.create({ path: cacheDirectory });

            await cache1.set('key', originalValue);
            const loadedValue = await cache2.get('key');
            assert.strictEqual(loadedValue, originalValue);
        });

        it('should work with subdirs', async function () {
            const cache = store.create({ path: cacheDirectory, subdirs: true });
            const originalValue = { int: 8, bool: true, float: 0.9, string: 'hi ö' };
            await cache.set('(simple object)', originalValue);
            const loadedValue = await cache.get('(simple object)');
            assert.deepStrictEqual(originalValue, loadedValue);
        });

        it('should be able to set & get a value on different instances simultaneously', async function () {
            const cache1 = store.create({ path: cacheDirectory });
            const cache2 = store.create({ path: cacheDirectory });
            const cache3 = store.create({ path: cacheDirectory });

            const value1 = {
                int: 5,
                bool: true,
                float: Math.random(),
                buffer: Buffer.from('Hello World1!'),
                string: '#äö=)@€²(/&%$§"1',
                largeBuffer: Buffer.alloc(1)
            };
            const value2 = {
                int: 6,
                bool: true,
                float: Math.random(),
                buffer: Buffer.from('Hello World2!'),
                string: '#äö=)@€²(/&%$§"2',
                largeBuffer: Buffer.alloc(2)
            };
            const value3 = {
                int: 7,
                bool: true,
                float: Math.random(),
                buffer: Buffer.from('Hello World3!'),
                string: '#äö=)@€²(/&%$§"3',
                largeBuffer: Buffer.alloc(3)
            };

            await Promise.all([cache1.set('key', value1), cache2.set('key', value2), cache3.set('key', value3)]);
            const values = await Promise.all([cache1.get('key'), cache2.get('key'), cache3.get('key')]);
            //all caches should be the same
            assert.deepStrictEqual(values[0], values[1]);
            assert.deepStrictEqual(values[0], values[2]);

            //the cache should be one of the values that was stored to it
            try {
                assert.deepStrictEqual(value1, values[0]);
            } catch (e) {
                try {
                    assert.deepStrictEqual(value2, values[0]);
                } catch (e) {
                    assert.deepStrictEqual(value3, values[0]);
                }
            }
        });

        it('should work with zip option', async function () {
            const cache = store.create({ path: cacheDirectory, zip: true });
            const originalValue = {
                int: 5,
                bool: true,
                float: Math.random(),
                buffer: Buffer.from('Hello World1!'),
                string: '#äö=)@€²(/&%$§"1',
                largeBuffer: Buffer.alloc(1)
            };

            await cache.set('key', originalValue);
            const loadedValue = await cache.get('key');
            assert.deepStrictEqual(originalValue, loadedValue);
        });

        it('should work with {hash: false} option', async function () {
            const cache = store.create({ path: cacheDirectory, hash: false });
            const originalValue = {
                int: 5,
                bool: true,
                float: Math.random(),
                buffer: Buffer.from('Hello World1!'),
                string: '#äö=)@€²(/&%$§"1',
                largeBuffer: Buffer.alloc(1)
            };

            await cache.set('key', originalValue);
            const loadedValue = await cache.get('key');
            assert.deepStrictEqual(originalValue, loadedValue);
        });



        it('should store and load Map', async function () {
            const original = new Map([['a', 1], ['b', 2]]);
            await cache.set('map', original);
            const loaded = await cache.get('map');
            assert.deepStrictEqual(loaded, original);
        });

        it('should store and load Set', async function () {
            const original = new Set([1, 2, 3]);
            await cache.set('set', original);
            const loaded = await cache.get('set');
            assert.deepStrictEqual(loaded, original);
        });

        it('should store and load RegExp', async function () {
            const original = /abc/gi;
            await cache.set('regex', original);
            const loaded = await cache.get('regex');
            assert.deepStrictEqual(loaded, original);
        });

        it('should store and load BigInt', async function () {
            const original = 12345678901234567890n;
            await cache.set('bigint', original);
            const loaded = await cache.get('bigint');
            assert.deepStrictEqual(loaded, original);
        });

        it('should store and load Infinity and -Infinity', async function () {
            await cache.set('inf', Infinity);
            await cache.set('ninf', -Infinity);
            const loadedInf = await cache.get('inf');
            const loadedNInf = await cache.get('ninf');
            assert.deepStrictEqual(loadedInf, Infinity);
            assert.deepStrictEqual(loadedNInf, -Infinity);
        });

        it('should store and load Buffer', async function () {
            const original = Buffer.from([1, 2, 3, 255]);
            await cache.set('buffer', original);
            const loaded = await cache.get('buffer');
            assert.deepStrictEqual(loaded, original);
        });

        it('should store and load ArrayBuffer', async function () {
            const original = new Uint8Array([1, 2, 3]).buffer;
            await cache.set('arraybuffer', original);
            const loaded = await cache.get('arraybuffer');
            assert.deepStrictEqual(loaded, original);
        });

        it('should store and load all TypedArrays', async function () {
            const typedArrays = [
                new Int8Array([1, -1]),
                new Uint8Array([1, 255]),
                new Uint8ClampedArray([0, 256]),
                new Int16Array([1000, -1000]),
                new Uint16Array([0, 65535]),
                new Int32Array([100000, -100000]),
                new Uint32Array([0, 4294967295]),
                new Float32Array([1.5, -2.5]),
                new Float64Array([1.123456789, -2.987654321]),
                new BigInt64Array([1n, -1n]),
                new BigUint64Array([1n, 2n]),
            ];

            for (let i = 0; i < typedArrays.length; i++) {
                const original = typedArrays[i];
                await cache.set('typed-' + i, original);
                const loaded = await cache.get('typed-' + i);
                assert.deepStrictEqual(loaded, original);
            }
        });

        it('should store and load Error', async function () {
            function normalizeError(err) {
                return { name: err.name, message: err.message, code: err.code, stack: err.stack };
            }
            const original = new Error('Test error');
            await cache.set('error', original);
            const loaded = await cache.get('error');
            assert.deepEqual(normalizeError(loaded), normalizeError(original));
        });

    });

    describe('set() and del()', function () {

        it('should delete files when deleting a value', async function () {
            await cache.set('key', Buffer.alloc(100000));
            await cache.del('key');
            assert.strictEqual(0, await countFiles(cacheDirectory));
        });

    });

    describe('set() and reset()', function () {

        it('should delete all files on reset', async function () {
            await cache.set('key', 'value');
            await cache.reset();
            assert.strictEqual(0, await countFiles(cacheDirectory));
        });

        it('should delete all sub folders on reset', async function () {
            await cache.set('key', 'value');
            await cache.reset();
            assert.strictEqual(0, (await fs.readdir(cacheDirectory)).length);
        });

        it('should delete all files on reset (hash: false)', async function () {
            const cache = store.create({ path: cacheDirectory, hash: false });
            await cache.set('key', 'value');
            await cache.reset();
            assert.strictEqual(0, (await fs.readdir(cacheDirectory)).length);
        });

    });

    describe('reset()', function () {

        it('should not delete cache folder on reset', async function () {
            await cache.reset();
            await fs.access(cacheDirectory);
        });

    });



    describe('set() and ttl()', function () {

        it('should get the right ttl', async function () {
            const ttl = 1000;
            const ttlTolerance = 50;
            const cache = store.create({ path: cacheDirectory, ttl: ttl });
            await cache.set('key', 'value');
            const leftTtl = await cache.ttl('key');
            assert(leftTtl <= ttl && leftTtl > ttl - ttlTolerance);
        });

    });

    describe('mget()', function () {

        it('should receive multiple keys at once', async function () {
            await cache.set('key', 'value');
            await cache.set('key2', 'value2');
            assert.deepStrictEqual(['value', 'value2', undefined], await cache.mget('key', 'key2', 'key3'));
        });

    });

    describe('mset()', function () {

        it('should set multiple keys at once', async function () {
            await cache.mset('key', 'value', 'key2', 'value2');
            assert.deepStrictEqual(['value', 'value2', undefined], await cache.mget('key', 'key2', 'key3'));
        });

    });

    describe('mdel()', function () {

        it('should delete multiple keys at once', async function () {
            await cache.mset('key', 'value', 'key2', 'value2', 'key3', 'value3');
            await cache.mdel('key', 'key2', 'bla');
            assert.deepStrictEqual([undefined, undefined, 'value3'], await cache.mget('key', 'key2', 'key3'));
        });

    });

});