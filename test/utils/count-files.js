const path = require('path');
const fs = require('fs/promises');

module.exports = async function countFiles(dir) {
    let counter = 0;
    const files = await fs.readdir(dir, {withFileTypes: true});
    for (let file of files) {
        if (file.isDirectory()) {
            counter += await countFiles(path.join(dir, file.name));
        } else if (file.isFile()) {
            counter++;
        }
    }
    return counter;
}