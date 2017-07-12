var assert = require('assert');
var fs = require('fs');
var removeDir = require('rimraf');
var store = require('../index.js');
var cacheDirectory = __dirname + '/cache';


describe('DiskStore', function () {

    var cache;
    // remove test directory before each test
    beforeEach(function (done) {
        removeDir(cacheDirectory, function(err){
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
            var value = { int: 5, bool: true, float: 0.1, buffer: Buffer.from('Hello World!'), string: '#äö=)@€²(/&%$§"', largeBuffer: Buffer.alloc(100000) };
            cache.set('key', value, function (err) {
                assert.equal(null, err);
                assert.deepEqual({ int: 5, bool: true, float: 0.1, buffer: Buffer.from('Hello World!'), string: '#äö=)@€²(/&%$§"', largeBuffer: Buffer.alloc(100000) }, value);
                done();
            });
        });

    });

    describe('set() and get()', function () {

        it('should load the same value that was saved', function (done) {
            var originalValue = { int: 5, bool: true, float: 0.1, buffer: Buffer.from('Hello World!'), string: '#äö=)@€²(/&%$§"', largeBuffer: Buffer.alloc(100000) };
            cache.set('key', originalValue, function (err) {
                assert.equal(null, err);
                cache.get('key', function (err, loadedValue) {
                    assert.equal(null, err);
                    assert.deepEqual(originalValue, loadedValue);
                    done();
                });
            });
        });

        it('should not load expired data (global options)', function (done) {
            var cache = store.create({ path: cacheDirectory, ttl: 0 });
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

    });

    describe('set() and del()', function () {

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

    describe('set() and reset()', function () {

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