const fs = require('fs/promises');
const fsOld = require('fs');
const crypto = require('crypto');
const path = require('path');
const promisify = require('util').promisify;
const lockFile = require('lockfile');
const jsonFileStore = require('./json-file-store');
const wrapCallback = require('./wrap-callback');


class DiskStore {
    #options;

    /**
     * construction of the disk storage
     * @param {object} [options] options of disk store
     * @param {string} [options.path] path for cached files
     * @param {number} [options.ttl] time to life in milliseconds
     * @param {boolean} [options.zip] zip content to save disk space
     * @param {boolean} [options.subdirs] create subdirectories
     * @returns {DiskStore}
     */
    constructor(options) {
        options = options || {};

        this.#options = {
            path: options.path || './cache', /* path for cached files  */
            ttl: +(options.ttl ?? Infinity), /* time before expiring in milliseconds */
            //maxsize: options.maxsize || Infinity, /* max size in bytes on disk, not used yet */
            subdirs: options.subdirs ?? true,
            zip: options.zip || false,
            lockFile: { //check lock at 0ms 50ms 100ms ... 400ms 1400ms 1450ms... up to 10 seconds, after that just assume the lock is staled
                wait: 400,
                pollPeriod: 50,
                stale: 10 * 1000,
                retries: 10,
                retryWait: 600,
            }
        };

