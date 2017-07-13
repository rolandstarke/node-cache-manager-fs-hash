var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var lockFile = require('lockfile');


/**
 * construction of the disk storage
 */
function DiskStore(options) {
    options = options || {};

    this.options = {
        path: options.path || './cache', /* path for cached files  */
        ttl: (options.ttl >= 0) ? options.ttl : 60, /* time before expiring in seconds */
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

    this.name = 'diskstore';

}



/**
 * set a key into the cache
 */
DiskStore.prototype.set = function (key, val, options, cb) {
    var that = this;
    if (typeof options === 'function') {
        cb = options;
        options = {};
    }
    options = options || {};
    key = key.toString();

    // get ttl
    var ttl = (options.ttl >= 0) ? options.ttl : that.options.ttl;

    var filename = that._getFilePathFromKey(key);
    var lockFilename = filename + '.lock';

    var data = {
        expireTime: Date.now() + ttl * 1000,
        key: key,
        val: val,
    };


    var externalBuffers = [];

    function bufferReplacer(k, value) {
        //Buffers searilize to {data: [...], type: "Buffer"} since somewhere around node v0.12.17
        if (value && value.type === 'Buffer' && value.data && value.data.length >= 1024 /* only save bigger Buffers external, small ones can be inlined */) {
            var buffer = bufferFromArray(value.data);
            externalBuffers.push(buffer);
            return {
                type: 'ExternalBuffer',
                index: externalBuffers.length - 1,
                size: buffer.length
            };
        } else {
            return value;
        }
    }

    var dataString = JSON.stringify(data, bufferReplacer);

    lockFile.lock(lockFilename, clone(that.options.lockFile), function (err) {
        if (err) {
            lockFile.unlock(lockFilename);
            if (cb) process.nextTick(cb.bind(null, err));
            return;
        }
        that._saveExternalBuffers(key, externalBuffers, function () {
            fs.writeFile(filename, dataString, 'utf8', function (err) {
                lockFile.unlock(lockFilename);
                if (cb) process.nextTick(cb.bind(null, err));
                return;
            });
        });
    });
};



/**
 * get entry from cache
 */
DiskStore.prototype.get = function (key, options, cb) {
    var that = this;
    if (typeof options === 'function') {
        cb = options;
        options = {};
    }
    options = options || {};
    key = key.toString();

    var filename = that._getFilePathFromKey(key);
    var lockFilename = filename + '.lock';

    lockFile.lock(lockFilename, clone(that.options.lockFile), function (err) {
        if (err) {
            lockFile.unlock(lockFilename);
            if (cb) process.nextTick(cb.bind(null, err));
            return;
        }
        fs.readFile(filename, 'utf8', function (err, dataString) {
            if (err) {
                //return a miss
                lockFile.unlock(lockFilename);
                if (cb) process.nextTick(cb.bind(null, null));
                return;
            }
            function bufferReceiver(k, value) {
                if (value && value.type === 'Buffer' && value.data) {
                    return bufferFromArray(value.data);
                } else if (value && value.type === 'ExternalBuffer' && typeof value.index === 'number' && typeof value.size === 'number') {
                    //JSON.parse is sync so we need to return a buffer sync, we will fill the buffer later
                    var buffer = bufferOfSize(value.size);
                    var filename = that._getFilePathFromKey(key, '-' + value.index + '.bin');
                    var readStream = fs.createReadStream(filename);
                    streamsTodoCounter++;

                    var writePos = 0;
                    readStream.on('data', function (chunk) {
                        buffer.fill(chunk, writePos);
                        writePos += chunk.length;
                    });
                    readStream.on('error', function (err) {
                        streamsTodoCounter = -1;
                        externalBuffersReadDone(err);
                    });
                    readStream.on('close', function () {
                        streamsTodoCounter--;
                        if (streamsTodoCounter === 0) {
                            externalBuffersReadDone(null);
                        }
                    });

                    return buffer;
                } else {
                    return value;
                }
            }
            var streamsTodoCounter = 0;
            var data = JSON.parse(dataString, bufferReceiver);
            if (streamsTodoCounter === 0) {
                externalBuffersReadDone(null);
            }


            function externalBuffersReadDone(err) {
                lockFile.unlock(lockFilename);
                if (err) {
                    if (cb) process.nextTick(cb.bind(null, err));
                    return;
                }
                if (data.expireTime <= Date.now()) {
                    that.del(key); //delete expired cache, return miss
                    if (cb) process.nextTick(cb.bind(null, null, null));
                    return;
                }
                if (data.key !== key) {
                    //hash collision, return miss
                    if (cb) process.nextTick(cb.bind(null, null, null));
                    return;
                }
                if (cb) process.nextTick(cb.bind(null, null, data.val));
                return;
            }
        });
    });
};



/**
 * delete entry from cache
 */
DiskStore.prototype.del = function (key, options, cb) {
    var that = this;
    if (typeof options === 'function') {
        cb = options;
        options = {};
    }
    options = options || {};
    key = key.toString();



    var filename = that._getFilePathFromKey(key);
    var lockFilename = filename + '.lock';

    lockFile.lock(lockFilename, clone(that.options.lockFile), function (err) {
        if (err) {
            lockFile.unlock(lockFilename);
            if (cb) process.nextTick(cb.bind(null, err));
            return;
        }
        fs.unlink(filename, function (err) {
            if (err) {
                lockFile.unlock(lockFilename);
                if (cb) process.nextTick(cb.bind(null, err));
                return;
            }
            deleteNextBinary(key, 0);
        });
    });

    function deleteNextBinary(key, i) {
        var filename = that._getFilePathFromKey(key, '-' + i + '.bin');
        fs.unlink(filename, function (err) {
            if (err) {
                //we delete all ExternalBuffers in sequence. when there are no more files and try to delete a file that does not exiist we are done
                lockFile.unlock(lockFilename);
                if (cb) process.nextTick(cb.bind(null, null));
                return;
            }
            deleteNextBinary(key, i + 1);
        });
    }
};


/**
 * cleanup cache on disk -> delete all files from the cache
 */
DiskStore.prototype.reset = function (cb) {
    var that = this;
    fs.readdir(that.options.path, function (err, files) {
        if (err) {
            if (cb) process.nextTick(cb.bind(null, err));
            return;
        }
        that._deleteFilesInCacheDir(files, cb);

    });
};










DiskStore.prototype._saveExternalBuffers = function (key, externalBuffers, cb, counter) {
    var that = this;
    counter = counter || 0;
    var externalBuffer = externalBuffers.shift();
    if (!externalBuffer) {
        if (cb) process.nextTick(cb.bind(null, null));
        return;
    }
    var filename = that._getFilePathFromKey(key, '-' + counter + '.bin');
    fs.writeFile(filename, externalBuffer, function (err) {
        if (err) {
            if (cb) process.nextTick(cb.bind(null, err));
            return;
        }
        that._saveExternalBuffers(key, externalBuffers, cb, counter + 1);

    });

};

DiskStore.prototype._deleteFilesInCacheDir = function (files, cb) {
    var that = this;
    var file = files.shift();
    if (!file) {
        if (cb) process.nextTick(cb.bind(null, null));
        return;
    }
    //check if the filename starts with a prefix, we don't want to delete all files if we share the cache folder with others
    if (file.match(/^diskstore-.*\.(bin|json)$/)) {
        fs.unlink(path.join(that.options.path, file), function (err) {
            if (err && cb) {
                cb = cb.bind(null, null);
            }
            that._deleteFilesInCacheDir(files, cb);
        });
    } else {
        that._deleteFilesInCacheDir(files, cb);
    }

};

DiskStore.prototype._getFilePathFromKey = function (key, suffix) {
    suffix = suffix || '.json';
    return path.join(
        this.options.path,
        'diskstore-' + crypto.createHash('md5').update(key).digest('hex') + suffix
    );
};


function bufferFromArray(arr) {
    if (typeof Buffer.fromArray === 'function') {
        return Buffer.fromArray(arr); //Buffer.fromArray() Added in: v5.10.0
    } else {
        return new Buffer(arr);
    }
}

function bufferOfSize(size) {
    if (typeof Buffer.alloc === 'function') {
        return Buffer.alloc(size); //Buffer.alloc() Added in: v5.10.0
    } else {
        return new Buffer(size);
    }
}

function clone(object) {
    return JSON.parse(JSON.stringify(object));
}







/**
 * construction of the disk storage
 * @param {object} [args] options of disk store
 * @param {string} args.path path for cached files
 * @param {number} args.ttl time to life in seconds
 * @param {number} args.maxsize max size in bytes on disk @todo implement
 */
exports.create = function (args) {
    //to stay compatible with "cache-manager-fs" and "cache-manager-fs-binary" we allow to pass the options as `options` and `{options: options}`
    return new DiskStore(args && args.options ? args.options : args);
};