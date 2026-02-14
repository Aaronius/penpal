These fixtures load the previous major version of Penpal. They are used to test whether a parent using the current version of Penpal can communicate with a child using the previous major version of Penpal.

The fixture pages load `/vendor/penpal-v6.min.js`, which is vendored in this repository for deterministic tests.
To update the vendored file for a new 6.x release, run:

node scripts/updateLegacyPenpal.js 6.x.x
