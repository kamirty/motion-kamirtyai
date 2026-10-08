/** Plays an AudioBuffer in sync with the preview (starts at a given second, stops on pause). */
export class PreviewAudio {
  private ctx: AudioContext | null = null;
  private node: AudioBufferSourceNode | null = null;

  play(buffer: AudioBuffer | null, fromSeconds: number): void {
    this.stop();
    if (!buffer) return;
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(this.ctx.destination);
    node.start(0, Math.max(0, Math.min(fromSeconds, buffer.duration)));
    this.node = node;
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
