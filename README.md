# Node Cache Manager store for Filesystem

[![Build](https://github.com/rolandstarke/node-cache-manager-fs-hash/actions/workflows/node.js.yml/badge.svg)](https://github.com/rolandstarke/node-cache-manager-fs-hash/actions/workflows/node.js.yml)
[![npm package](https://img.shields.io/npm/v/cache-manager-fs-hash.svg)](https://www.npmjs.com/package/cache-manager-fs-hash)
[![node](https://img.shields.io/node/v/cache-manager-fs-hash.svg)](https://nodejs.org)

Package to cache key-value pairs in JSON files.

## Installation

```sh
npm install cache-manager-fs-hash
```

## Features

* Saves anything that is `JSON.stringify`-able to disk
* Buffers are saved as well (if they reach a certain size they will be stored to separate files)
* Works well with the cluster module

## Usage example

Here is an example that demonstrates how to implement the Filesystem cache store.

```javascript
const {DiskStore} = require('cache-manager-fs-hash');

const diskStore = new DiskStore({
    path: 'diskcache', // path for cached files (default: cache)
    ttl: 60 * 60 * 1000, // time to life in milliseconds 
                         // (default: never expires)
    zip: true, // zip files to save disk space (default: false)
});

(async () => {
    await diskStore.set('key', 'value');
    console.log(await diskStore.get('key')); // "value"

    await diskStore.del('key');
    console.log(await diskStore.get('key')); // undefined

    await diskStore.set('key', 'value', 1000); // with custom TTL
    console.log(await diskStore.ttl('key')); // 999 milliseconds

    // delete stored files
    await diskStore.reset();
})();
```

Here is an example that demonstrates how to use the store with the [node-cache-manager](https://github.com/jaredwray/cache-manager) module.

```javascript
const cacheManager = require('cache-manager');
const {DiskStore} = require('cache-manager-fs-hash');

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
```

## How it works

The filename is determined by the md5 hash of the `key`. (The `key` is also saved in the file to detect hash collisions. In this case it will just return a cache miss). Writing is performed with .lock files so that multiple instances of the library (e.g. using the cluster module) do not interfere with one another.

## Tests

```sh
npm test
```

## License

cache-manager-fs-hash is licensed under the MIT license.
