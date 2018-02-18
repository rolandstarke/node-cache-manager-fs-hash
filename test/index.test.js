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

        it('should retun undefined on non existing key', function (done) {
            cache.get('not existing key', function (err, data) {
                assert.equal(null, err);
                assert.equal(undefined, data);
                done();
            });
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

        it('should save buffers in seperate files', function (done) {
            cache.set('key', Buffer.alloc(100000), function (err) {
                assert.equal(null, err);
                assert.equal(2, countFilesInCacheDirWithoutLockFiles());
                done();
            });
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
            this.timeout(1000);
            this.slow(500); // writing 30 MB and reading 30 MB on a 200/200 SSD sould take about 300ms
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