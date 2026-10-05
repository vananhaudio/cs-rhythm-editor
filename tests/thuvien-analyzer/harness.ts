// Gọi analyzer Python như cầu cục bộ sẽ gọi. Chỉ dùng trong tests/ và cầu dev.
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { analysisLineCounts, analysisTokenLengths, parseAnalysisResult } from '../../src/thuvien/measureAnalysis.ts'
import type { MeasureAnalysisResult } from '../../src/thuvien/measureAnalysis.ts'

export const ANALYZER = fileURLToPath(new URL('../../tools/measure-analyzer/measure_analyzer.py', import.meta.url))

export function runAnalyzerRaw(payload: unknown, env: NodeJS.ProcessEnv = process.env): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = execFile(process.env.PYTHON ?? 'python3', [ANALYZER], { maxBuffer: 20 * 1024 * 1024, timeout: 120_000, env }, (error, stdout, stderr) => {
      if (error && !stdout) return reject(new Error(stderr || error.message))
      try { resolve(JSON.parse(stdout)) } catch { reject(new Error(`analyzer trả về không phải JSON: ${stdout.slice(0, 200)} ${stderr.slice(0, 200)}`)) }
    })
    child.stdin!.end(JSON.stringify(payload))
  })
}

export async function runAnalyzer(text: string, sources: { path: string; mime: string }[], extra: Record<string, unknown> = {}): Promise<MeasureAnalysisResult> {
  return parseAnalysisResult(await runAnalyzerRaw({ sources, lineTokenCounts: analysisLineCounts(text), lineTokenLengths: analysisTokenLengths(text), ...extra }), text)
}
