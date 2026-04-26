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
  it('defaults debounceMs and log when optional constructor settings are omitted', async () => {
    const publishDiagnostics = vi.fn();
    const collectLocalDiagnostics = vi.fn(() => [{ code: 'local-default' }]);
    const collectExtendedDiagnostics = vi.fn(() => [{ code: 'host-default' }]);
    const orchestrator = createDeterministicDiagnosticsOrchestrator<TestDiagnostic>({
      getDocumentText: () => 'v1',
      resolveRevisionKey: (_uri, text) => text,
      collectLocalDiagnostics,
      collectExtendedDiagnostics,
      publishDiagnostics,
    });

    orchestrator.schedule('file:///doc.md.templ');
    await flushMicrotasks();

    expect(collectLocalDiagnostics).toHaveBeenCalledTimes(1);
    expect(collectExtendedDiagnostics).toHaveBeenCalledTimes(1);
  });

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

  it('drops stale diagnostics from an older run when revision keys are unchanged', async () => {
    const uri = 'file:///doc.md.templ';
    const deferredLocalV1 = createDeferred<TestDiagnostic[]>();
    const deferredExtendedV1 = createDeferred<TestDiagnostic[]>();
    const deferredExtendedV2 = createDeferred<TestDiagnostic[]>();
    const {
      orchestrator,
      textByUri,
      publishDiagnostics,
      collectLocalDiagnostics,
      collectExtendedDiagnostics,
    } = createHarness();

    textByUri.set(uri, 'same');
    collectLocalDiagnostics
      .mockReturnValueOnce(deferredLocalV1.promise as Promise<TestDiagnostic[]>)
      .mockReturnValueOnce([{ code: 'local-v2' }]);
    collectExtendedDiagnostics
      .mockReturnValueOnce(deferredExtendedV1.promise)
      .mockReturnValueOnce(deferredExtendedV2.promise);

    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();

    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();

    deferredLocalV1.resolve([{ code: 'local-v1' }]);
    deferredExtendedV1.resolve([{ code: 'host-v1' }]);
    await flushMicrotasks();

    deferredExtendedV2.resolve([{ code: 'host-v2' }]);
    await flushMicrotasks();

    expect(publishDiagnostics.mock.calls.map((call) => call[1])).toEqual([
      [{ code: 'local-v2' }],
      [{ code: 'local-v2' }, { code: 'host-v2' }],
    ]);
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

  it('clears pending timers and drops deferred commits after state is cleared', async () => {
    vi.useFakeTimers();
    try {
      const uri = 'file:///doc.md.templ';
      const deferredLocal = createDeferred<TestDiagnostic[]>();
      const deferredExtended = createDeferred<TestDiagnostic[]>();
      const log = vi.fn();
      const {
        orchestrator,
        textByUri,
        publishDiagnostics,
        collectLocalDiagnostics,
        collectExtendedDiagnostics,
      } = createHarness({ debounceMs: 50, log });

      textByUri.set(uri, 'v1');
      collectLocalDiagnostics.mockReturnValue(deferredLocal.promise as Promise<TestDiagnostic[]>);
      collectExtendedDiagnostics.mockReturnValue(
        deferredExtended.promise as Promise<TestDiagnostic[]>
      );

      orchestrator.schedule(uri);
      orchestrator.clear('file:///missing.md.templ');
      orchestrator.schedule(uri);
      orchestrator.clear(uri);

      vi.advanceTimersByTime(50);
      await flushMicrotasks();
      expect(collectLocalDiagnostics).not.toHaveBeenCalled();

      orchestrator.schedule(uri, { immediate: true });
      await flushMicrotasks();
      expect(collectLocalDiagnostics).toHaveBeenCalledTimes(1);

      orchestrator.clear(uri);
      deferredLocal.resolve([{ code: 'late-local' }]);
      deferredExtended.resolve([{ code: 'late-host' }]);
      await flushMicrotasks();

      expect(publishDiagnostics).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(expect.stringContaining('reason=state-cleared'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs immediately when a pending timer exists for the same uri', async () => {
    vi.useFakeTimers();
    try {
      const uri = 'file:///doc.md.templ';
      const { orchestrator, textByUri, collectLocalDiagnostics, collectExtendedDiagnostics } =
        createHarness({ debounceMs: 100 });

      textByUri.set(uri, 'v1');
      collectLocalDiagnostics.mockReturnValue([{ code: 'local-v1' }]);
      collectExtendedDiagnostics.mockReturnValue([{ code: 'host-v1' }]);

      orchestrator.schedule(uri);
      orchestrator.schedule(uri, { immediate: true });
      await flushMicrotasks();

      expect(collectLocalDiagnostics).toHaveBeenCalledTimes(1);
      expect(collectExtendedDiagnostics).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      await flushMicrotasks();
      expect(collectLocalDiagnostics).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears a pending timer for an existing uri without running diagnostics', async () => {
    vi.useFakeTimers();
    try {
      const uri = 'file:///doc.md.templ';
      const { orchestrator, textByUri, collectLocalDiagnostics, collectExtendedDiagnostics } =
        createHarness({ debounceMs: 100 });

      textByUri.set(uri, 'v1');
      orchestrator.schedule(uri);
      orchestrator.clear(uri);

      vi.advanceTimersByTime(100);
      await flushMicrotasks();

      expect(collectLocalDiagnostics).not.toHaveBeenCalled();
      expect(collectExtendedDiagnostics).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips runs when the document text is unavailable', async () => {
    const uri = 'file:///missing.md.templ';
    const {
      orchestrator,
      collectLocalDiagnostics,
      collectExtendedDiagnostics,
      publishDiagnostics,
    } = createHarness();

    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();

    expect(collectLocalDiagnostics).not.toHaveBeenCalled();
    expect(collectExtendedDiagnostics).not.toHaveBeenCalled();
    expect(publishDiagnostics).not.toHaveBeenCalled();
  });

  it('drops stale commits from an older revision after a newer run completes', async () => {
    const uri = 'file:///doc.md.templ';
    const log = vi.fn();
    const deferredLocal = createDeferred<TestDiagnostic[]>();
    const deferredExtended = createDeferred<TestDiagnostic[]>();
    const { orchestrator, textByUri, collectLocalDiagnostics, collectExtendedDiagnostics } =
      createHarness({ log });

    textByUri.set(uri, 'v1');
    collectLocalDiagnostics.mockReturnValueOnce(deferredLocal.promise as Promise<TestDiagnostic[]>);
    collectExtendedDiagnostics.mockReturnValueOnce(
      deferredExtended.promise as Promise<TestDiagnostic[]>
    );
    collectLocalDiagnostics.mockReturnValueOnce([{ code: 'local-v2' }]);
    collectExtendedDiagnostics.mockReturnValueOnce([{ code: 'host-v2' }]);

    orchestrator.schedule(uri, { immediate: true });
    textByUri.set(uri, 'v2');
    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();

    deferredLocal.resolve([{ code: 'local-v1' }]);
    deferredExtended.resolve([{ code: 'host-v1' }]);
    await flushMicrotasks();

    expect(log).toHaveBeenCalledWith(expect.stringContaining('reason=stale'));
  });

  it('publishes local diagnostics before publishing merged diagnostics when extended resolves first', async () => {
    const uri = 'file:///doc.md.templ';
    const deferredLocal = createDeferred<TestDiagnostic[]>();
    const deferredExtended = createDeferred<TestDiagnostic[]>();
    const {
      orchestrator,
      textByUri,
      publishDiagnostics,
      collectLocalDiagnostics,
      collectExtendedDiagnostics,
    } = createHarness();

    textByUri.set(uri, 'v1');
    collectLocalDiagnostics.mockReturnValueOnce(deferredLocal.promise as Promise<TestDiagnostic[]>);
    collectExtendedDiagnostics.mockReturnValueOnce(
      deferredExtended.promise as Promise<TestDiagnostic[]>
    );

    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();

    deferredExtended.resolve([{ code: 'host-v1' }]);
    await flushMicrotasks();
    expect(publishDiagnostics).not.toHaveBeenCalled();

    deferredLocal.resolve([{ code: 'local-v1' }]);
    await flushMicrotasks();

    expect(publishDiagnostics).toHaveBeenNthCalledWith(1, uri, [{ code: 'local-v1' }]);
    expect(publishDiagnostics).toHaveBeenNthCalledWith(2, uri, [
      { code: 'local-v1' },
      { code: 'host-v1' },
    ]);
  });

  it('logs local and extended collection failures without publishing diagnostics', async () => {
    const uri = 'file:///doc.md.templ';
    const log = vi.fn();
    const {
      orchestrator,
      textByUri,
      collectLocalDiagnostics,
      collectExtendedDiagnostics,
      publishDiagnostics,
    } = createHarness({ log });

    textByUri.set(uri, 'v1');
    collectLocalDiagnostics.mockImplementation(() => {
      throw new Error('local exploded');
    });
    collectExtendedDiagnostics.mockRejectedValue('extended exploded');

    orchestrator.schedule(uri, { immediate: true });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(publishDiagnostics).not.toHaveBeenCalled();
    expect(
      log.mock.calls.some(
        ([message]) => message === `[templjs] Local diagnostics failed for ${uri}: local exploded`
      )
    ).toBe(true);
    expect(
      log.mock.calls.some(
        ([message]) =>
          message === `[templjs] Extended diagnostics failed for ${uri}: extended exploded`
      )
    ).toBe(true);
  });
});
