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
		process.send(result);
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
		const child = fork(workerFile, [packageName], {
			stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
		});

		let settled = false;

		child.on('message', result => {
			settled = true;
			resolve(result);
		});

		child.on('error', error => {
			if (!settled) {
				settled = true;
				reject(error);
			}
		});

		child.on('exit', code => {
			// The 'message' IPC event can still be in flight when 'exit' fires
			// (they're delivered over separate handles), so defer the failure
			// one tick to let an already-queued message win the race.
			setImmediate(() => {
				if (!settled) {
					settled = true;
					reject(new Error(`Worker exited with code ${code}`));
				}
			});
		});
	});
}

function median(values) {
	const sorted = [...values].toSorted((a, b) => a - b);
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
		} catch {
			// Ignore errors removing the temporary worker file
		}
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
