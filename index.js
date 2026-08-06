import {fork} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {writeFileSync, unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

const workerScript = `
import {performance} from 'node:perf_hooks';

const packageName = process.argv[2];

const memBefore = process.memoryUsage();
const startTime = performance.now();

try {
	await import(packageName);
} catch {}

const endTime = performance.now();
const memAfter = process.memoryUsage();

const result = {
	startupTime: endTime - startTime,
	memoryDelta: {
		rss: memAfter.rss - memBefore.rss,
		heapUsed: memAfter.heapUsed - memBefore.heapUsed,
		heapTotal: memAfter.heapTotal - memBefore.heapTotal,
	},
	eventLoopBlock: 0,
};

// Measure event loop delay briefly
const start = performance.now();
const intervals = [];
let count = 0;
const maxCount = 10;

function measure() {
	const now = performance.now();
	if (count > 0) {
		intervals.push(now - start - (count * 1));
	}
	count++;
	if (count < maxCount) {
		setTimeout(measure, 1);
	} else {
		result.eventLoopBlock = intervals.length > 0
			? intervals.reduce((a, b) => a + b, 0) / intervals.length
			: 0;
		process.stdout.write(JSON.stringify(result));
	}
}

measure();
`;

function createWorkerFile() {
	const filename = path.join(tmpdir(), `dep-perf-worker-${randomUUID()}.mjs`);
	writeFileSync(filename, workerScript);
	return filename;
}

function runWorker(packageName, workerFile) {
	return new Promise((resolve, reject) => {
		// The result comes back over stdout rather than IPC. An IPC message can
		// still be in flight when the child exits, which made the parent report
		// a failure for a run that had succeeded; 'close' fires only once the
		// streams are drained, so reading stdout has no such race.
		const child = fork(workerFile, [packageName], {
			stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
		});

		let stdout = '';
		let stderr = '';
		child.stdout.on('data', chunk => {
			stdout += chunk;
		});
		child.stderr.on('data', chunk => {
			stderr += chunk;
		});

		child.on('error', reject);

		child.on('close', code => {
			if (code !== 0) {
				reject(new Error(`Worker exited with code ${code}: ${stderr.trim()}`));
				return;
			}

			try {
				resolve(JSON.parse(stdout));
			} catch {
				reject(new Error(`Worker produced no parseable result: ${stdout.trim() || stderr.trim()}`));
			}
		});
	});
}

function median(values) {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[middle - 1] + sorted[middle]) / 2
		: sorted[middle];
}

export default async function analyzeDep(packageName, options = {}) {
	const {iterations = 3, warmup = true} = options;

	const workerFile = createWorkerFile();

	try {
		if (warmup) {
			await runWorker(packageName, workerFile);
		}

		const results = [];
		for (let i = 0; i < iterations; i++) {
			// eslint-disable-next-line no-await-in-loop
			const result = await runWorker(packageName, workerFile);
			results.push(result);
		}

		return {
			startupTime: median(results.map(r => r.startupTime)),
			memoryDelta: {
				rss: median(results.map(r => r.memoryDelta.rss)),
				heapUsed: median(results.map(r => r.memoryDelta.heapUsed)),
				heapTotal: median(results.map(r => r.memoryDelta.heapTotal)),
			},
			eventLoopBlock: median(results.map(r => r.eventLoopBlock)),
		};
	} finally {
		try {
			unlinkSync(workerFile);
		} catch {}
	}
}

export async function analyzeMultiple(packageNames, options = {}) {
	const results = new Map();

	for (const packageName of packageNames) {
		// eslint-disable-next-line no-await-in-loop
		const result = await analyzeDep(packageName, options);
		results.set(packageName, result);
	}

	return results;
}

export function formatReport(results) {
	const lines = [
		'Package Performance Report',
		'='.repeat(60),
		'',
		padRight('Package', 30) + padRight('Startup (ms)', 15) + padRight('Heap (KB)', 15),
		'-'.repeat(60),
	];

	for (const [name, result] of results) {
		const startup = result.startupTime.toFixed(2);
		const heap = (result.memoryDelta.heapUsed / 1024).toFixed(1);
		lines.push(padRight(name, 30) + padRight(startup, 15) + padRight(heap, 15));
	}

	lines.push('');
	return lines.join('\n');
}

function padRight(string_, length) {
	return string_.padEnd(length);
}
