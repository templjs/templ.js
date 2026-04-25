import { describe, expect, it, vi } from 'vitest';
import {
  createDeterministicDiagnosticsOrchestrator,
  type DeterministicDiagnosticsOrchestratorOptions,
} from '../src/diagnostics-orchestrator';

type TestDiagnostic = { code: string };

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createHarness(
  options?: Partial<DeterministicDiagnosticsOrchestratorOptions<TestDiagnostic>>
) {
  const textByUri = new Map<string, string>();
  const publishDiagnostics = vi.fn<(uri: string, diagnostics: TestDiagnostic[]) => void>();
  const collectLocalDiagnostics = vi.fn<(uri: string, text: string) => TestDiagnostic[]>();
  const collectExtendedDiagnostics =
    vi.fn<(uri: string, text: string) => Promise<TestDiagnostic[]> | TestDiagnostic[]>();

  const orchestrator = createDeterministicDiagnosticsOrchestrator<TestDiagnostic>({
    debounceMs: 0,
    getDocumentText: (uri) => textByUri.get(uri),
    resolveRevisionKey: (_uri, text) => text,
    collectLocalDiagnostics,
    collectExtendedDiagnostics,
    publishDiagnostics,
    ...options,
  });

  return {
    orchestrator,
    textByUri,
    publishDiagnostics,
    collectLocalDiagnostics,
    collectExtendedDiagnostics,
  };
}

describe('DeterministicDiagnosticsOrchestrator', () => {
  it('publishes local diagnostics first and merged diagnostics after extended diagnostics resolve', async () => {
    const uri = 'file:///doc.md.templ';
    const deferredExtended = createDeferred<TestDiagnostic[]>();
    const {
      orchestrator,
      textByUri,
      publishDiagnostics,
      collectLocalDiagnostics,
      collectExtendedDiagnostics,
    } = createHarness();

    textByUri.set(uri, 'v1');
    collectLocalDiagnostics.mockReturnValue([{ code: 'local-v1' }]);
    collectExtendedDiagnostics.mockReturnValue(deferredExtended.promise);

    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();

    expect(publishDiagnostics).toHaveBeenCalledTimes(1);
    expect(publishDiagnostics).toHaveBeenNthCalledWith(1, uri, [{ code: 'local-v1' }]);

    deferredExtended.resolve([{ code: 'host-v1' }]);
    await flushMicrotasks();

    expect(publishDiagnostics).toHaveBeenCalledTimes(2);
    expect(publishDiagnostics).toHaveBeenNthCalledWith(2, uri, [
      { code: 'local-v1' },
      { code: 'host-v1' },
    ]);
  });

  it('drops stale extended diagnostics when a newer run is already active', async () => {
    const uri = 'file:///doc.md.templ';
    const deferredExtendedV1 = createDeferred<TestDiagnostic[]>();
    const deferredExtendedV2 = createDeferred<TestDiagnostic[]>();
    const {
      orchestrator,
      textByUri,
      publishDiagnostics,
      collectLocalDiagnostics,
      collectExtendedDiagnostics,
    } = createHarness();

    textByUri.set(uri, 'v1');
    collectLocalDiagnostics.mockImplementation((_uri, text) => [{ code: `local-${text}` }]);
    collectExtendedDiagnostics
      .mockReturnValueOnce(deferredExtendedV1.promise)
      .mockReturnValueOnce(deferredExtendedV2.promise);

    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();

    textByUri.set(uri, 'v2');
    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();

    deferredExtendedV1.resolve([{ code: 'host-v1' }]);
    await flushMicrotasks();

    deferredExtendedV2.resolve([{ code: 'host-v2' }]);
    await flushMicrotasks();

    const publishedDiagnostics = publishDiagnostics.mock.calls.map((call) => call[1]);
    expect(publishedDiagnostics.some((diags) => diags.some((d) => d.code === 'host-v1'))).toBe(
      false
    );

    const lastPublish = publishedDiagnostics[publishedDiagnostics.length - 1];
    expect(lastPublish).toEqual([{ code: 'local-v2' }, { code: 'host-v2' }]);
  });

  it('debounces repeated schedules for the same URI', async () => {
    vi.useFakeTimers();
    try {
      const uri = 'file:///doc.md.templ';
      const { orchestrator, textByUri, collectLocalDiagnostics, collectExtendedDiagnostics } =
        createHarness({ debounceMs: 120 });

      textByUri.set(uri, 'v1');
      collectLocalDiagnostics.mockReturnValue([{ code: 'local-v1' }]);
      collectExtendedDiagnostics.mockReturnValue([{ code: 'host-v1' }]);

      orchestrator.schedule(uri);
      orchestrator.schedule(uri);
      orchestrator.schedule(uri);

      expect(collectLocalDiagnostics).not.toHaveBeenCalled();
      vi.advanceTimersByTime(119);
      expect(collectLocalDiagnostics).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(collectLocalDiagnostics).toHaveBeenCalledTimes(1);
      expect(collectExtendedDiagnostics).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reruns diagnostics when scheduled again for the same revision key', async () => {
    const uri = 'file:///doc.md.templ';
    const { orchestrator, textByUri, collectLocalDiagnostics, collectExtendedDiagnostics } =
      createHarness();

    textByUri.set(uri, 'same');
    collectLocalDiagnostics.mockReturnValue([{ code: 'local-same' }]);
    collectExtendedDiagnostics.mockReturnValue([{ code: 'host-same' }]);

    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();

    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();

    orchestrator.schedule(uri, { immediate: true, force: true });
    await flushMicrotasks();

    expect(collectLocalDiagnostics).toHaveBeenCalledTimes(3);
    expect(collectExtendedDiagnostics).toHaveBeenCalledTimes(3);
  });
});
