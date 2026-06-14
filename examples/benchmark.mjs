import { formatBenchmarkReport, runBenchmarkSuite } from "../src/index.js";

const report = await runBenchmarkSuite();

console.log(formatBenchmarkReport(report));

if (report.failed > 0) {
  process.exitCode = 1;
}
