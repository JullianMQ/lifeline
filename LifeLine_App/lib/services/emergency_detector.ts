export type DetectorEventType =
    | 'FALL_POSSIBLE'
    | 'FALL_CONFIRMED'
    | 'CRASH_CANDIDATE'
    | 'CRASH_CONFIRMED'
    | 'LOUD_IMPULSE'
    | 'LOUD_SUSTAINED'
    | 'ABNORMAL_MOTION';

export type DetectorEvent = {
    sensor: 'detector';
    eventType: DetectorEventType;
    timestamp: number;
    sessionId?: number;
    meta?: Record<string, any>;
};

type IncomingSensorEvent =
    | { sensor: 'accelerometer'; timestamp: number; sessionId?: number; magnitude?: number }
    | {
        sensor: 'gyroscope';
        timestamp: number;
        sessionId?: number;
        x?: number;
        y?: number;
        z?: number;
        omega?: number;
        rotationSpeed?: number;
    }
    | { sensor: 'microphone'; timestamp: number; sessionId?: number; metering?: number }
    | any;
type FallState = 'NORMAL' | 'FREEFALL' | 'IMPACT';

export class EmergencyDetector {
    // ---- Thresholds (starting points; tune per device/testing) ----
    private FREE_FALL_MAX_G = 0.3;
    private IMPACT_MIN_G = 2.5;
    private CRASH_MIN_G = 3.0;
    private CRASH_HIGH_G = 5.5;

    private IMPACT_WINDOW_MS = 1000;
    private STILL_WINDOW_MS = 2000;
    private STILL_TARGET_G = 1.0;
    private STILL_TOL_G = 0.10;

    // Gyro confirm
    private OMEGA_FALL_CONFIRM = 3.1;
    private OMEGA_MOTION_CANDIDATE = 0.9;

    // ABNORMAL_MOTION (Option 2): accel + recent gyro corroboration
    private MOTION_ACCEL_MIN_G = 2.1;
    private OMEGA_MOTION_CONFIRM = 1.2;
    private MOTION_GYRO_WINDOW_MS = 500;

    // Mic baseline (EMA)
    private MIC_BASE_ALPHA = 0.95;

    // Mic sustained
    private MIC_SUSTAIN_DELTA_DB = 14;
    private MIC_SUSTAIN_ABS_MIN_DBFS = -32;
    private MIC_SUSTAIN_MS = 1500;

    // ---- Mic impulse false-positive gating (IMPORTANT) ----
    // Fan/handling frequently sits around -30 to -40 dBFS on some devices.
    // Require a truly loud absolute level for impulse (clap/shout is often closer to -10..-20).
    private MIC_IMPULSE_BASELINE_FLOOR_DBFS = -60; // baseline must be >= this
    private MIC_IMPULSE_ABS_MIN_DBFS = -20;        // peak must be >= this (fan at -26 fails)
    private MIC_IMPULSE_MAX_DELTA_DB = 30;         // reject inflated deltas

    private lastMicDbfs: number | null = null;
    private pendingImpulseStart: number | null = null;
    private pendingImpulsePeak: number | null = null;

    // Drop/bounce rejection
    private BOUNCE_WINDOW_MS = 800;
    private MAX_BOUNCE_IMPACTS = 1;

    // ---- State ----
    private fallState: FallState = 'NORMAL';
    private tFreeFall = 0;
    private tImpact = 0;
    private sawHighRotation = false;

    private micBaselineDbfs = -50;
    private loudSustainStart: number | null = null;

    private recentAccel: Array<{ t: number; g: number }> = [];
    private recentImpactTimes: number[] = [];

    private lastOmega: number | null = null;
    private lastOmegaAt: number = 0;
    private lastAccelG: number | null = null;

