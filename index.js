var fs = require('fs');
var crypto = require('crypto');
var path = require('path');


/**
 * construction of the disk storage
 */
function DiskStore(options) {
    options = options || {};

    this.options = {
        path: options.path || './cache',
        ttl: (options.ttl >= 0) ? options.ttl : 60, //seconds
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
    if (typeof options === 'function') {
        cb = options;
        options = {};
    }
    options = options || {};

    // get ttl
    var ttl = (options.ttl >= 0) ? options.ttl : this.options.ttl;

    var filename = this._getFilePathFromKey(key);

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

    this._saveExternalBuffers(key, externalBuffers, function () {
        fs.writeFile(filename, dataString, 'utf8', function (err) {
            if (cb) return process.nextTick(cb.bind(null, err));
        });
    });
};



/**
 * get entry from cache
 */
DiskStore.prototype.get = function (key, options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = {};
    }
    options = options || {};

    var filename = this._getFilePathFromKey(key);
    var that = this;
    fs.readFile(filename, 'utf8', function (err, dataString) {
        if (err) {
            //return a miss
            if (cb) process.nextTick(cb.bind(null, null));
            return;
        }
        function bufferReceiver(k, value) {
            if (value && value.type === 'Buffer' && value.data) {
                return bufferFromArray(value.data);
            }else if (value && value.type === 'ExternalBuffer' && typeof value.index === 'number' && typeof value.size === 'number') {
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
                    streamError = err;
                });
                readStream.on('close', function () {
                    streamsTodoCounter--;
                    if (streamsTodoCounter === 0) {
                        externalBuffersReadDone(streamError);
                    }
                });

                return buffer;
            } else {
                return value;
            }
        }
        var streamsTodoCounter = 0;
        var streamError = null;
        var data = JSON.parse(dataString, bufferReceiver);
        if (streamsTodoCounter === 0) {
            externalBuffersReadDone(streamError);
        }


        function externalBuffersReadDone(err) {
            if (err) {
                if (cb) process.nextTick(cb.bind(null, err));
                return;
            }
            if (data.expireTime <= Date.now()) {
                that.del(key); //delete expired cache, return miss
                if (cb) process.nextTick(cb.bind(null, null, null));
                return;
            }
            if (cb) process.nextTick(cb.bind(null, null, data.val));
            return;
        }
    });
};



/**
 * delete an entry from the cache
 */
DiskStore.prototype.del = function (key, options, cb) {

    if (typeof options === 'function') {
        cb = options;
        options = {};
    }

    var that = this;

    var filename = this._getFilePathFromKey(key);
    fs.unlink(filename, function (err) {
        if (err) {
            if (cb) process.nextTick(cb.bind(null, err));
            return;
        }
        deleteNextBinary(key, 0);

    });

    function deleteNextBinary(key, i) {
        var filename = that._getFilePathFromKey(key, '-' + i + '.bin');
        fs.unlink(filename, function (err) {
            if (err) {
                //we delete all ExternalBuffers in sequence. when there are no more files and try to delete a file that does not exiist we are done
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
    fs.readdir(this.options.path, function (err, files) {
        if (err) {
            if (cb) process.nextTick(cb.bind(null, err));
            return;
        }
        that._deleteFilesInCacheDir(files, cb);

    });
};










DiskStore.prototype._saveExternalBuffers = function (key, externalBuffers, cb, counter) {
    counter = counter || 0;
    var that = this;
    var externalBuffer = externalBuffers.shift();
    if (!externalBuffer) {
        if (cb) process.nextTick(cb.bind(null, null));
        return;
    }
    var filename = this._getFilePathFromKey(key, '-' + counter + '.bin');
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
    if (file.match(/^diskstore-/)) {
        fs.unlink(path.join(this.options.path, file), function (err) {
            if (err && cb) {
                cb = cb.bind(null, err);
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









module.exports = {
    create: function (args) {
        return new DiskStore(args && args.options ? args.options : args);
    }
};