import {expectType, expectError} from 'tsd';
import analyzeDep, {analyzeMultiple, formatReport, type AnalysisResult} from './index.js';

// AnalyzeDep returns Promise<AnalysisResult>
expectType<Promise<AnalysisResult>>(analyzeDep('node:path'));

// AnalyzeDep with options
expectType<Promise<AnalysisResult>>(analyzeDep('node:path', {iterations: 5, warmup: false}));

// AnalysisResult shape
const result = await analyzeDep('node:path');
expectType<number>(result.startupTime);
expectType<number>(result.memoryDelta.rss);
expectType<number>(result.memoryDelta.heapUsed);
expectType<number>(result.memoryDelta.heapTotal);
expectType<number>(result.eventLoopBlock);

// AnalyzeMultiple returns Map
const results = await analyzeMultiple(['node:path', 'node:fs']);
expectType<Map<string, AnalysisResult>>(results);

// FormatReport returns string
expectType<string>(formatReport(results));

// Requires package name
expectError(analyzeDep());
