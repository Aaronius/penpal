#!/usr/bin/env node

import filesize from 'filesize';
import fs from 'fs';

const fileName = process.argv[2];
const stats = fs.statSync(fileName);
const size = stats.size;
const human = filesize(size);

console.log(`File size of '${fileName}' is: ${human}`);
