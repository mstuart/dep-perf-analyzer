import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const workerScript = `
import {performance} from 'node:perf_hooks';
import {writeSync} from 'node:fs';

const packageName = process.argv[2];

const memBefore = process.memoryUsage();
const startTime = performance.now();

await import(packageName);

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
		writeSync(3, JSON.stringify(result));
		process.exit(0);
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
    // A dedicated pipe keeps module stdout separate from metrics. Close fires
    // after every stream is drained, so the result is complete before parsing.
    const child = fork(workerFile, [packageName], {
      stdio: ["ignore", "pipe", "pipe", "pipe", "ipc"],
    });

    let resultOutput = "";
    let stdout = "";
    let stderr = "";
    child.stdio[3].on("data", (chunk) => {
      resultOutput += chunk;
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}: ${stderr.trim()}`));
        return;
      }

      try {
        resolve(JSON.parse(resultOutput));
      } catch {
        reject(
          new Error(
            `Worker produced no parseable result: ${stdout.trim() || stderr.trim()}`
          )
        );
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

async function runIterations(packageName, workerFile, iterations) {
  if (iterations <= 0) {
    return [];
  }

  const result = await runWorker(packageName, workerFile);
  const remaining = await runIterations(
    packageName,
    workerFile,
    iterations - 1
  );
  return [result, ...remaining];
}

export default async function analyzeDep(packageName, options = {}) {
  const { iterations = 3, warmup = true } = options;
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new TypeError("iterations must be a positive integer");
  }

  const packageSpecifier = import.meta.resolve(packageName);
  const workerFile = createWorkerFile();

  try {
    if (warmup) {
      await runWorker(packageSpecifier, workerFile);
    }

    const results = await runIterations(
      packageSpecifier,
      workerFile,
      iterations
    );

    return {
      eventLoopBlock: median(results.map((r) => r.eventLoopBlock)),
      memoryDelta: {
        heapTotal: median(results.map((r) => r.memoryDelta.heapTotal)),
        heapUsed: median(results.map((r) => r.memoryDelta.heapUsed)),
        rss: median(results.map((r) => r.memoryDelta.rss)),
      },
      startupTime: median(results.map((r) => r.startupTime)),
    };
  } finally {
    try {
      unlinkSync(workerFile);
    } catch {
      // The worker file may already have been removed after a failed run.
    }
  }
}

async function analyzeSequentially(packageNames, options, index, results) {
  if (index >= packageNames.length) {
    return results;
  }

  const packageName = packageNames[index];
  results.set(packageName, await analyzeDep(packageName, options));
  return analyzeSequentially(packageNames, options, index + 1, results);
}

export function analyzeMultiple(packageNames, options = {}) {
  const { iterations = 3 } = options;
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return Promise.reject(
      new TypeError("iterations must be a positive integer")
    );
  }

  return analyzeSequentially(packageNames, options, 0, new Map());
}

export function formatReport(results) {
  const lines = [
    "Package Performance Report",
    "=".repeat(60),
    "",
    padRight("Package", 30) +
      padRight("Startup (ms)", 15) +
      padRight("Heap (KB)", 15),
    "-".repeat(60),
  ];

  for (const [name, result] of results) {
    const startup = result.startupTime.toFixed(2);
    const heap = (result.memoryDelta.heapUsed / 1024).toFixed(1);
    lines.push(padRight(name, 30) + padRight(startup, 15) + padRight(heap, 15));
  }

  lines.push("");
  return lines.join("\n");
}

function padRight(string_, length) {
  return string_.padEnd(length);
}
