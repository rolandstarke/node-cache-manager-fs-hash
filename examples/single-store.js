// node cachemanager
var cacheManager = require('cache-manager');
// storage for the cachemanager
var fsStore = require('../index.js'); //!!!!!!! replace with: cache-manager-fs-hash
// initialize caching on disk
var diskCache = cacheManager.caching({
    store: fsStore,
    path: __dirname + '/diskcache', /* path for cached files */
    ttl: 60 * 60, /* time to life in seconds */
    maxsize: 1000 * 1000 * 1000, /* max size in bytes on disk */
    ignoreCacheErrors: false, /* ignore if JSON is invalid or files are deleted. just return a cache miss in this case*/
});

//slow function that should be cached
function slowMultiplyBy2(factor, callback) {
    console.log('doing heavy work...');
    setTimeout(function () {
        callback(null, factor * 2);
    }, 1000);
}

//create a cached version of the slow function
function slowMultiplyBy2Cached(factor, callback) {
    diskCache.wrap(factor, function (cacheCallback) {
        slowMultiplyBy2(factor, cacheCallback);
    }, callback);
}

//call the cached version each 500ms. the heavy work is only done once
setInterval(function () {
    slowMultiplyBy2Cached(21, function (err, answer) {
        if (err) throw err;
        console.log('answer', answer);
    });
}, 500);

//doing heavy work...
//answer 42
//answer 42
//answer 42
//...