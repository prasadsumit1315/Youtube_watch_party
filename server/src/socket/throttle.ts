/**
 * Per-socket sliding window rate limiter.
 * Limits:
 * - General socket events: max 20 events per 10 seconds
 * - Chat events: max 5 messages per 10 seconds
 */
export class SocketThrottle {
  private generalTimestamps: number[] = [];
  private chatTimestamps: number[] = [];

  private readonly generalMax = 20;
  private readonly generalWindowMs = 10000;

  private readonly chatMax = 5;
  private readonly chatWindowMs = 10000;

  canPerformGeneral(): boolean {
    const now = Date.now();
    this.generalTimestamps = this.generalTimestamps.filter((t) => now - t < this.generalWindowMs);
    if (this.generalTimestamps.length >= this.generalMax) {
      return false;
    }
    this.generalTimestamps.push(now);
    return true;
  }

  canPerformChat(): boolean {
    const now = Date.now();
    this.chatTimestamps = this.chatTimestamps.filter((t) => now - t < this.chatWindowMs);
    if (this.chatTimestamps.length >= this.chatMax) {
      return false;
    }
    this.chatTimestamps.push(now);
    return true;
  }
}
