# Node Cache Manager store for Filesystem

A Filesystem store for the [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager) module



## Installation

@todo publish on npm
```sh
npm install cache-manager-fs-hash --save
```


## Features

* Saves anything that is `JSON.stringify`-able to disk
* Buffers are saved to seperate files (if they reach a certain size)
* Works well with the cluster module
* @todo Limit maximum size on disk


## Usage example

Here is an example that demonstrates how to implement the Filesystem cache store.

```javascript
// node cachemanager
var cacheManager = require('cache-manager');
// storage for the cachemanager
var fsStore = require('cache-manager-fs-hash');

// initialize caching on disk
var diskCache = cacheManager.caching({
    store: fsStore,
    path: 'diskcache', /* path for cached files */
    ttl: 60 * 60, /* time to life in seconds */
    maxsize: 1000 * 1000 * 1000, /* max size in bytes on disk */
    ignoreCacheErrors: true, /* ignore if JSON is invalid or files are deleted. just return a cache miss in this case*/
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


```

## How it works

The filename is determined by the md5 hash of the `key`. (The `key` is also saved in the file to detect hash collisions. In this case it will just return a cache miss). Writing, reading, and deleting is performed with .lock files so that multiple instances of the library (e.g. using the cluster module) do not interfere with one another.

## Tests

```sh
npm test
```

## License

cache-manager-fs-hash is licensed under the MIT license.