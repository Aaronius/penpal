#!/usr/bin/env node

import filesize from 'filesize';
import fs from 'fs';
import zlib from 'zlib';

const getGzippedSize = async (filePath) => {
  return new Promise((resolve) => {
    const fileBuffer = fs.readFileSync(filePath);
    zlib.gzip(fileBuffer, (err, compressedBuffer) => {
      if (err) {
        throw err;
      }
      resolve(filesize(compressedBuffer.length));
    });
  });
};

const fileName = process.argv[2];
const uncompressedSize = filesize(fs.statSync(fileName).size);
const compressedSize = await getGzippedSize(fileName);

console.log(
  `File size of '${fileName}' is: ${uncompressedSize} uncompressed, ${compressedSize} compressed (gzip)`
);
