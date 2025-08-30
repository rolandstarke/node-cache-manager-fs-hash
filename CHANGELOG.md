# Changelog

## [3.0.0] - 2025-08-30

- Added `hash` option. Can be set to false to use the plain key as filename instead of the hashed key
- Added support to save `Map`, `Set`, `BigInt`, `Error`, `ArrayBuffer` and TypedArrays (e.g. `Int8Array`, ...)

## [2.0.0] - 2024-04-21

- Changed `ttl` unit from seconds to milliseconds to be compatible with cache-manager version 5
- Changed `ttl` default to never expire
- Changed `subdirs` default to `true` as it is a reasonable default and removed it from the readme
- Added `mget`, `mset` and `mdel` methods
- Dropped support for Node.js below version 18

## [1.1.0] - 2024-04-21

- Added `DiskStore` to export

## [0.0.9] - 2020-06-12

- Fixed subdir dir already exist error

## [0.0.8] - 2020-04-04

- Added `zip` option
- Added support to store `Infinity`
- Dropped support for Node.js below version 8
