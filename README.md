# Node Cache Manager store for Filesystem

[![Build Status](https://travis-ci.org/rolandstarke/node-cache-manager-fs-hash.svg?branch=master)](https://travis-ci.org/rolandstarke/node-cache-manager-fs-hash)
[![dependencies Status](https://david-dm.org/rolandstarke/node-cache-manager-fs-hash/status.svg)](https://david-dm.org/rolandstarke/node-cache-manager-fs-hash)

A Filesystem store for the [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager) module

## Installation

```sh
npm install cache-manager-fs-hash --save
```

## Features

* Saves anything that is `JSON.stringify`-able to disk
* Buffers are saved as well (if they reach a certain size they will be stored to seperate files)
* Works well with the cluster module

## Usage example

Here is an example that demonstrates how to implement the Filesystem cache store.

```javascript
// node cachemanager
const cacheManager = require('cache-manager');
// storage for the cachemanager
const fsStore = require('cache-manager-fs-hash');

// initialize caching on disk
const diskCache = cacheManager.caching({
    store: fsStore,
    path: 'diskcache', /* path for cached files */
    ttl: 60 * 60, /* time to life in seconds */
    ignoreCacheErrors: true, /* ignore if JSON is invalid etc. just return a cache miss in this case*/
});

//slow function that should be cached
function slowMultiplyBy2(factor) {
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


```

## How it works

The filename is determined by the md5 hash of the `key`. (The `key` is also saved in the file to detect hash collisions. In this case it will just return a cache miss). Writing, reading, and deleting is performed with .lock files so that multiple instances of the library (e.g. using the cluster module) do not interfere with one another.

## Tests

```sh
npm test
```

## License

cache-manager-fs-hash is licensed under the MIT license.