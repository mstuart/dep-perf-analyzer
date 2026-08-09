<div align="center">
  <img src="docs/assets/logo.svg" alt="dep-perf-analyzer — Measure the runtime performance impact of npm dependencies" width="720">
</div>

<p align="center"><strong>Measure the runtime performance impact of npm dependencies</strong></p>

<p align="center">
  <a href="https://github.com/mstuart/dep-perf-analyzer/actions/workflows/main.yml"><img src="https://github.com/mstuart/dep-perf-analyzer/actions/workflows/main.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://www.npmjs.com/package/dep-perf-analyzer"><img src="https://img.shields.io/npm/v/dep-perf-analyzer?label=npm" alt="npm"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A520-339933.svg" alt="Node 20+">
  <a href="https://deepwiki.com/mstuart/dep-perf-analyzer"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
  <a href="https://socket.dev/npm/package/dep-perf-analyzer"><img src="https://socket.dev/api/badge/npm/package/dep-perf-analyzer" alt="Socket"></a>
</p>

---
## Install

```sh
npm install dep-perf-analyzer
```

## Usage

```js
import analyzeDep, {analyzeMultiple, formatReport} from 'dep-perf-analyzer';

// Analyze a single dependency
const result = await analyzeDep('express');
console.log(result.startupTime); // Startup time in ms
console.log(result.memoryDelta.heapUsed); // Heap memory delta in bytes

// Analyze multiple dependencies
const results = await analyzeMultiple(['express', 'koa', 'fastify']);
console.log(formatReport(results));
```

## API

### `analyzeDep(packageName, options?)`

Returns: `Promise<{startupTime, memoryDelta, eventLoopBlock}>`

#### packageName

Type: `string`

The package name or module specifier to analyze.

#### options

Type: `object`

##### iterations

Type: `number`\
Default: `3`

Number of measurement iterations. Median values are used for stability.

##### warmup

Type: `boolean`\
Default: `true`

Whether to run a warmup iteration before measuring.

#### Return value

- `startupTime` — Median startup time in milliseconds
- `memoryDelta.rss` — RSS delta in bytes
- `memoryDelta.heapUsed` — Used heap delta in bytes
- `memoryDelta.heapTotal` — Total heap delta in bytes
- `eventLoopBlock` — Median event loop blocking time in milliseconds

### `analyzeMultiple(packageNames, options?)`

Returns: `Promise<Map<string, AnalysisResult>>`

Analyze multiple packages sequentially.

### `formatReport(results)`

Returns: `string`

Format a results map as a human-readable table.

## Related

- [import-cost](https://github.com/nicolo-ribaudo/import-cost) — Display import size in your editor

## License

MIT