    public setThresholds(
        partial: Partial<{
            FREE_FALL_MAX_G: number;
            IMPACT_MIN_G: number;
            CRASH_MIN_G: number;
            CRASH_HIGH_G: number;
            STILL_TARGET_G: number;
            STILL_TOL_G: number;
            OMEGA_FALL_CONFIRM: number;
            MIC_SUSTAIN_DELTA_DB: number;
            MIC_SUSTAIN_ABS_MIN_DBFS: number;
            MIC_SUSTAIN_MS: number;
        }>
    ) {
        if (partial.FREE_FALL_MAX_G != null) this.FREE_FALL_MAX_G = partial.FREE_FALL_MAX_G;
        if (partial.IMPACT_MIN_G != null) this.IMPACT_MIN_G = partial.IMPACT_MIN_G;
        if (partial.CRASH_MIN_G != null) this.CRASH_MIN_G = partial.CRASH_MIN_G;
        if (partial.CRASH_HIGH_G != null) this.CRASH_HIGH_G = partial.CRASH_HIGH_G;
        if (partial.STILL_TARGET_G != null) this.STILL_TARGET_G = partial.STILL_TARGET_G;
        if (partial.STILL_TOL_G != null) this.STILL_TOL_G = partial.STILL_TOL_G;
        if (partial.OMEGA_FALL_CONFIRM != null) this.OMEGA_FALL_CONFIRM = partial.OMEGA_FALL_CONFIRM;
        if (partial.MIC_SUSTAIN_DELTA_DB != null) this.MIC_SUSTAIN_DELTA_DB = partial.MIC_SUSTAIN_DELTA_DB;
        if (partial.MIC_SUSTAIN_ABS_MIN_DBFS != null) this.MIC_SUSTAIN_ABS_MIN_DBFS = partial.MIC_SUSTAIN_ABS_MIN_DBFS;
        if (partial.MIC_SUSTAIN_MS != null) this.MIC_SUSTAIN_MS = partial.MIC_SUSTAIN_MS;
    }

    public reset() {
        this.fallState = 'NORMAL';
        this.tFreeFall = 0;
        this.tImpact = 0;
        this.sawHighRotation = false;
        this.loudSustainStart = null;
        this.recentAccel = [];
        this.recentImpactTimes = [];
        this.lastOmega = null;
        this.lastOmegaAt = 0;
        this.lastAccelG = null;
        // Keep mic baseline to avoid false bursts.
        this.pendingImpulseStart = null;
        this.pendingImpulsePeak = null;
        this.lastMicDbfs = null;
    }