        // check storage directory for existence (or create it)
        if (!fsOld.existsSync(this.#options.path)) {
            try {
                fsOld.mkdirSync(this.#options.path);
            } catch (err) {
                if (err.code !== 'EEXIST') {
                    throw err;
                }
            }
        }

        // allow methods to be called with callback, cache-manager v4 .wrap() needs this.
        for (const method of ['get', 'set', 'del', 'reset', 'mget', 'mset', 'mdel', 'keys']) {
            this[method] = wrapCallback(this[method].bind(this));
        }
        // for compatibility reasons with cache-manager-v4 we set the store property
        // this allows calling cacheManager.caching(new DiskStore()) with cache-manager-v4 and cache-manager-v5
        // noinspection JSUnusedGlobalSymbols
        this.store = this;
    }

    /**
     * save an entry in store
     * @param {string} key
     * @param {*} val
     * @param {number} [ttl] time to life in milliseconds
     * @return {Promise<void>}
     */
    async set(key, val, ttl) {
        key = key + '';
        const filePath = this.#getFilePathByKey(key);

        // for backwards compatibility allow ttl to be passed as {ttl: 5}
        // noinspection JSCheckFunctionSignatures
        if (ttl && Object.hasOwn(ttl, 'ttl')) {
            // noinspection JSUnresolvedReference
            ttl = ttl.ttl;
        }
        const ttlToSet = ttl ?? this.#options.ttl;
        const data = {
            expireTime: ttlToSet === Infinity ? null : Date.now() + ttlToSet,
            key: key,
            val: val,
        };


        if (this.#options.subdirs) {
            //check if subdir exists or create it
            const dir = path.dirname(filePath);
            await fs.access(dir, fs.constants.W_OK).catch(function () {
                return fs.mkdir(dir).catch(err => {
                    if (err.code !== 'EEXIST') throw err;
                });
            });
        }

        try {
            await this.#lock(filePath);
            await jsonFileStore.write(filePath, data, this.#options);
        } catch (err) {
            throw err;
        } finally {
            await this.#unlock(filePath);
        }
    }

    /**
     * get an entry from store
     * @param {string} key
     * @returns {Promise}
     */
    async get(key) {
        const data = await this.#readFile(key);
        if (data) {
            return data.val;
        } else {
            return undefined;
        }
    }

    /**
     * get ttl in milliseconds for key in store
     * @param {string} key
     * @returns {Promise}
     */
    async ttl(key) {
        const data = await this.#readFile(key);
        if (data) {
            return this.#ttlFromExpireTime(data.expireTime);
        } else {
            return 0;
        }
    }

    /**
     * delete entry from cache
     * @param {string} key
     * @return {Promise<void>}
     */
    async del(key) {
        const filePath = this.#getFilePathByKey(key);
        try {
            //check if the file exists to fail faster
            if (this.#options.subdirs) {
                //check if the folder exists to fail faster
                const dir = path.dirname(filePath);
                await fs.access(dir, fs.constants.W_OK);
            }

            await this.#lock(filePath);
            await jsonFileStore.delete(filePath, this.#options);
        } catch (err) {
            //ignore deleting non existing keys
            if (err.code !== 'ENOENT') {
                throw err;
            }
        } finally {
            await this.#unlock(filePath);
        }
    }

    /**
     * cleanup cache on disk -> delete all files from the cache
     * @return {Promise<void>}
     */
    async reset() {
        return await deletePath(this.#options.path, 2, false);

        async function deletePath(dir, maxDeep, deleteEmptyDir) {
            if (maxDeep < 0) {
                return;
            }
            const files = await fs.readdir(dir, {withFileTypes: true});
            for (let file of files) {
                const fullPath = path.join(dir, file.name);
                if (file.isDirectory() && /[/\\]diskstore-[0-9a-fA-F/\\]+/.test(fullPath)) {
                    await deletePath(path.join(dir, file.name), maxDeep - 1, true);
                    if (deleteEmptyDir) {
                        //delete the now empty subdir
                        await fs.rmdir(fullPath).catch(() => 0 /* ignore */);
                    }
                } else if (file.isFile() && /[/\\]diskstore-[0-9a-fA-F/\\]+(\.json|-\d\.bin)/.test(fullPath)) {
                    //delete the file if it is a diskstore file
                    await fs.unlink(fullPath);
                }
            }
        }
    }


    /**
     * save multiple entries in store
     * @param keyValues
     * @return {Promise<void>}
     */
    async mset(...keyValues) {
        let ttl = undefined;
        if (keyValues.length % 2 === 1) {
            ttl = keyValues.pop();
        }
        function chunk(arr, size) {
            return Array.from({length: Math.ceil(arr.length / size)}, (v, i) =>
                arr.slice(i * size, i * size + size)
            );
        }

        const keyValuePairs = chunk(keyValues, 2);
        await Promise.all(keyValuePairs.map(keyValuePair => this.set(keyValuePair[0], keyValuePair[1], ttl)));

    };

    /**
     * get multiple entries from store
     * @param {string} keys
     * @return {Promise<[]>}
     */
    async mget(...keys) {
        return await Promise.all(keys.map(key => this.get(key)));
    };

    /**
     * delete multiple entries from cache
     * @param {string} keys
     * @return {Promise<void>}
     */
    async mdel(...keys) {
        await Promise.all(keys.map(key => this.del(key)));
    };

    /**
     * @private
     * @return {Promise<[string]>}
     */
    async keys() {
        throw new Error('the keys() method can\'t be used. Its not implemented.');
    };

    #ttlFromExpireTime(expireTime) {
        if (expireTime === null || expireTime === undefined) {
            return Infinity;
        }
        return (expireTime - Date.now());
    }

    async #readFile(key) {
        key = key + '';
        const filePath = this.#getFilePathByKey(key);

        try {
            const data = await jsonFileStore.read(filePath, this.#options).catch(async (err) => {
                if (err.code === 'ENOENT') {
                    throw err;
                }
                //maybe the file is currently written to, lets lock it and read again
                try {
                    await this.#lock(filePath);
                    return await jsonFileStore.read(filePath, this.#options);
                } catch (err2) {
                    throw err2;
                } finally {
                    await this.#unlock(filePath);
                }
            });

            if (this.#ttlFromExpireTime(data.expireTime) <= 0) {
                //cache expired
                this.del(key).catch(() => 0 /* ignore */);
                return undefined;
            }

            if (data.key !== key) {
                //hash collision
                return undefined;
            }
            return data;

        } catch (err) {
            //file does not exist lets return a cache miss
            if (err.code === 'ENOENT') {
                return undefined;
            } else {
                throw err;
            }
        }
    }

    /**
     * returns the location where the value should be stored
     * @param {string} key
     * @return {string}
     */
    #getFilePathByKey(key) {
        const hash = crypto.createHash('md5').update(key + '').digest('hex');
        if (this.#options.subdirs) {
            //create subdirs with the first 3 chars of the hash
            return path.join(
                this.#options.path,
                'diskstore-' + hash.substring(0, 3),
                hash.substring(3),
            );
        } else {
            return path.join(
                this.#options.path,
                'diskstore-' + hash
            );
        }
    }

    /**
     * locks a file so other forks that want to use the same file have to wait
     * @param {string} filePath
     * @returns {Promise}
     */
    #lock(filePath) {
        return promisify(lockFile.lock)(
            filePath + '.lock',
            JSON.parse(JSON.stringify(this.#options.lockFile)) //the options are modified -> create a copy to prevent that
        );
    }

    /**
     * unlocks a file path
     * @type {Function}
     * @param {string} filePath
     * @returns {Promise}
     */
    #unlock(filePath) {
        return promisify(lockFile.unlock)(filePath + '.lock');
    }
}

module.exports = DiskStore;



