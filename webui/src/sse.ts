export type SSEEvent = { event: string; data: unknown };

export type SSEHandlers = {
  onEvent: (evt: SSEEvent) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
};

export type SSEController = {
  abort: () => void;
};

export function startSSE(url: string, handlers: SSEHandlers): SSEController {
  const abort = new AbortController();
  (async () => {
    try {
      const res = await fetch(url, { method: 'POST', signal: abort.signal });
      if (!res.ok || !res.body) {
        handlers.onError?.(new Error(`HTTP ${res.status}`));
        handlers.onClose?.();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let blockEnd: number;
        while ((blockEnd = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, blockEnd);
          buf = buf.slice(blockEnd + 2);
          if (!block.trim()) continue;
          const lines = block.split('\n');
          const evt = lines.find((l) => l.startsWith('event: '))?.slice(7) ?? 'message';
          const data = lines.find((l) => l.startsWith('data: '))?.slice(6) ?? 'null';
          try {
            handlers.onEvent({ event: evt, data: JSON.parse(data) });
          } catch (e) {
            handlers.onError?.(e as Error);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handlers.onError?.(err as Error);
      }
    } finally {
      handlers.onClose?.();
    }
  })();
  return { abort: () => abort.abort() };
}
