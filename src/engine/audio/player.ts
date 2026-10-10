/**
 * Plays an AudioBuffer for the preview and serves as its master clock: the preview asks
 * `position()` for the playhead each frame, so picture follows sound and never drifts.
 */
export class PreviewAudio {
  private ctx: AudioContext | null = null;
  private node: AudioBufferSourceNode | null = null;
  private startedAt = 0;
  private offset = 0;
  private wallStart = 0;

  /** Starts playback at `fromSeconds`; resolves once the clock is running. */
  async play(buffer: AudioBuffer | null, fromSeconds: number): Promise<void> {
    this.stop();
    this.offset = Math.max(0, fromSeconds);
    this.wallStart = performance.now();
    if (!buffer) return;
    this.ctx ??= new AudioContext();
    await this.ctx.resume().catch(() => undefined);
    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(this.ctx.destination);
    // Schedule slightly ahead so the start time is exact rather than "as soon as possible".
    const when = this.ctx.currentTime + 0.05;
    node.start(when, Math.min(this.offset, buffer.duration));
    this.node = node;
    this.startedAt = when;
    this.wallStart = performance.now() + 50;
  }

  /** Seconds into the timeline, from the audio hardware clock (wall clock when silent). */
  position(): number {
    const wall = (performance.now() - this.wallStart) / 1000;
    if (this.node && this.ctx) {
      const t = this.ctx.currentTime - this.startedAt;
      // No audio output (suspended or missing device): the clock never moves, so follow wall time.
      if (this.ctx.state !== 'running' || (t <= 0 && wall > 0.4)) return this.offset + Math.max(0, wall);
      // outputLatency: what the listener hears lags what the context has rendered.
      const lat = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
      return this.offset + Math.max(0, t - lat);
    }
    return this.offset + Math.max(0, wall);
  }

  stop(): void {
    try {
      this.node?.stop();
    } catch {
      /* already stopped */
    }
    this.node?.disconnect();
    this.node = null;
  }
}
