import { uploadRecordingChunk } from "@/lib/api/interviewPortal";

const FLUSH_INTERVAL_MS = 5_000; // send accumulated MediaRecorder data every 5 s
const FLUSH_BYTES = 1_500_000; // ...or sooner when the buffer reaches ~1.5 MB (server accepts up to 6 MB)
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 1_500;

/**
 * Sends MediaRecorder output to the portal as strictly ordered parts.
 *
 * WebM parts from one MediaRecorder session are only playable when concatenated in order, so parts
 * are uploaded one at a time with a sequence number; the server appends them to a single file and
 * rejects gaps. A failed part is retried with backoff before the next one is sent; after all
 * retries the session is marked broken and later data is dropped (the server keeps what it has).
 */
export class RecordingUploader {
  private pending: Blob[] = [];
  private pendingBytes = 0;
  private seq = 0;
  private chain: Promise<void> = Promise.resolve();
  private timer: number | null = null;
  private stopped = false;
  private broken = false;
  private failureMessage: string | null = null;

  constructor(
    private readonly token: string,
    private readonly sessionToken: string,
    private readonly mimeType: string,
    private readonly getInterruptions: () => number,
    private readonly onError?: (message: string) => void,
  ) {}

  /** MediaRecorder `dataavailable` handler. */
  push(blob: Blob): void {
    if (this.stopped || this.broken || blob.size === 0) return;
    this.pending.push(blob);
    this.pendingBytes += blob.size;
    if (this.pendingBytes >= FLUSH_BYTES) this.flush();
    else if (this.timer === null) this.timer = window.setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  /** Queue whatever is buffered as the next part. */
  flush(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending.length === 0 || this.broken) return;
    const part = new Blob(this.pending, { type: this.mimeType });
    this.pending = [];
    this.pendingBytes = 0;
    const seq = this.seq++;
    this.chain = this.chain.then(() => this.send(seq, part));
  }

  /** Stop accepting data, send the remainder and resolve when the server has everything. */
  async drain(): Promise<{ parts: number; ok: boolean; error: string | null }> {
    this.stopped = true;
    this.flush();
    await this.chain;
    return { parts: this.seq, ok: !this.broken, error: this.failureMessage };
  }

  get isBroken(): boolean {
    return this.broken;
  }

  private async send(seq: number, part: Blob): Promise<void> {
    if (this.broken) return;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await uploadRecordingChunk(this.token, this.sessionToken, seq, part, this.getInterruptions());
        return;
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        // 4xx other than a transient 409/429 will not succeed on retry (session ended, size limit, disabled)
        const permanent = status !== undefined && status >= 400 && status < 500 && status !== 409 && status !== 429;
        if (permanent || attempt === MAX_ATTEMPTS) {
          this.broken = true;
          this.failureMessage =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            (err instanceof Error ? err.message : "Upload rekaman gagal.");
          this.onError?.(this.failureMessage);
          return;
        }
        await new Promise((r) => window.setTimeout(r, RETRY_BASE_MS * attempt));
      }
    }
  }
}
