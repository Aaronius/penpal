#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const version = process.argv[2] ?? '6.2.2';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penpal-legacy-'));

try {
  execSync(`npm pack penpal@${version}`, {
    cwd: tmpDir,
    stdio: 'inherit',
  });

  const tarballName = fs
    .readdirSync(tmpDir)
    .find((entry) => entry.startsWith('penpal-') && entry.endsWith('.tgz'));

  if (!tarballName) {
    throw new Error(`Unable to find packed tarball for penpal@${version}`);
  }

  execSync(`tar -xzf ${tarballName}`, {
    cwd: tmpDir,
    stdio: 'inherit',
  });

  const sourceFile = path.join(tmpDir, 'package', 'dist', 'penpal.min.js');
  const destinationFile = path.resolve(
    'test/browser/fixtures/vendor/penpal-v6.min.js'
  );

  fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
  fs.copyFileSync(sourceFile, destinationFile);

  console.log(`Updated ${destinationFile} from penpal@${version}`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
