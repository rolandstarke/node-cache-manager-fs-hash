var assert = require('assert');
var store = require('../index.js')
var fs = require('fs');
var removeDir = require('rimraf');


var cacheDirectory = 'test/cache';


describe('DiskStore', function () {

    // remove test directory before each test
    beforeEach(function (done) {
        removeDir(cacheDirectory, done);
    });
    // remove test directory after last test
    after(function (done) {
        removeDir(cacheDirectory, done);
    });


    describe('construction', function () {

        it('should create cache dir', function () {
            var s = store.create({ options: { path: cacheDirectory } });
            assert(fs.existsSync(s.options.path));
        });

    });


    describe('get()', function () {

        it('should retun undefined on non existing key', function (done) {
            var s = store.create({ options: { path: cacheDirectory } });
            s.get('not existing key', function (err, data) {
                assert.equal(null, err);
                assert.equal(undefined, data);
                done();
            });
        });

    });

    describe('set()', function () {

        it('should create a file for each saved value', function (done) {
            var s = store.create({ options: { path: cacheDirectory } });
            s.set('key', 'value', function (err) {
                assert.equal(null, err);
                assert.equal(1, fs.readdirSync(cacheDirectory).length);
                s.set('key2', 'value', function (err) {
                    assert.equal(null, err);
                    assert.equal(2, fs.readdirSync(cacheDirectory).length);
                    done();
                });
            });
        });

        it('should save buffers in seperate files', function (done) {
            var s = store.create({ options: { path: cacheDirectory } });
            s.set('key', Buffer.alloc(100000), function (err) {
                assert.equal(null, err);
                assert.equal(2, fs.readdirSync(cacheDirectory).length);
                done();
            });
        });

        it('should not modify the value while saving', function (done) {
            var s = store.create({ options: { path: cacheDirectory } });
            var value = { int: 5, bool: true, float: 0.1, buffer: Buffer.from('Hello World!'), string: '#äö=)@€²(/&%$§"', largeBuffer: Buffer.alloc(100000) };
            s.set('key', value, function (err) {
                assert.equal(null, err);
                assert.deepEqual({ int: 5, bool: true, float: 0.1, buffer: Buffer.from('Hello World!'), string: '#äö=)@€²(/&%$§"', largeBuffer: Buffer.alloc(100000) }, value);
                done();
            });
        });

    });

    describe('set() and get()', function () {

        it('should load the same value that was saved', function (done) {
            var s = store.create({ options: { path: cacheDirectory } });
            var originalValue = { int: 5, bool: true, float: 0.1, buffer: Buffer.from('Hello World!'), string: '#äö=)@€²(/&%$§"', largeBuffer: Buffer.alloc(100000) };
            s.set('key', originalValue, function (err) {
                assert.equal(null, err);
                s.get('key', function (err, loadedValue) {
                    assert.equal(null, err);
                    assert.deepEqual(originalValue, loadedValue);
                    done();
                });
            });
        });

        it('should not load expired data (global options)', function (done) {
            var s = store.create({ options: { path: cacheDirectory, ttl: 0 } });
            s.set('key', 'value', function (err) {
                s.get('key', function (err, loadedValue) {
                    assert.equal(null, err);
                    assert.equal(undefined, loadedValue);
                    done();
                });
            });
        });

        it('should not load expired data (set options)', function (done) {
            var s = store.create({ options: { path: cacheDirectory } });
            s.set('key', 'value', { ttl: 0 }, function (err) {
                s.get('key', function (err, loadedValue) {
                    assert.equal(null, err);
                    assert.equal(undefined, loadedValue);
                    done();
                });
            });
        });

    });

    describe('set() and del()', function () {

        it('should delete files when deleting a value', function (done) {
            var s = store.create({ options: { path: cacheDirectory } });
            s.set('key', Buffer.alloc(100000), function (err) {
                s.del('key', function (err) {
                    assert.equal(null, err);
                    assert.equal(0, fs.readdirSync(cacheDirectory).length);
                    done();
                });
            });
        });

    });

    describe('set() and reset()', function () {

        it('should delete all files on reset', function (done) {
            var s = store.create({ options: { path: cacheDirectory } });
            s.set('key', 'value', function (err) {
                s.reset(function (err) {
                    assert.equal(null, err);
                    assert.equal(0, fs.readdirSync(cacheDirectory).length);
                    done();
                });
            });
        });

    });

});