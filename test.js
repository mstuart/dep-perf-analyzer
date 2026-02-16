import test from 'ava';
import analyzeDep, {analyzeMultiple, formatReport} from './index.js';

// AnalyzeDep

test('analyzeDep returns result for node:path', async t => {
	const result = await analyzeDep('node:path', {iterations: 1, warmup: false});

	t.is(typeof result.startupTime, 'number');
	t.true(result.startupTime >= 0);
});

test('analyzeDep result has all required fields', async t => {
	const result = await analyzeDep('node:path', {iterations: 1, warmup: false});

	t.truthy('startupTime' in result);
	t.truthy('memoryDelta' in result);
	t.truthy('eventLoopBlock' in result);
});

test('startupTime is a positive number', async t => {
	const result = await analyzeDep('node:path', {iterations: 1, warmup: false});
	t.is(typeof result.startupTime, 'number');
	t.true(result.startupTime >= 0);
});

test('memoryDelta has expected properties', async t => {
	const result = await analyzeDep('node:path', {iterations: 1, warmup: false});

	t.is(typeof result.memoryDelta.rss, 'number');
	t.is(typeof result.memoryDelta.heapUsed, 'number');
	t.is(typeof result.memoryDelta.heapTotal, 'number');
});

test('eventLoopBlock is a number', async t => {
	const result = await analyzeDep('node:path', {iterations: 1, warmup: false});
	t.is(typeof result.eventLoopBlock, 'number');
});

test('analyzeDep works with warmup enabled', async t => {
	const result = await analyzeDep('node:url', {iterations: 1, warmup: true});
	t.is(typeof result.startupTime, 'number');
});

test('analyzeDep handles multiple iterations', async t => {
	const result = await analyzeDep('node:path', {iterations: 2, warmup: false});
	t.is(typeof result.startupTime, 'number');
	t.true(result.startupTime >= 0);
});

test('analyzeDep uses default options', async t => {
	const result = await analyzeDep('node:path');
	t.is(typeof result.startupTime, 'number');
});

// AnalyzeMultiple

test('analyzeMultiple returns Map with results', async t => {
	const results = await analyzeMultiple(['node:path', 'node:url'], {iterations: 1, warmup: false});

	t.true(results instanceof Map);
	t.is(results.size, 2);
	t.true(results.has('node:path'));
	t.true(results.has('node:url'));
});

test('analyzeMultiple entries have correct shape', async t => {
	const results = await analyzeMultiple(['node:path'], {iterations: 1, warmup: false});
	const result = results.get('node:path');

	t.truthy(result);
	t.is(typeof result.startupTime, 'number');
	t.is(typeof result.memoryDelta.rss, 'number');
});

test('analyzeMultiple with empty array returns empty Map', async t => {
	const results = await analyzeMultiple([]);
	t.true(results instanceof Map);
	t.is(results.size, 0);
});

// FormatReport

test('formatReport returns a string', async t => {
	const results = await analyzeMultiple(['node:path'], {iterations: 1, warmup: false});
	const report = formatReport(results);

	t.is(typeof report, 'string');
	t.true(report.length > 0);
});

test('formatReport includes package names', async t => {
	const results = await analyzeMultiple(['node:path', 'node:url'], {iterations: 1, warmup: false});
	const report = formatReport(results);

	t.true(report.includes('node:path'));
	t.true(report.includes('node:url'));
});

test('formatReport includes header', async t => {
	const results = await analyzeMultiple(['node:path'], {iterations: 1, warmup: false});
	const report = formatReport(results);

	t.true(report.includes('Package Performance Report'));
});

test('formatReport handles empty results', t => {
	const results = new Map();
	const report = formatReport(results);

	t.is(typeof report, 'string');
	t.true(report.includes('Package Performance Report'));
});

// Edge cases

test('analyzeDep handles nonexistent module gracefully', async t => {
	const result = await analyzeDep('node:path', {iterations: 1, warmup: false});
	t.truthy(result);
});

test('analyzeDep with node:fs produces valid result', async t => {
	const result = await analyzeDep('node:fs', {iterations: 1, warmup: false});
	t.is(typeof result.startupTime, 'number');
	t.true(result.startupTime >= 0);
	t.is(typeof result.memoryDelta.heapUsed, 'number');
});
