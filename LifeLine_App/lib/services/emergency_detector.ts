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
    // NOTE: These assume accelerometer magnitude is expressed in "g" (1g ~ 9.80665 m/s^2).
    // In your current pipeline we feed TOTAL accel magnitude in g (includes gravity).
    private FREE_FALL_MAX_G = 0.3; // 0.25–0.35g is common
    private IMPACT_MIN_G = 2.2; // 2.0–3.0g fall impact candidate
    private CRASH_MIN_G = 3.0; // 3.0–6.0g crash candidate
    private CRASH_HIGH_G = 5.5; // high confidence (may saturate on low-range sensors)

    private IMPACT_WINDOW_MS = 1000; // free-fall -> impact timing window
    private STILL_WINDOW_MS = 2000; // post-impact stillness window
    // Because we use TOTAL accel magnitude (includes gravity), stillness means "near 1g" for a sustained window.
    private STILL_TARGET_G = 1.0;
    private STILL_TOL_G = 0.10; // 0.06–0.15 depending on device/noise

    // Gyro (rad/s) - use as confirmation, not as primary trigger
    private OMEGA_FALL_CONFIRM = 3.1; // strong rotation confirm
    private OMEGA_MOTION_CANDIDATE = 0.9;

    // Mic (dBFS) - use baseline + delta (since dBFS varies by device)
    private MIC_BASE_ALPHA = 0.95; // baseline EMA smoothing
    private MIC_IMPULSE_DELTA_DB = 18; // +12..+24 dB over baseline
    private MIC_SUSTAIN_DELTA_DB = 14; // sustained loudness threshold (delta over baseline); tune 12–18
    private MIC_SUSTAIN_ABS_MIN_DBFS = -32; // absolute floor for sustained loudness; tune -35..-25
    private MIC_SUSTAIN_MS = 1500; // require louder sound for longer to reduce handling-noise false positives
    private lastMicDbfs: number | null = null;
    private pendingImpulseStart: number | null = null;
    private pendingImpulsePeak: number | null = null;


    // Drop/bounce rejection
    private BOUNCE_WINDOW_MS = 800;
    private MAX_BOUNCE_IMPACTS = 1; // >1 impacts in bounce window => likely phone drop

    // ---- State ----
    private fallState: FallState = 'NORMAL';
    private tFreeFall = 0;
    private tImpact = 0;
    private sawHighRotation = false;

    private micBaselineDbfs = -50;
    private loudSustainStart: number | null = null;

    // Recent samples for stillness + bounce checks
    private recentAccel: Array<{ t: number; g: number }> = [];
    private recentImpactTimes: number[] = [];

    // Optional: keep last omega for context
    private lastOmega: number | null = null;
    // Keep last accel magnitude (total, in g) for mic gating / context
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
            MIC_IMPULSE_DELTA_DB: number;
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
        if (partial.MIC_IMPULSE_DELTA_DB != null) this.MIC_IMPULSE_DELTA_DB = partial.MIC_IMPULSE_DELTA_DB;
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
        this.lastAccelG = null;
        // Keep mic baseline; resetting it fully can cause bursts of false impulses.
    }

    public push(event: IncomingSensorEvent): DetectorEvent[] {
        const out: DetectorEvent[] = [];
        if (!event || !event.sensor) return out;

        const t = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
        const sessionId = event.sessionId;

        if (event.sensor === 'accelerometer') {
            const g = typeof event.magnitude === 'number' ? event.magnitude : null;
            if (g == null) return out;

            // keep last accel for context / gating
            this.lastAccelG = g;

            // keep recent accel (trim ~3 seconds)
            this.recentAccel.push({ t, g });
            const cutoff = t - 3500;
            while (this.recentAccel.length && this.recentAccel[0].t < cutoff) this.recentAccel.shift();

            // quick "abnormal movement" candidate (not fall/crash)
            if (g >= 1.8 && g < this.IMPACT_MIN_G) {
                out.push(this.mk('ABNORMAL_MOTION', t, sessionId, { accelG: g }));
            }

            // crash candidates
            if (g >= this.CRASH_MIN_G) {
                out.push(this.mk('CRASH_CANDIDATE', t, sessionId, { accelG: g, omega: this.lastOmega }));
                if (g >= this.CRASH_HIGH_G) {
                    out.push(this.mk('CRASH_CONFIRMED', t, sessionId, { accelG: g, omega: this.lastOmega }));
                }
            }

            // fall state machine: free-fall -> impact -> stillness
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
                    // impact
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
                // bounce/drop rejection: if multiple impacts quickly, likely phone drop/bounce
                const bounceCutoff = t - this.BOUNCE_WINDOW_MS;
                this.recentImpactTimes = this.recentImpactTimes.filter(x => x >= bounceCutoff);
                const impactCount = this.recentImpactTimes.length;

                // Wait for stillness window after the impact
                if (t - this.tImpact >= this.STILL_WINDOW_MS) {
                    const still = this.isStill(t);
                    const bounced = impactCount > this.MAX_BOUNCE_IMPACTS;

                    if (still && !bounced) {
                        // If we saw strong rotation during freefall/impact, confirm. Otherwise keep as possible.
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
            // Prefer omega if provided; else compute from x/y/z; else fall back to rotationSpeed
            let omega: number | null = null;

            if (typeof event.omega === 'number') omega = event.omega;
            else if (typeof event.x === 'number' && typeof event.y === 'number' && typeof event.z === 'number') {
                omega = Math.sqrt(event.x * event.x + event.y * event.y + event.z * event.z);
            } else if (typeof event.rotationSpeed === 'number') omega = event.rotationSpeed;

            if (omega == null) return out;
            this.lastOmega = omega;

            // during fall states, use as confirm
            if ((this.fallState === 'FREEFALL' || this.fallState === 'IMPACT') && omega >= this.OMEGA_FALL_CONFIRM) {
                this.sawHighRotation = true;
            }

            // general abnormal rotation candidate
            if (omega >= this.OMEGA_MOTION_CANDIDATE) {
                out.push(this.mk('ABNORMAL_MOTION', t, sessionId, { omega }));
            }

            return out;
        }

        if (event.sensor === 'microphone') {
            const m = typeof event.metering === 'number' ? event.metering : null;
            if (m == null) return out;

            if (m <= -150) return out; // ignore -160 sentinel

            // Update baseline slowly (only when not loud)
            if (m < this.micBaselineDbfs + 6) {
                this.micBaselineDbfs = this.MIC_BASE_ALPHA * this.micBaselineDbfs + (1 - this.MIC_BASE_ALPHA) * m;
            }

            const delta = m - this.micBaselineDbfs;

            // ---- IMPULSE (spike) detection ----
            const prev = this.lastMicDbfs;
            this.lastMicDbfs = m;

            const riseDb = prev == null ? 0 : (m - prev);

            // Start a pending impulse only if:
            // 1) loud relative to baseline, AND
            // 2) rises quickly (spike)
            const IMPULSE_RISE_DB = 12;          // tune 8–15
            const IMPULSE_MIN_DELTA = 20;        // stricter than 18 to avoid speech (tune 18–28)
            const IMPULSE_VERIFY_MS = 600;       // must drop back within this window
            const IMPULSE_DROP_DB = 10;          // drop relative to peak to confirm it's transient

            if (this.pendingImpulseStart == null) {
                if (delta >= IMPULSE_MIN_DELTA && riseDb >= IMPULSE_RISE_DB) {
                    this.pendingImpulseStart = t;
                    this.pendingImpulsePeak = m;
                }
            } else {
                // update peak while pending
                if (this.pendingImpulsePeak == null || m > this.pendingImpulsePeak) {
                    this.pendingImpulsePeak = m;
                }

                const start = this.pendingImpulseStart;
                const peak = this.pendingImpulsePeak ?? m;

                // if we dropped enough from peak quickly, confirm impulse
                if ((peak - m) >= IMPULSE_DROP_DB) {
                    out.push(this.mk('LOUD_IMPULSE', t, sessionId, {
                        metering: peak,
                        baseline: this.micBaselineDbfs,
                        delta: peak - this.micBaselineDbfs,
                        riseDb,
                        confirm: 'spike_drop',
                    }));
                    this.pendingImpulseStart = null;
                    this.pendingImpulsePeak = null;
                } else if (t - start > IMPULSE_VERIFY_MS) {
                    // timed out: it wasn't a short impulse (probably speech / sustained)
                    this.pendingImpulseStart = null;
                    this.pendingImpulsePeak = null;
                }
            }

            // ---- SUSTAINED detection (kept from previous fix) ----
            if (delta >= this.MIC_SUSTAIN_DELTA_DB && m >= this.MIC_SUSTAIN_ABS_MIN_DBFS) {
                const allowed = this.isMicSustainAllowed(this.lastAccelG, this.lastOmega);
                if (!allowed) {
                    this.loudSustainStart = null;
                    return out;
                }

                if (this.loudSustainStart == null) this.loudSustainStart = t;
                const start = this.loudSustainStart;

                if (start != null && (t - start) >= this.MIC_SUSTAIN_MS) {
                    out.push(this.mk('LOUD_SUSTAINED', t, sessionId, {
                        metering: m,
                        baseline: this.micBaselineDbfs,
                        delta,
                        sustainMs: t - start,
                    }));
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
        // Guard against false sustained triggers from handling noise:
        // if the phone is being moved/rotated a lot, sustained mic level is often friction/wind/rubbing.
        const omega = currentOmega ?? 0;
        const accelG = currentAccelG ?? 1.0;
        const accelDev = Math.abs(accelG - 1.0);

        if (omega > 1.2) return false;        // tune 1.0–1.8
        if (accelDev > 0.25) return false;    // tune 0.20–0.40
        return true;
    }

    private isStill(now: number) {
        const windowStart = now - this.STILL_WINDOW_MS;
        const samples = this.recentAccel.filter(s => s.t >= windowStart);
        if (samples.length === 0) return false;
        // With TOTAL accel magnitude, stillness means "gravity only".
        // i.e., magnitude stays close to 1g for the window.
        return samples.every(s => Math.abs(s.g - this.STILL_TARGET_G) <= this.STILL_TOL_G);
    }

    private mk(eventType: DetectorEventType, timestamp: number, sessionId?: number, meta?: Record<string, any>): DetectorEvent {
        return { sensor: 'detector', eventType, timestamp, sessionId, meta };
    }
}

// Singleton (simple default usage)
export const emergencyDetector = new EmergencyDetector();
