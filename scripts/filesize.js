const filesize = require('filesize');
const fs = require('fs');

const fileName = process.argv[2];

const stats = fs.statSync(fileName);

const size = stats.size;

const human = filesize(size);

console.log(`File size of '${fileName}' is: ${human}`);
