// node cachemanager
const cacheManager = require('cache-manager');
// storage for the cachemanager
const fsStore = require('../lib'); //replace with 'cache-manager-fs-hash' !! 

// initialize caching on disk
const diskCache = cacheManager.caching({
    store: fsStore,
    path: 'diskcache', /* path for cached files */
    ttl: 60 * 60, /* time to life in seconds */
    ignoreCacheErrors: true, /* ignore if JSON is invalid etc. just return a cache miss in this case*/
});

//slow function that should be cached
function slowMultiplyBy2(factor, callback) {
    console.log('doing heavy work...');
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve(factor * 2);
        }, 1000);
    });

}

//create a cached version of the slow function
function cachedSlowMultiplyBy2(factor) {
    return diskCache.wrap(factor /* cache key */, function () {
        return slowMultiplyBy2(factor);
    });
}

//call the cached version each 500ms. the heavy work is only done once
setInterval(function () {
    cachedSlowMultiplyBy2(21)
        .then(console.log, console.error);
}, 500);

//doing heavy work...
//42
//42
//42
//...
