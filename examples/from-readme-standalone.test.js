const {DiskStore} = require('..'); // replace with 'cache-manager-fs-hash'!

const diskStore = new DiskStore({
    path: __dirname + '/diskcache-standalone', // path for cached files (default: cache)
    ttl: 60 * 60 * 1000, // time to live in milliseconds 
                         // (default: never expires)
    zip: true, // zip files to save disk space (default: false)
    hash: false, // keys are hashed to generate filenames (default: true)
                 // set to false to use plain keys as filenames
});

(async () => {
    await diskStore.set('keys', 'value');
    console.log(await diskStore.get('key')); // "value"

    await diskStore.del('key');
    console.log(await diskStore.get('key')); // undefined

    await diskStore.set('key', 'value', 1000); // with custom TTL
    console.log(await diskStore.ttl('key')); // 999 milliseconds

    // delete stored files
    //await diskStore.reset();
})();