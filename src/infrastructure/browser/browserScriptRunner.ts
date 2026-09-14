import type { ScriptRunner, ScriptRunnerRequest, ScriptRunnerResult } from '../../application/runtime/contracts';

export class BrowserScriptRunner implements ScriptRunner {
  run(request: ScriptRunnerRequest): Promise<ScriptRunnerResult> {
    return new Promise((resolve) => {
      const workerCode = `
        self.onmessage = async (event) => {
          const { source, input, context } = event.data;
          const logs = [];
          const safeConsole = {
            log: (...args) => logs.push(args.map(format).join(' ')),
            warn: (...args) => logs.push('[warn] ' + args.map(format).join(' ')),
            error: (...args) => logs.push('[error] ' + args.map(format).join(' '))
          };

          function format(value) {
            if (typeof value === 'string') return value;
            try { return JSON.stringify(value); } catch { return String(value); }
          }

          try {
            const factory = new Function(
              'input',
              'context',
              'console',
              '"use strict";\\n' +
              'const window=undefined, document=undefined, fetch=undefined, XMLHttpRequest=undefined, WebSocket=undefined, importScripts=undefined;\\n' +
              source + '\\n' +
              'if (typeof execute !== "function") throw new Error("Script должен объявлять function execute(input, context)");\\n' +
              'return execute(input, context);'
            );

            const value = await factory(input, context, safeConsole);
            self.postMessage({ ok: true, value, logs });
          } catch (error) {
            self.postMessage({ ok: false, error: error?.stack || error?.message || String(error), logs });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      let finished = false;

      const finish = (result: ScriptRunnerResult) => {
        if (finished) return;
        finished = true;
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve(result);
      };

      const timer = window.setTimeout(() => {
        finish({ ok: false, error: `Script timeout after ${request.timeoutMs} ms`, timeout: true, logs: [] });
      }, request.timeoutMs);

      worker.onmessage = (event: MessageEvent<ScriptRunnerResult>) => {
        window.clearTimeout(timer);
        finish(event.data);
      };

      worker.onerror = (event) => {
        window.clearTimeout(timer);
        finish({ ok: false, error: event.message || 'Worker error', logs: [] });
      };

      worker.postMessage({
        source: request.source,
        input: structuredClone(request.input),
        context: structuredClone(request.context),
      });
    });
  }
}
