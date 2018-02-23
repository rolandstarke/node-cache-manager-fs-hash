const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const util = require('util');
const lockFile = require('lockfile');
const jsonFileStore = require('./json-file-store');
const wrapCallback = require('./wrap-callback');


/**
 * construction of the disk storage
 * @param {object} [args] options of disk store
 * @param {string} [args.path] pat0h for cached files
 * @param {number} [args.ttl] time to life in seconds
 * @param {number} [args.maxsize] max size in bytes on disk @todo implement
 * @returns {DiskStore}
 */
exports.create = function (args) {
    return new DiskStore(args && args.options ? args.options : args);
};

function DiskStore(options) {
    options = options || {};

    this.options = {
        path: options.path || './cache', /* path for cached files  */
        ttl: options.ttl >= 0 ? +options.ttl : 60, /* time before expiring in seconds */
        maxsize: options.maxsize || Infinity, /* max size in bytes on disk */ //@todo implement
        lockFile: {
            wait: 5 * 1000,
            pollPeriod: 100,
            stale: 60 * 1000
        }
    };

    // check storage directory for existence (or create it)
    if (!fs.existsSync(this.options.path)) {
        fs.mkdirSync(this.options.path);
    }
}

/**
 * save an entry in store
 * @param {string} key 
 * @param {*} val 
 * @param {object} [options] 
 * @param {number} options.ttl time to life in seconds
 * @param {function} [cb]
 * @returns {Promise}
 */
DiskStore.prototype.set = wrapCallback(async function (key, val, options) {
    const filePath = this._getFilePathByKey(key);

    const ttl = (options && (options.ttl >= 0)) ? +options.ttl : this.options.ttl;
    const data = {
        expireTime: Date.now() + ttl * 1000,
        key: key,
        val: val,
    };

    try {
        await this._lock(filePath);
        await jsonFileStore.write(filePath, data);
    } catch (err) {
        throw err;
    } finally {
        await this._unclock(filePath);
    }
});




/**
 * get an entry from store
 * @param {string} key
 * @param {function} [cb]
 * @returns {Promise}
 */
DiskStore.prototype.get = wrapCallback(async function (key) {
    const filePath = this._getFilePathByKey(key);

    try {
        await this._lock(filePath);
        const data = await jsonFileStore.read(filePath);
        if (data.expireTime <= Date.now()) {
            //cache expired
            //todo this.del(key);
            return undefined;
        }
        if (data.key !== key) {
            //hash collision
            return undefined;
        }
        return data.val;

    } catch (err) {
        //file does not exist lets return a cache miss
        if (err.code === 'ENOENT') {
            return undefined;
        } else {
            throw err;
        }
    } finally {
        await this._unclock(filePath);
    }
});



/**
 * delete entry from cache
 */
DiskStore.prototype.del = function (key, options, cb) {
    //todo
    throw new Error('cache-manager-fs-hash does not implement .del()');
};


/**
 * cleanup cache on disk -> delete all files from the cache
 */
DiskStore.prototype.reset = function (cb) {
    //todo
    throw new Error('cache-manager-fs-hash does not implement .reset()');
};



/**
 * locks a file so other forks that want to use the same file have to wait
 * @param {string} filePath 
 * @returns {Promise}
 * @private
 */
DiskStore.prototype._lock = function (filePath) {
    return util.promisify(lockFile.lock)(
        filePath + '.lock',
        JSON.parse(JSON.stringify(this.options.lockFile)) //the options are modified -> create a copy to prevent that
    );
};

/**
 * unlocks a file path
 * @type {Function}
 * @param {string} filePath 
 * @returns {Promise}
 * @private
 */
DiskStore.prototype._unclock = function (filePath) {
    return util.promisify(lockFile.unlock)(filePath + '.lock');
};

/**
 * returns the location where the value should be stored
 * @param {string} key 
 * @returns {string}
 * @private
 */
DiskStore.prototype._getFilePathByKey = function (key) {
    return path.join(
        this.options.path,
        '/diskstore-' + crypto.createHash('md5').update(key.toString()).digest('hex')
    );
};