const cacheManager = require('cache-manager');
const fsStore = require('..'); //replace with 'cache-manager-fs-hash' !!

const diskCache = cacheManager.caching({
    store: fsStore,
    options: {
        path: 'diskcache', // path for cached files
        subdirs: true,
    }
});


(async () => {

    await diskCache.set('key1', 'value');
    await diskCache.set('key2', 'value');
    await diskCache.set('key3', 'value');

})();
