# Changelog

## [2.0.0]

- Changed `ttl` unit from seconds to milliseconds to be compatible with cache-manager version 5
- Changed `ttl` default to `Infinity` to never expire
- Changed `subdirs` default to `true` as it is a reasonable default and removed it from the readme
- Added `DiskStore` to export
- Dropped support for Node.js below version 18

## [0.0.9] - 2020-06-12

- Fixed subdir dir already exist error

## [0.0.8] - 2020-04-04

- Added `zip` option
- Added support to store `Infinity`
- Dropped support for Node.js below version 8
