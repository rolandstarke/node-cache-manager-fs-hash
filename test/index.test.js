const assert = require('assert');
const fs = require('fs');
const removeDir = require('rimraf');
const store = require('../index.js');
const cacheDirectory = __dirname + '/cache';

function countFilesInCacheDir() {
    return fs.readdirSync(cacheDirectory).length;
}

describe('DiskStore', function () {

    let cache;
    // remove test directory before each test
    beforeEach(function (done) {
        removeDir(cacheDirectory, function (err) {
            cache = store.create({path: cacheDirectory});
            done(err);
        });
    });
    // remove test directory after last test
    after(function (done) {
        removeDir(cacheDirectory, done);
    });


    describe('construction', function () {
        it('should create cache dir', function () {
            assert(fs.existsSync(cache.options.path));
        });

    });


    describe('get()', function () {

        it('should return undefined on non existing key callback', function (done) {
            cache.get('not existing key', function (err, data) {
                assert.strictEqual(null, err);
                assert.strictEqual(undefined, data);
                done();
            });
        });

        it('should return undefined on non existing key promise', async function () {
            const data = await cache.get('not existing key');
            assert.strictEqual(undefined, data);
        });

        it('should not be that slow reading the same non existing cache key sequentially', async function () {
            this.slow(30);

            for (let i = 0; i < 30; i++) {
                const data = await cache.get('not existing key');
                assert.strictEqual(undefined, data);
            }
        });

        it('should not be that slow reading the same non existing cache key parallel', async function () {
            this.slow(100);

            for (let i = 0; i < 20; i++) {
                await Promise.all([1, 2, 3, 4, 5].map(async function () {
                    const data = await cache.get('not existing key');
                    assert.strictEqual(undefined, data);
                }));
            }
        });

        it('should not be that slow reading different non existing cache keys parallel', async function () {
            this.slow(30);

            await Promise.all(Array.apply(null, Array(30)).map(async function (v, i) {
                const data = await cache.get('not existing key' + i);
                assert.strictEqual(undefined, data);
            }));
        });

    });

    describe('set()', function () {

        it('should create a file for each saved value', async function () {
            await cache.set('key', 'value');
            assert.strictEqual(1, countFilesInCacheDir());
            await cache.set('key2', 'value');
            assert.strictEqual(2, countFilesInCacheDir());
        });

        it('should save buffers in seperate files promise', async function () {
            await cache.set('key', Buffer.alloc(100000));
            assert.strictEqual(2, countFilesInCacheDir());
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


    describe('set() and get()', function () {

        it('should load the same value that was saved (simple object)', async function () {
            const originalValue = {int: 5, bool: true, float: 0.1, string: '#äö=)@€²(/&%$§"'};
            await cache.set('(simple object)', originalValue);
            const loadedValue = await cache.get('(simple object)');
            assert.deepStrictEqual(originalValue, loadedValue);
        });

        it('should load the same value that was saved (large buffers)', async function () {
            this.slow(500); // writing 30 MB and reading 30 MB on a 200/200 SSD sould take about 300ms
            this.timeout(3000);

            const originalValue = {
                smallbuffer: Buffer.from('Hello World!'),
                largeBuffer: Buffer.alloc(1000 * 1000 * 20 /* 20MB */, 5),
                largeBuffer2: Buffer.alloc(1000 * 1000 * 10 /* 10MB */, 100)
            };
            await cache.set('(large buffers)', originalValue);
            const loadedValue = await cache.get('(large buffers)');
            assert.deepEqual(originalValue, loadedValue);
        });

        it('should not load expired data (global options)', async function () {
            const cache = store.create({path: cacheDirectory, ttl: 0});
            await cache.set('key', 'value');
            const loadedValue = await cache.get('key');
            assert.strictEqual(undefined, loadedValue);
        });

        it('should not load expired data (set options)', async function () {
            await cache.set('key', 'value', {ttl: 0});
            const loadedValue = await cache.get('key');
            assert.strictEqual(undefined, loadedValue);
        });

        it('should work with numeric keys', async function () {
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
            const cache1 = store.create({path: cacheDirectory});
            const cache2 = store.create({path: cacheDirectory});

            await cache1.set('key', originalValue);
            const loadedValue = await cache2.get('key');
            assert.strictEqual(loadedValue, originalValue);
        });

        it('should work with subdirs', async function () {
            const cache = store.create({path: cacheDirectory, dirs: true});
            const originalValue = {int: 8, bool: true, float: 0.9, string: 'dsfsdöv'};
            await cache.set('(simple object)', originalValue);
            const loadedValue = await cache.get('(simple object)');
            assert.deepStrictEqual(originalValue, loadedValue);
        });

        it('should be able to set & get a value on different instances simultaneously', async function () {
            this.slow(600);
            this.timeout(5000);

            const cache1 = store.create({path: cacheDirectory});
            const cache2 = store.create({path: cacheDirectory});
            const cache3 = store.create({path: cacheDirectory});

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

    });

    //todo implement del
    describe('set() and del()', function () {

        it('should delete files when deleting a value', async function () {
            await cache.set('key', Buffer.alloc(100000));
            await cache.del('key');
            assert.strictEqual(0, countFilesInCacheDir());
        });

    });

    //todo implement reset
    describe('set() and reset()', function () {

        it('should delete all files on reset', async function () {
            await cache.set('key', 'value');
            await cache.reset('key');
            assert.strictEqual(0, countFilesInCacheDir());
        });

    });

});