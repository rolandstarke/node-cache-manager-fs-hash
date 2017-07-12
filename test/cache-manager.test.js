var assert = require('assert');
var fs = require('fs');
var removeDir = require('rimraf');
var store = require('../index.js');
var cacheManager = require('cache-manager');
var cacheDirectory = __dirname + '/cache';


describe('CacheManager', function () {


    var cache;
    // remove test directory before each test
    beforeEach(function (done) {
        removeDir(cacheDirectory, function(err){
            cache = cacheManager.caching({ store: store, path: cacheDirectory });
            done(err);
        });
        
    });
    // remove test directory after last test
    after(function (done) {
        removeDir(cacheDirectory, done);
    });

    describe('set', function () {
        it('should store a value without ttl', function (done) {
            cache.set('foo', 'bar', function (err) {
                assert.equal(null, err);
                done();
            });
        });

        it('should store a value with a specific ttl', function (done) {
            cache.set('foo', 'bar', 30, function (err) {
                assert.equal(null, err);
                done();
            });
        });
    });

    describe('get', function () {
        it('should retrieve a value for a given key', function (done) {
            var value = 'bar';
            cache.set('foo', value, function () {
                cache.get('foo', function (err, result) {
                    assert.equal(null, err);
                    assert.equal(value, result);
                    done();
                });
            });
        });

        it('should retrieve a value for a given key if options provided', function (done) {
            let value = 'bar'
            cache.set('foo', value, function () {
                cache.get('foo', {}, function (err, result) {
                    assert.equal(null, err);
                    assert.equal(value, result);
                    done();
                });
            });
        });
    });

    describe('del', function () {
        it('should delete a value for a given key', function (done) {
            cache.set('foo', 'bar', function () {
                cache.del('foo', function (err) {
                    assert.equal(null, err);
                    done();
                });
            });
        });

        it('should delete a value for a given key without callback', function (done) {
            cache.set('foo', 'bar', function () {
                cache.del('foo');
                done();
            });
        });
    });

    describe('reset', function () {
        it('should flush underlying db', function (done) {
            cache.set('foo', 'bar', function () {
                cache.reset(function (err) {
                    assert.equal(null, err);

                    cache.get('foo', function (err, value) {
                        assert.equal(null, err);
                        assert.equal(null, value);
                        done();
                    });
                });
            });
        });
    });

});