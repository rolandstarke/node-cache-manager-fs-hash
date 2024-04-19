const cacheManager = require('cache-manager');
const fsStore = require('..'); //replace with 'cache-manager-fs-hash' !!

const diskCache = cacheManager.caching({
    store: fsStore,
    options: {
        path: 'diskcache', // path for cached files
        ttl: 60 * 1000, // time to life in miliseconds
        subdirs: true, //create subdirectories to reduce the files in a single dir (default: false)
        zip: true, //zip files to save diskspace (default: false)
    }
});


(async () => {

    await diskCache.set('key', 'value');
    console.log(await diskCache.get('key')); // "value"
    console.log(await diskCache.ttl('key')); // 5999 miliseconds
    await diskCache.del('key');
    console.log(await diskCache.get('key')); // undefined

    await diskCache.set('key', 'value', 1000); // With custom TTL
    console.log(await diskCache.get('key')); // "value"
    console.log(await diskCache.ttl('key')); // 999 miliseconds
    await diskCache.del('key');
    
    console.log(await getUserCached(5)); // {id: 5, name: '...'}
    console.log(await getUserCached(5)); // {id: 5, name: '...'}

    //await diskCache.reset();

    function getUserCached(userId) {
        return diskCache.wrap(userId, function () {
            return getUser(userId);
        });
    }

    async function getUser(userId) {
        return {id: userId, name: '...'};
    }

})();