const DiskStore = require('./src/disk-store');

exports.DiskStore = DiskStore;


// for compatibility reasons with the old readme example we add a create method
// this allows the old readme code to work with cache-manager-v4:
// const fsStore = require('cache-manager-fs-hash');
// const cache = cacheManager.caching({store: fsStore, options {...}});
exports.create = function (args) {
    return new DiskStore(args && args.options ? args.options : args);
};