    public push(event: IncomingSensorEvent): DetectorEvent[] {
        const out: DetectorEvent[] = [];
        if (!event || !event.sensor) return out;

        const t = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
        const sessionId = event.sessionId;

        if (event.sensor === 'accelerometer') {
            const g = typeof event.magnitude === 'number' ? event.magnitude : null;
            if (g == null) return out;

            this.lastAccelG = g;

            this.recentAccel.push({ t, g });
            const cutoff = t - 3500;
            while (this.recentAccel.length && this.recentAccel[0].t < cutoff) this.recentAccel.shift();

            // ABNORMAL_MOTION Option 2: accel spike + fresh gyro corroboration
            if (g >= this.MOTION_ACCEL_MIN_G && g < this.IMPACT_MIN_G) {
                const omega = this.lastOmega;
                const omegaFresh =
                    omega != null &&
                    omega >= this.OMEGA_MOTION_CONFIRM &&
                    (t - this.lastOmegaAt) <= this.MOTION_GYRO_WINDOW_MS;

                if (omegaFresh) {
                    out.push(
                        this.mk('ABNORMAL_MOTION', t, sessionId, {
                            accelG: g,
                            omega,
                            omegaAgeMs: t - this.lastOmegaAt,
                        })
                    );
                }
            }

            // crash candidates
            if (g >= this.CRASH_MIN_G) {
                out.push(this.mk('CRASH_CANDIDATE', t, sessionId, { accelG: g, omega: this.lastOmega }));
                if (g >= this.CRASH_HIGH_G) {
                    out.push(this.mk('CRASH_CONFIRMED', t, sessionId, { accelG: g, omega: this.lastOmega }));
                }
            }

            // fall state machine
            if (this.fallState === 'NORMAL') {
                if (g < this.FREE_FALL_MAX_G) {
                    this.fallState = 'FREEFALL';
                    this.tFreeFall = t;
                    this.sawHighRotation = false;
                }
                return out;
            }

            if (this.fallState === 'FREEFALL') {
                if (t - this.tFreeFall > this.IMPACT_WINDOW_MS) {
                    this.fallState = 'NORMAL';
                    return out;
                }
                if (g >= this.IMPACT_MIN_G) {
                    this.fallState = 'IMPACT';
                    this.tImpact = t;

                    this.recentImpactTimes.push(t);
                    const bounceCutoff = t - this.BOUNCE_WINDOW_MS;
                    this.recentImpactTimes = this.recentImpactTimes.filter(x => x >= bounceCutoff);

                    out.push(this.mk('FALL_POSSIBLE', t, sessionId, { accelG: g, omega: this.lastOmega }));
                }
                return out;
            }

            if (this.fallState === 'IMPACT') {
                const bounceCutoff = t - this.BOUNCE_WINDOW_MS;
                this.recentImpactTimes = this.recentImpactTimes.filter(x => x >= bounceCutoff);
                const impactCount = this.recentImpactTimes.length;

                if (t - this.tImpact >= this.STILL_WINDOW_MS) {
                    const still = this.isStill(t);
                    const bounced = impactCount > this.MAX_BOUNCE_IMPACTS;

                    if (still && !bounced) {
                        if (this.sawHighRotation) {
                            out.push(
                                this.mk('FALL_CONFIRMED', t, sessionId, {
                                    stillWindowMs: this.STILL_WINDOW_MS,
                                    stillTargetG: this.STILL_TARGET_G,
                                    stillTolG: this.STILL_TOL_G,
                                    impactsInBounceWindow: impactCount,
                                })
                            );
                        } else {
                            out.push(
                                this.mk('FALL_POSSIBLE', t, sessionId, {
                                    reason: 'stillness_met_no_high_rotation',
                                    impactsInBounceWindow: impactCount,
                                })
                            );
                        }
                    }

                    this.fallState = 'NORMAL';
                }
                return out;
            }

            return out;
        }

        if (event.sensor === 'gyroscope') {
            let omega: number | null = null;

            if (typeof event.omega === 'number') omega = event.omega;
            else if (typeof event.x === 'number' && typeof event.y === 'number' && typeof event.z === 'number') {
                omega = Math.sqrt(event.x * event.x + event.y * event.y + event.z * event.z);
            } else if (typeof event.rotationSpeed === 'number') omega = event.rotationSpeed;

            if (omega == null) return out;

            this.lastOmega = omega;
            this.lastOmegaAt = t;

            if ((this.fallState === 'FREEFALL' || this.fallState === 'IMPACT') && omega >= this.OMEGA_FALL_CONFIRM) {
                this.sawHighRotation = true;
            }

            // No ABNORMAL_MOTION from gyro alone (Option 2)
            return out;
        }

        if (event.sensor === 'microphone') {
            const m = typeof event.metering === 'number' ? event.metering : null;
            if (m == null) return out;

            if (m <= -150) return out;

            // Update baseline slowly (only when not loud)
            if (m < this.micBaselineDbfs + 6) {
                this.micBaselineDbfs = this.MIC_BASE_ALPHA * this.micBaselineDbfs + (1 - this.MIC_BASE_ALPHA) * m;
            }

            const delta = m - this.micBaselineDbfs;

            // ---- IMPULSE detection (spike) with strict gating ----
            const prev = this.lastMicDbfs;
            this.lastMicDbfs = m;

            const riseDb = prev == null ? 0 : (m - prev);

            const IMPULSE_RISE_DB = 8;     // must be a real rise
            const IMPULSE_MIN_DELTA = 18;  // relative to baseline
            const IMPULSE_VERIFY_MS = 600; // must drop within this
            const IMPULSE_DROP_DB = 10;    // drop relative to peak

            const baselineOk = this.micBaselineDbfs >= this.MIC_IMPULSE_BASELINE_FLOOR_DBFS;
            const absOkNow = m >= this.MIC_IMPULSE_ABS_MIN_DBFS;
            const deltaOkNow = delta <= this.MIC_IMPULSE_MAX_DELTA_DB;

            const canStartImpulse =
                prev != null &&
                m > prev &&                    // ensures rise direction
                riseDb >= IMPULSE_RISE_DB &&   // ensures enough rise
                baselineOk &&
                absOkNow &&
                deltaOkNow &&
                delta >= IMPULSE_MIN_DELTA;

            if (this.pendingImpulseStart == null) {
                if (canStartImpulse) {
                    this.pendingImpulseStart = t;
                    this.pendingImpulsePeak = m;
                }
            } else {
                if (this.pendingImpulsePeak == null || m > this.pendingImpulsePeak) {
                    this.pendingImpulsePeak = m;
                }

                const start = this.pendingImpulseStart;
                const peak = this.pendingImpulsePeak ?? m;

                // Confirm if we dropped enough from peak quickly
                if ((peak - m) >= IMPULSE_DROP_DB) {
                    const peakDelta = peak - this.micBaselineDbfs;

                    const peakAbsOk = peak >= this.MIC_IMPULSE_ABS_MIN_DBFS;
                    const peakDeltaOk = peakDelta >= IMPULSE_MIN_DELTA && peakDelta <= this.MIC_IMPULSE_MAX_DELTA_DB;
                    const peakBaselineOk = baselineOk;

                    if (peakAbsOk && peakDeltaOk && peakBaselineOk) {
                        out.push(
                            this.mk('LOUD_IMPULSE', t, sessionId, {
                                metering: peak,
                                baseline: this.micBaselineDbfs,
                                delta: peakDelta,
                                riseDb,
                                confirm: 'spike_drop',
                            })
                        );
                    }

                    this.pendingImpulseStart = null;
                    this.pendingImpulsePeak = null;
                } else if (t - start > IMPULSE_VERIFY_MS) {
                    // not a transient impulse; drop it
                    this.pendingImpulseStart = null;
                    this.pendingImpulsePeak = null;
                }
            }

            // ---- SUSTAINED detection ----
            if (delta >= this.MIC_SUSTAIN_DELTA_DB && m >= this.MIC_SUSTAIN_ABS_MIN_DBFS) {
                const allowed = this.isMicSustainAllowed(this.lastAccelG, this.lastOmega);
                if (!allowed) {
                    this.loudSustainStart = null;
                    return out;
                }

                if (this.loudSustainStart == null) this.loudSustainStart = t;
                const start = this.loudSustainStart;

                if (start != null && (t - start) >= this.MIC_SUSTAIN_MS) {
                    out.push(
                        this.mk('LOUD_SUSTAINED', t, sessionId, {
                            metering: m,
                            baseline: this.micBaselineDbfs,
                            delta,
                            sustainMs: t - start,
                        })
                    );
                    this.loudSustainStart = t;
                }
            } else {
                this.loudSustainStart = null;
            }

            return out;
        }

        return out;
    }

    private isMicSustainAllowed(currentAccelG: number | null, currentOmega: number | null) {
        const omega = currentOmega ?? 0;
        const accelG = currentAccelG ?? 1.0;
        const accelDev = Math.abs(accelG - 1.0);

        if (omega > 1.2) return false;
        if (accelDev > 0.25) return false;
        return true;
    }

    private isStill(now: number) {
        const windowStart = now - this.STILL_WINDOW_MS;
        const samples = this.recentAccel.filter(s => s.t >= windowStart);
        if (samples.length === 0) return false;
        return samples.every(s => Math.abs(s.g - this.STILL_TARGET_G) <= this.STILL_TOL_G);
    }

    private mk(eventType: DetectorEventType, timestamp: number, sessionId?: number, meta?: Record<string, any>): DetectorEvent {
        return { sensor: 'detector', eventType, timestamp, sessionId, meta };
    }
}

export const emergencyDetector = new EmergencyDetector();