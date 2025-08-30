const promisify = require('util').promisify;
const fs = require('fs/promises');
const zlib = require('zlib');

function base64ToArrayBuffer(base64) {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

exports.write = async function (path, data, options) {
    const externalBuffers = [];
    let dataString = JSON.stringify(data, function replacerFunction(k, value) {
        if (value === Infinity) {
            return { __$diskstoreType: 'Infinity', sign: 1 };
        } else if (value === -Infinity) {
            return { __$diskstoreType: 'Infinity', sign: -1 };
        } else if (value instanceof Map) {
            return { __$diskstoreType: 'Map', entries: Array.from(value.entries()) };
        } else if (value instanceof Set) {
            return { __$diskstoreType: 'Set', values: Array.from(value) };
            //} else if (value instanceof Date) {   // Date objects are not passed as Date instances but as Strings
            //    return { __$diskstoreType: 'Date', value: value.toISOString() };
        } else if (value instanceof RegExp) {
            return { __$diskstoreType: 'RegExp', pattern: value.source, flags: value.flags };
        } else if (typeof value === 'bigint') {
            return { __$diskstoreType: 'BigInt', value: value.toString() };
            //} else if (value instanceof URL) { // URL objects are not passed as URL instances but as Strings
            //    return { __$diskstoreType: 'URL', value: value.toString() };
        } else if (value instanceof ArrayBuffer) {
            return { __$diskstoreType: 'ArrayBuffer', data64: Buffer.from(value).toString('base64') };
        } else if (ArrayBuffer.isView(value) && !(value instanceof DataView)) { // TypedArrays
            return { __$diskstoreType: value.constructor.name, data64: Buffer.from(value.buffer).toString('base64') };
        } else if (value instanceof Error) {
            return {
                __$diskstoreType: 'Error',
                code: value.code,
                name: value.name,
                message: value.message,
                stack: value.stack
            };
        } else if (value && value.type === 'Buffer' && value.data) {
            // Buffers serialize to {data: [...], type: "Buffer"}
            const buffer = Buffer.from(value.data);
            // only save bigger Buffers external, small ones can be inlined
            if (value.data.length >= 1024) {
                externalBuffers.push({
                    index: externalBuffers.length,
                    buffer: buffer,
                });
                return {
                    __$diskstoreType: 'ExternalBuffer',
                    index: externalBuffers.length - 1,
                    size: buffer.length,
                };
            } else { //small Buffer
                return {
                    __$diskstoreType: 'Buffer',
                    data64: buffer.toString('base64'),
                };
            }

        } else {
            return value;
        }
    });


    let zipExtension = '';
    if (options.zip) {
        zipExtension = '.gz';
        dataString = await promisify(zlib.deflate)(dataString);
    }
    //save main json file
    await fs.writeFile(path + '.json' + zipExtension, dataString, 'utf8');

    //save external buffers
    await Promise.all(externalBuffers.map(async function (externalBuffer) {
        let buffer = externalBuffer.buffer;
        if (options.zip) {
            buffer = await promisify(zlib.deflate)(buffer);
        }
        await fs.writeFile(path + '-' + externalBuffer.index + '.bin' + zipExtension, buffer);
    }));
};


exports.read = async function (path, options) {
    let zipExtension = '';
    if (options.zip) {
        zipExtension = '.gz';
    }

    //read main json file
    let dataString;
    if (options.zip) {
        const compressedData = await fs.readFile(path + '.json' + zipExtension);
        dataString = (await promisify(zlib.unzip)(compressedData)).toString();
    } else {
        dataString = await fs.readFile(path + '.json' + zipExtension, 'utf8');
    }


    const externalBuffers = [];
    const data = JSON.parse(dataString, function receiverFunction(k, value) {
        if (!value || typeof value !== 'object') return value;

        let __$diskstoreType = value.__$diskstoreType;

        if(!__$diskstoreType) {
            // for compability, in with version <= 2.0.0 of this lib, read the type from `type` instead of `__$diskstoreType`
            if (value.type === 'Buffer' && value.data) {
                __$diskstoreType = 'Buffer';
            } else if (value.type === 'ExternalBuffer' && typeof value.index === 'number' && typeof value.size === 'number') {
                __$diskstoreType = 'ExternalBuffer';
            } else if (value.type === 'Infinity' && typeof value.sign === 'number') {
                __$diskstoreType = 'Infinity';
            }
        }

        switch (__$diskstoreType) {
            case 'Buffer': return value.data64 ? Buffer.from(value.data64, 'base64') : Buffer.from(value.data) /* compability with version <= 2.0.0 of this lib */;
            case 'ExternalBuffer': {
                ///JSON.parse is sync, so we need to return a buffer sync, we will fill the buffer later
                const buffer = Buffer.alloc(value.size);
                externalBuffers.push({
                    index: +value.index,
                    buffer,
                });
                return buffer;
            }
            case 'Infinity': return Infinity * value.sign;
            case 'Map': return new Map(value.entries);
            case 'Set': return new Set(value.values);
            case 'RegExp': return new RegExp(value.pattern, value.flags);
            case 'BigInt': return BigInt(value.value);
            case 'Error': {
                const err = new Error(value.message);
                err.code = value.code;
                err.name = value.name;
                err.stack = value.stack;
                return err;
            }
            case 'Int8Array': return new Int8Array(base64ToArrayBuffer(value.data64));
            case 'Uint8Array': return new Uint8Array(base64ToArrayBuffer(value.data64));
            case 'Uint8ClampedArray': return new Uint8ClampedArray(base64ToArrayBuffer(value.data64));
            case 'Int16Array': return new Int16Array(base64ToArrayBuffer(value.data64));
            case 'Uint16Array': return new Uint16Array(base64ToArrayBuffer(value.data64));
            case 'Int32Array': return new Int32Array(base64ToArrayBuffer(value.data64));
            case 'Uint32Array': return new Uint32Array(base64ToArrayBuffer(value.data64));
            case 'Float32Array': return new Float32Array(base64ToArrayBuffer(value.data64));
            case 'Float64Array': return new Float64Array(base64ToArrayBuffer(value.data64));
            case 'BigInt64Array': return new BigInt64Array(base64ToArrayBuffer(value.data64));
            case 'BigUint64Array': return new BigUint64Array(base64ToArrayBuffer(value.data64));
            case 'ArrayBuffer': return base64ToArrayBuffer(value.data64);
            default: return value;
        }
    });

    //read external buffers
    await Promise.all(externalBuffers.map(async function (externalBuffer) {

        if (options.zip) {
            const bufferCompressed = await fs.readFile(path + '-' + +externalBuffer.index + '.bin' + zipExtension);
            const buffer = await promisify(zlib.unzip)(bufferCompressed);
            buffer.copy(externalBuffer.buffer);
        } else {
            const fd = await fs.open(path + '-' + +externalBuffer.index + '.bin' + zipExtension, 'r');
            await fd.read(externalBuffer.buffer, 0, externalBuffer.buffer.length, 0);
            await fd.close();
        }
    }));
    return data;
};

exports.delete = async function (path, options) {
    let zipExtension = '';
    if (options.zip) {
        zipExtension = '.gz';
    }

    await fs.unlink(path + '.json' + zipExtension);

    //delete binary files
    try {
        for (let i = 0; i < Infinity; i++) {
            await fs.unlink(path + '-' + i + '.bin' + zipExtension);
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            // every binary is deleted, we are done
        } else {
            throw err;
        }
    }
};