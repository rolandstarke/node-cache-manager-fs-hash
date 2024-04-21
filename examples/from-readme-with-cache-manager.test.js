const cacheManager = require('cache-manager');
const {DiskStore} = require('..'); //replace with 'cache-manager-fs-hash'!

const diskCache = cacheManager.createCache(new DiskStore({
    path: 'diskcache', // path for cached files
    // ... other options
}));


(async () => {

    await diskCache.set('key', 'value');
    console.log(await diskCache.get('key')); // "value"

    console.log(await getUserCached(5)); // {id: 5, name: '...'}
    console.log(await getUserCached(5)); // {id: 5, name: '...'}

    function getUserCached(userId) {
        return diskCache.wrap(userId, function () {
            return getUser(userId);
        });
    }

    async function getUser(userId) {
        await new Promise(r => setTimeout(r, 100)); // sleep 0.1 seconds
        return {id: userId, name: '...' + Math.random()};
    }

})();