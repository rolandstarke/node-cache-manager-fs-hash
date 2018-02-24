const assert = require('assert');
const fs = require('fs');
const removeDir = require('rimraf');
const store = require('../index.js');
const cacheDirectory = __dirname + '/cache';


describe('DiskStore', function () {

    let cache;
    // remove test directory before each test
    beforeEach(function (done) {
        removeDir(cacheDirectory, function (err) {
            cache = store.create({ path: cacheDirectory });
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

        it('should retun undefined on non existing key callback', function (done) {
            cache.get('not existing key', function (err, data) {
                assert.equal(null, err);
                assert.equal(undefined, data);
                done();
            });
        });

        it('should retun undefined on non existing key promise', async function () {
            const data = await cache.get('not existing key');
            assert.equal(undefined, data);
        });

        it('should not be that slow reading the same non existing cache key sequentially', async function () {
            this.slow(100);
            for (let i = 0; i < 30; i++) {
                const data = await cache.get('not existing key');
                assert.equal(undefined, data);
            }
        });

        it('should not be that slow reading the same non existing cache key parallel', async function () {
            this.slow(300);
            this.timeout(5000);

            await Promise.all(Array.apply(null, Array(5)).map(async function () {
                const data = await cache.get('not existing key');
                assert.equal(undefined, data);
            }));
        });

        it('should not be that slow reading different non existing cache keys parallel', async function () {
            this.slow(100);

            await Promise.all(Array.apply(null, Array(30)).map(async function (v, i) {
                const data = await cache.get('not existing key' + i);
                assert.equal(undefined, data);
            }));
        });

    });

    describe('set()', function () {

        it('should create a file for each saved value', function (done) {
            cache.set('key', 'value', function (err) {
                assert.equal(null, err);
                assert.equal(1, countFilesInCacheDirWithoutLockFiles());
                cache.set('key2', 'value', function (err) {
                    assert.equal(null, err);
                    assert.equal(2, countFilesInCacheDirWithoutLockFiles());
                    done();
                });
            });
        });

        it('should save buffers in seperate files callback', function (done) {
            cache.set('key', Buffer.alloc(100000), function (err) {
                assert.equal(null, err);
                assert.equal(2, countFilesInCacheDirWithoutLockFiles());
                done();
            });
        });

        it('should save buffers in seperate files promise', async function () {
            await cache.set('key', Buffer.alloc(100000));
            assert.equal(2, countFilesInCacheDirWithoutLockFiles());
        });

        it('should not modify the value while saving', function (done) {
            const value = { int: 5, bool: true, float: 0.1, buffer: Buffer.from('Hello World!'), string: '#äö=)@€²(/&%$§"', largeBuffer: Buffer.alloc(100000) };
            cache.set('key', value, function (err) {
                assert.equal(null, err);
                assert.deepEqual({ int: 5, bool: true, float: 0.1, buffer: Buffer.from('Hello World!'), string: '#äö=)@€²(/&%$§"', largeBuffer: Buffer.alloc(100000) }, value);
                done();
            });
        });

    });


    describe('set() and get()', function () {

        it('should load the same value that was saved (simple object)', function (done) {
            const originalValue = { int: 5, bool: true, float: 0.1, string: '#äö=)@€²(/&%$§"' };
            cache.set('(simple object)', originalValue, function (err) {
                assert.equal(null, err);
                cache.get('(simple object)', function (err, loadedValue) {
                    assert.equal(null, err);
                    assert.deepEqual(originalValue, loadedValue);
                    done();
                });
            });
        });


        it('should load the same value that was saved (large buffers)', function (done) {
            this.slow(500); // writing 30 MB and reading 30 MB on a 200/200 SSD sould take about 300ms
            this.timeout(2000);
            const originalValue = {
                smallbuffer: Buffer.from('Hello World!'),
                largeBuffer: Buffer.alloc(1000 * 1000 * 20 /* 20MB */, 5),
                largeBuffer2: Buffer.alloc(1000 * 1000 * 10 /* 10MB */, 100)
            };
            cache.set('(large buffers)', originalValue, function (err) {
                assert.equal(null, err);
                cache.get('(large buffers)', function (err, loadedValue) {
                    assert.equal(null, err);
                    assert.deepEqual(originalValue, loadedValue);
                    done();
                });
            });
        });

        it('should not load expired data (global options)', function (done) {
            const cache = store.create({ path: cacheDirectory, ttl: 0 });
            cache.set('key', 'value', function (err) {
                cache.get('key', function (err, loadedValue) {
                    assert.equal(null, err);
                    assert.equal(undefined, loadedValue);
                    done();
                });
            });
        });

        it('should not load expired data (set options)', function (done) {
            cache.set('key', 'value', { ttl: 0 }, function (err) {
                cache.get('key', function (err, loadedValue) {
                    assert.equal(null, err);
                    assert.equal(undefined, loadedValue);
                    done();
                });
            });
        });

        it('should work with numeric keys', function (done) {
            const originalValue = 'value';
            cache.set(5, originalValue, function (err) {
                assert.equal(null, err);
                cache.get(5, function (err, loadedValue) {
                    assert.equal(null, err);
                    assert.deepEqual(originalValue, loadedValue);
                    cache.get(6, function (err, loadedValue) {
                        assert.equal(null, err);
                        assert.deepEqual(undefined, loadedValue);
                        done();
                    });
                });
            });
        });

        it('should be able to get a value written by an other cache instance using the same directory', async function () {
            const originalValue = 'value';
            const cache1 = store.create({ path: cacheDirectory });
            const cache2 = store.create({ path: cacheDirectory });

            await cache1.set('key', originalValue);
            assert.equal(await cache2.get('key'), originalValue);
        });

        it('should be able to set & get a value on different instances simultaneously', async function () {
            this.slow(600);
            this.timeout(5000);

            const cache1 = store.create({ path: cacheDirectory });
            const cache2 = store.create({ path: cacheDirectory });
            const cache3 = store.create({ path: cacheDirectory });
            const iterations = 2;  // run the test twice, just to be sure

            for (let i = 0; i < iterations; i++) {
                const value1 = { int: 5, bool: true, float: Math.random(), buffer: Buffer.from('Hello World1!'), string: '#äö=)@€²(/&%$§"1', largeBuffer: Buffer.alloc(1) };
                const value2 = { int: 6, bool: true, float: Math.random(), buffer: Buffer.from('Hello World2!'), string: '#äö=)@€²(/&%$§"2', largeBuffer: Buffer.alloc(2) };
                const value3 = { int: 7, bool: true, float: Math.random(), buffer: Buffer.from('Hello World3!'), string: '#äö=)@€²(/&%$§"3', largeBuffer: Buffer.alloc(3) };

                await Promise.all([cache1.set('key', value1), cache2.set('key', value2), cache3.set('key', value3)]);
                const values = await Promise.all([cache1.get('key'), cache2.get('key'), cache3.get('key')]);
                //all caches should be the same
                assert.deepEqual(values[0], values[1]);
                assert.deepEqual(values[0], values[2]);

                //the cache should be one of the values that was stored to it
                try {
                    assert.deepEqual(value1, values[0]);
                } catch (e) {
                    try {
                        assert.deepEqual(value2, values[0]);
                    } catch (e) {
                        assert.deepEqual(value3, values[0]);
                    }
                }
            }
        });

    });

    //todo implement del
    describe.skip('set() and del()', function () {

        it('should delete files when deleting a value', function (done) {
            cache.set('key', Buffer.alloc(100000), function (err) {
                cache.del('key', function (err) {
                    assert.equal(null, err);
                    assert.equal(0, countFilesInCacheDirWithoutLockFiles());
                    done();
                });
            });
        });

    });

    //todo implement reset
    describe.skip('set() and reset()', function () {

        it('should delete all files on reset', function (done) {
            cache.set('key', 'value', function (err) {
                cache.reset(function (err) {
                    assert.equal(null, err);
                    assert.equal(0, fs.readdirSync(cacheDirectory).length);
                    done();
                });
            });
        });

    });

});



function countFilesInCacheDirWithoutLockFiles() {
    return fs.readdirSync(cacheDirectory).filter(function (filename) {
        return !filename.match(/\.lock$/);
    }).length;
}