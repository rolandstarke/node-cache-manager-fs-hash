const util = require('util');
const fs = require('fs');

exports.write = async function (path, data) {
    const externalBuffers = [];
    const dataString = JSON.stringify(data, function replacerFunction(k, value) {
        //Buffers searilize to {data: [...], type: "Buffer"}
        if (value && value.type === 'Buffer' && value.data && value.data.length >= 1024 /* only save bigger Buffers external, small ones can be inlined */) {
            const buffer = Buffer.from(value.data);
            externalBuffers.push({
                index: externalBuffers.length,
                buffer: buffer,
            });
            return {
                type: 'ExternalBuffer',
                index: externalBuffers.length - 1,
                size: buffer.length,
            };
        } else {
            return value;
        }
    });


    //save main json file
    await util.promisify(fs.writeFile)(path + '.json', dataString, 'utf8');

    //save external buffers
    await Promise.all(externalBuffers.map(async function (externalBuffer) {
        await util.promisify(fs.writeFile)(path + '-' + externalBuffer.index + '.bin', externalBuffer.buffer, 'utf8');
    }));
};


exports.read = async function (path) {
    //read main json file
    const dataString = await util.promisify(fs.readFile)(path + '.json', 'utf8');


    const externalBuffers = [];
    const data = JSON.parse(dataString, function bufferReceiver(k, value) {
        if (value && value.type === 'Buffer' && value.data) {
            return Buffer.from(value.data);
        } else if (value && value.type === 'ExternalBuffer' && typeof value.index === 'number' && typeof value.size === 'number') {
            //JSON.parse is sync so we need to return a buffer sync, we will fill the buffer later
            const buffer = Buffer.alloc(value.size);
            externalBuffers.push({
                index: +value.index,
                buffer: buffer,
            });
            return buffer;
        } else {
            return value;
        }
    });

    //read external buffers
    await Promise.all(externalBuffers.map(async function (externalBuffer) {
        const fd = await util.promisify(fs.open)(path + '-' + +externalBuffer.index + '.bin', 'r');
        await util.promisify(fs.read)(fd, externalBuffer.buffer, 0, externalBuffer.buffer.length, 0);
        await util.promisify(fs.close)(fd);
    }));
    return data;
};

exports.delete = async function (path) {
    await util.promisify(fs.unlink)(path + '.json');

    //delete binary files
    try {
        for (let i = 0; i < Infinity; i++) {
            await util.promisify(fs.unlink)(path + '-' + i + '.bin');
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            // every binary is deleted, we are done
        } else {
            throw err;
        }
    }
};