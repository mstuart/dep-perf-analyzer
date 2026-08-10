export interface MemoryDelta {
  /** Total heap size delta in bytes. */
  readonly heapTotal: number;

  /** Used heap size delta in bytes. */
  readonly heapUsed: number;
  /** Resident set size delta in bytes. */
  readonly rss: number;
}

export interface AnalysisResult {
  /** Median event loop blocking time in milliseconds. */
  readonly eventLoopBlock: number;

  /** Memory usage delta from before to after import. */
  readonly memoryDelta: MemoryDelta;
  /** Median startup time in milliseconds. */
  readonly startupTime: number;
}

export interface AnalyzeDepOptions {
  /**
	Number of measurement iterations to run.
	@default 3
	*/
  readonly iterations?: number;

  /**
	Whether to run a warmup iteration before measuring.
	@default true
	*/
  readonly warmup?: boolean;
}

/**
Measure the runtime performance impact of a single npm dependency.

@param packageName - The package name or module specifier to analyze.
@param options - Configuration options.
@returns The analysis result with startup time, memory delta, and event loop blocking metrics.

@example
```
import analyzeDep from 'dep-perf-analyzer';

const result = await analyzeDep('node:path');
console.log(result.startupTime);
// => 0.42
```
*/
export default function analyzeDep(
  packageName: string,
  options?: AnalyzeDepOptions
): Promise<AnalysisResult>;

/**
Analyze multiple packages sequentially.

@param packageNames - Array of package names to analyze.
@param options - Configuration options applied to each analysis.
@returns A map of package names to their analysis results.

@example
```
import {analyzeMultiple} from 'dep-perf-analyzer';

const results = await analyzeMultiple(['node:path', 'node:fs']);
for (const [name, result] of results) {
	console.log(name, result.startupTime);
}
```
*/
export function analyzeMultiple(
  packageNames: string[],
  options?: AnalyzeDepOptions
): Promise<Map<string, AnalysisResult>>;

/**
Format analysis results as a human-readable report string.

@param results - A map of package names to analysis results.
@returns A formatted table string.

@example
```
import {analyzeMultiple, formatReport} from 'dep-perf-analyzer';

const results = await analyzeMultiple(['node:path', 'node:fs']);
console.log(formatReport(results));
```
*/
export function formatReport(results: Map<string, AnalysisResult>): string;
