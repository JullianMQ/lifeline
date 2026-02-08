import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AppState, AppStateStatus, Platform, View, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { incidentManager, ActiveIncident } from "@/lib/services/incident_manager";
import {
    useAudioRecorder,
    RecordingPresets,
    AudioModule,
    setAudioModeAsync,
} from "expo-audio";
import { SensorContext } from "@/lib/context/sensor_context";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";

//uploader
import { uploadMediaFile } from "@/lib/services/media_upload";
import type { MediaType as UploadMediaType } from "@/lib/services/media_upload";

type UploadedMap = {
    backPhoto?: boolean;
    backVideo?: boolean;
    frontPhoto?: boolean;
    frontVideo?: boolean;
    audio?: boolean;

    backPhotoFileId?: number;
    backVideoFileId?: number;
    frontPhotoFileId?: number;
    frontVideoFileId?: number;
    audioFileId?: number;
};

type SosMediaResult = {
    id: string;
    createdAt: number;

    backPhotoPath?: string;
    backVideoPath?: string;

    frontPhotoPath?: string;
    frontVideoPath?: string;

    audioPath?: string;

    //upload tracking for outbox retries
    uploaded?: UploadedMap;
};

type Ctx = {
    triggerSOSCapture: () => Promise<SosMediaResult | null>;
    processOutbox: () => Promise<void>;
    isCapturing: boolean;
};

const SosMediaContext = createContext<Ctx | null>(null);

export function useSosMedia() {
    const ctx = useContext(SosMediaContext);
    if (!ctx) throw new Error("useSosMedia must be used within SosMediaProvider");
    return ctx;
}

const OUTBOX_KEY = "SOS_OUTBOX_V1";

async function getOutbox(): Promise<SosMediaResult[]> {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as SosMediaResult[]) : [];
}

async function saveOutbox(list: SosMediaResult[]) {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
}

function withDefaultUploaded(item: SosMediaResult): SosMediaResult {
    return {
        ...item,
        uploaded: item.uploaded ?? {
            backPhoto: false,
            backVideo: false,
            frontPhoto: false,
            frontVideo: false,
            audio: false,
        },
    };
}

async function addToOutbox(item: SosMediaResult) {
    const list = await getOutbox();
    list.unshift(withDefaultUploaded(item));
    await saveOutbox(list);
}

function makeId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getBaseDirectory(): string {
    const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    if (!base) throw new Error("No FileSystem base directory available.");
    return base;
}

function isConfirmedIncident(inc: ActiveIncident) {
    return (
        inc.reason === "FALL_CONFIRMED" ||
        inc.reason === "CRASH_CONFIRMED" ||
        inc.reason === "EMERGENCY_CONFIRMED"
    );
}

function isForegroundish() {
    const s = AppState.currentState;
    return s === "active" || s === "unknown";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fmtErr(e: unknown) {
    if (e instanceof Error) {
        return { name: e.name, message: e.message, stack: e.stack };
    }
    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
}

function sosLog(...args: any[]) {
    console.log(`[SOS_MEDIA ${new Date().toISOString()}]`, ...args);
}

async function shareIfPossible(uri?: string, label?: string) {
    if (!uri) return;
    try {
        const available = await Sharing.isAvailableAsync();
        if (!available) return;
        await Sharing.shareAsync(uri, { dialogTitle: label ?? "Share file" });
    } catch {
        // ignore
    }
}

export function SosMediaProvider({ children }: { children: React.ReactNode }) {
    const cameraRef = useRef<CameraView | null>(null);
    const cameraReadyRef = useRef(false);

    const [cameraFacing, setCameraFacing] = useState<"back" | "front">("back");
    const cameraFacingRef = useRef<"back" | "front">("back");
    useEffect(() => {
        cameraFacingRef.current = cameraFacing;
    }, [cameraFacing]);

    const [cameraMode, setCameraMode] = useState<"video" | "picture">("video");
    const cameraModeRef = useRef<"video" | "picture">("video");
    useEffect(() => {
        cameraModeRef.current = cameraMode;
    }, [cameraMode]);

    const [camPerm, requestCamPerm] = useCameraPermissions();
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const { pauseMicMetering, resumeMicMetering } = useContext(SensorContext);

    const [isCapturing, setIsCapturing] = useState(false);
    const lastCapturedIncidentIdRef = useRef<string | null>(null);

    // Force-remount key for CameraView (helps when front video gets stuck in a bad CameraX session)
    const [cameraInstanceKey, setCameraInstanceKey] = useState(0);
    const bumpCameraInstance = useCallback(() => {
        setCameraInstanceKey((k) => k + 1);
    }, []);

    useEffect(() => {
        (async () => {
            if (Platform.OS !== "android") return;
            try {
                const res = camPerm?.granted ? camPerm : await requestCamPerm();
                void res;
            } catch {
                // ignore
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const promptOpenSettingsForCamera = useCallback(() => {
        Alert.alert(
            "Camera Permission Needed",
            "To record SOS media, enable Camera permission in Settings.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings().catch(() => { }) },
            ]
        );
    }, []);

    const ensurePermissions = useCallback(async () => {
        if (Platform.OS !== "android") return false;

        const camStatus = camPerm ?? (await requestCamPerm());
        const camGranted = camStatus.granted;

        const mic = await AudioModule.requestRecordingPermissionsAsync();
        const micGranted = mic.granted;

        await setAudioModeAsync({ allowsRecording: true });

        if (!camGranted && camStatus.canAskAgain === false) {
            promptOpenSettingsForCamera();
        }

        sosLog("ensurePermissions", { camGranted, micGranted, canAskAgain: camStatus.canAskAgain });

        return camGranted && micGranted;
    }, [camPerm, requestCamPerm, promptOpenSettingsForCamera]);

    const waitForCameraReady = useCallback(async (timeoutMs: number) => {
        const start = Date.now();
        while (!cameraReadyRef.current) {
            if (Date.now() - start > timeoutMs) {
                sosLog("waitForCameraReady: timeout", {
                    timeoutMs,
                    facing: cameraFacingRef.current,
                    mode: cameraModeRef.current,
                });
                return false;
            }
            await sleep(60);
        }
        return true;
    }, []);

    const setFacingAndWait = useCallback(
        async (facing: "back" | "front", timeoutMs = 5000) => {
            sosLog("setFacingAndWait: requested", { from: cameraFacingRef.current, to: facing });

            if (cameraFacingRef.current === facing) {
                sosLog("setFacingAndWait: already", { facing });
                return true;
            }

            cameraReadyRef.current = false;
            setCameraFacing(facing);

            // Front camera session switches can be slower on some devices
            await sleep(facing === "front" ? 900 : 300);

            const ok = await waitForCameraReady(timeoutMs);
            sosLog("setFacingAndWait: done", { facing, ok });
            return ok;
        },
        [waitForCameraReady]
    );

    const setModeAndWait = useCallback(
        async (mode: "video" | "picture", timeoutMs = 5000) => {
            sosLog("setModeAndWait: requested", { from: cameraModeRef.current, to: mode });

            if (cameraModeRef.current === mode) {
                sosLog("setModeAndWait: already", { mode });
                return true;
            }

            cameraReadyRef.current = false;
            setCameraMode(mode);

            await sleep(300);

            const ok = await waitForCameraReady(timeoutMs);
            sosLog("setModeAndWait: done", { mode, ok });
            return ok;
        },
        [waitForCameraReady]
    );

    const takePhoto = useCallback(async (): Promise<string | undefined> => {
        sosLog("takePhoto: start", {
            facing: cameraFacingRef.current,
            mode: cameraModeRef.current,
            hasRef: !!cameraRef.current,
        });

        if (!cameraRef.current) return undefined;

        const okMode = await setModeAndWait("picture", 8000);
        if (!okMode || !cameraRef.current) {
            sosLog("takePhoto: failed to set picture mode", { okMode, hasRef: !!cameraRef.current });
            return undefined;
        }

        const okReady = await waitForCameraReady(8000);
        if (!okReady || !cameraRef.current) {
            sosLog("takePhoto: not ready", { okReady });
            return undefined;
        }

        try {
            await sleep(350);

            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.9,
                skipProcessing: true,
            });

            const uri = photo?.uri;
            sosLog("takePhoto: result", { uri });

            if (!uri) return undefined;

            try {
                const info = await FileSystem.getInfoAsync(uri);
                sosLog("takePhoto: file info", { uri, exists: info.exists, size: (info as any).size });
                if (!info.exists) return undefined;
                if (typeof (info as any).size === "number" && (info as any).size === 0) return undefined;
            } catch (e) {
                sosLog("takePhoto: getInfoAsync failed", fmtErr(e));
            }

            return uri;
        } catch (e) {
            sosLog("takePhoto: FAILED", fmtErr(e));
            return undefined;
        }
    }, [setModeAndWait, waitForCameraReady]);

    const recordVideoOnce = useCallback(
        async (ms: number): Promise<string | undefined> => {
            sosLog("recordVideoOnce: start", {
                ms,
                facing: cameraFacingRef.current,
                mode: cameraModeRef.current,
                hasRef: !!cameraRef.current,
            });

            if (!cameraRef.current) return undefined;

            const okMode = await setModeAndWait("video", 10000);
            sosLog("recordVideoOnce: setMode video", { okMode, facing: cameraFacingRef.current });
            if (!okMode || !cameraRef.current) return undefined;

            const okReady = await waitForCameraReady(10000);
            sosLog("recordVideoOnce: waitForCameraReady", { okReady, facing: cameraFacingRef.current });
            if (!okReady || !cameraRef.current) return undefined;

            try {
                // Give extra settle time for front camera before recording
                await sleep(cameraFacingRef.current === "front" ? 900 : 300);

                sosLog("recordVideoOnce: calling recordAsync", { facing: cameraFacingRef.current });

                const recPromise = cameraRef.current.recordAsync();

                await sleep(400);
                await sleep(ms);

                sosLog("recordVideoOnce: calling stopRecording", { facing: cameraFacingRef.current });
                try {
                    cameraRef.current.stopRecording();
                } catch (e) {
                    sosLog("recordVideoOnce: stopRecording threw", fmtErr(e));
                }

                const res = await recPromise;
                sosLog("recordVideoOnce: recordAsync resolved", { res });

                const uri = res?.uri;
                if (!uri) return undefined;

                const info = await FileSystem.getInfoAsync(uri);
                sosLog("recordVideoOnce: file info", {
                    uri,
                    exists: info.exists,
                    size: (info as any).size,
                });

                if (!info.exists) return undefined;
                if (typeof (info as any).size === "number" && (info as any).size === 0) return undefined;

                return uri;
            } catch (e) {
                sosLog("recordVideoOnce: FAILED", {
                    facing: cameraFacingRef.current,
                    mode: cameraModeRef.current,
                    error: fmtErr(e),
                });
                return undefined;
            }
        },
        [setModeAndWait, waitForCameraReady]
    );

    const recordVideoForMs = useCallback(
        async (ms: number): Promise<string | undefined> => {
            const facing = cameraFacingRef.current;
            let uri = await recordVideoOnce(ms);

            if (uri) return uri;

            if (facing === "front") {
                sosLog("recordVideoForMs: front failed, retrying with camera remount");

                bumpCameraInstance();
                cameraReadyRef.current = false;

                await sleep(1200);
                await waitForCameraReady(12000);

                // Ensure front + video before retry
                await setFacingAndWait("front", 12000);
                await setModeAndWait("video", 12000);

                uri = await recordVideoOnce(ms);
                return uri;
            }

            return undefined;
        },
        [recordVideoOnce, bumpCameraInstance, setFacingAndWait, setModeAndWait, waitForCameraReady]
    );

    // Outbox processing (uploads)
    const isProcessingOutboxRef = useRef(false);

    const processOutbox = useCallback(async () => {
        sosLog("processOutbox: start");
        const list = await getOutbox();
        sosLog("processOutbox: loaded", { count: list.length, ids: list.map(x => x.id) });

        if (Platform.OS !== "android") return;
        if (isProcessingOutboxRef.current) return;

        isProcessingOutboxRef.current = true;

        try {
            const list = await getOutbox();
            if (!list.length) return;

            const remaining: SosMediaResult[] = [];

            const uploadOne = async (
                item: SosMediaResult,
                key: "backPhoto" | "frontPhoto" | "backVideo" | "frontVideo" | "audio",
                path: string | undefined,
                mediaType: UploadMediaType
            ) => {
                const up = item.uploaded!;
                if (up[key] === true) return;
                if (!path) {
                    up[key] = true; // nothing to upload
                    return;
                }

                // If file is missing, mark done so it doesn't block the queue forever
                try {
                    const info = await FileSystem.getInfoAsync(path);
                    if (!info.exists) {
                        sosLog("processOutbox: file missing, marking done", { key, path });
                        up[key] = true;
                        return;
                    }
                } catch {
                    // ignore; still try upload
                }

                const res = await uploadMediaFile({
                    fileUri: path,
                    mediaType,
                    description: `SOS ${item.id} ${key}`,
                    // attachCookieFromStoredToken default true in uploader (recommended)
                });

                if (!res.success) {
                    // throw to keep item in outbox for retry
                    throw new Error(res.error);
                }

                up[key] = true;

                // store server file id (optional)
                if (key === "backPhoto") up.backPhotoFileId = res.file.id;
                if (key === "frontPhoto") up.frontPhotoFileId = res.file.id;
                if (key === "backVideo") up.backVideoFileId = res.file.id;
                if (key === "frontVideo") up.frontVideoFileId = res.file.id;
                if (key === "audio") up.audioFileId = res.file.id;
            };

            for (const raw of list) {
                const item = withDefaultUploaded(raw);

                try {
                    await uploadOne(item, "backPhoto", item.backPhotoPath, "picture");
                    await uploadOne(item, "frontPhoto", item.frontPhotoPath, "picture");
                    await uploadOne(item, "backVideo", item.backVideoPath, "video");
                    await uploadOne(item, "frontVideo", item.frontVideoPath, "video");
                    await uploadOne(item, "audio", item.audioPath, "voice_recording");
                } catch (e) {
                    sosLog("outbox upload failed; will retry", fmtErr(e));
                    remaining.push(item);
                    continue;
                }

                // If all keys are done, drop item from outbox
                const up = item.uploaded!;
                const done =
                    up.backPhoto === true &&
                    up.frontPhoto === true &&
                    up.backVideo === true &&
                    up.frontVideo === true &&
                    up.audio === true;

                if (!done) remaining.push(item);
            }

            await saveOutbox(remaining);
        } finally {
            isProcessingOutboxRef.current = false;
        }
    }, []);

    const triggerSOSCapture = useCallback(async (): Promise<SosMediaResult | null> => {
        if (Platform.OS !== "android") return null;
        if (isCapturing) return null;

        const ok = await ensurePermissions();
        if (!ok) return null;

        setIsCapturing(true);

        const id = makeId();
        const createdAt = Date.now();

        const base = getBaseDirectory();
        const baseDir = `${base}sos/`;
        await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

        const finalBackVideo = `${baseDir}sos-back-video-${id}.mp4`;
        const finalBackPhoto = `${baseDir}sos-back-photo-${id}.jpg`;

        const finalFrontVideo = `${baseDir}sos-front-video-${id}.mp4`;
        const finalFrontPhoto = `${baseDir}sos-front-photo-${id}.jpg`;

        const finalAudio = `${baseDir}sos-audio-${id}.m4a`;

        let backVideoTmp: string | undefined;
        let backPhotoTmp: string | undefined;

        let frontVideoTmp: string | undefined;
        let frontPhotoTmp: string | undefined;

        let audioTmp: string | undefined;

        sosLog("triggerSOSCapture: begin", { id, createdAt });

        try {
            await pauseMicMetering?.().catch(() => { });

            // Photos first: back then front
            await setModeAndWait("picture", 12000);

            await setFacingAndWait("back", 12000);
            backPhotoTmp = await takePhoto();
            sosLog("backPhotoTmp", { backPhotoTmp });

            await setFacingAndWait("front", 12000);
            frontPhotoTmp = await takePhoto();
            sosLog("frontPhotoTmp", { frontPhotoTmp });

            // Audio recording (separate, not concurrent with video)
            try {
                await recorder.prepareToRecordAsync();
                await recorder.record();
                sosLog("audio: started");
                await sleep(3200);
                await recorder.stop();
                audioTmp = recorder.uri ?? undefined;
                sosLog("audio: stopped", { audioTmp });
            } catch (e) {
                sosLog("audio: FAILED", fmtErr(e));
                audioTmp = recorder.uri ?? undefined;
            }

            // Videos after: back then front
            await setModeAndWait("video", 12000);

            await setFacingAndWait("back", 12000);
            backVideoTmp = await recordVideoForMs(3000);
            sosLog("backVideoTmp", { backVideoTmp });

            await setFacingAndWait("front", 12000);
            sosLog("About to record FRONT video", {
                facing: cameraFacingRef.current,
                mode: cameraModeRef.current,
                ready: cameraReadyRef.current,
            });

            frontVideoTmp = await recordVideoForMs(3000);
            sosLog("frontVideoTmp", { frontVideoTmp });

            let backVideoPath: string | undefined;
            let backPhotoPath: string | undefined;
            let frontVideoPath: string | undefined;
            let frontPhotoPath: string | undefined;
            let audioPath: string | undefined;

            if (backVideoTmp) {
                sosLog("move back video", { from: backVideoTmp, to: finalBackVideo });
                await FileSystem.moveAsync({ from: backVideoTmp, to: finalBackVideo });
                backVideoPath = finalBackVideo;
            }
            if (backPhotoTmp) {
                sosLog("move back photo", { from: backPhotoTmp, to: finalBackPhoto });
                await FileSystem.moveAsync({ from: backPhotoTmp, to: finalBackPhoto });
                backPhotoPath = finalBackPhoto;
            }
            if (frontVideoTmp) {
                sosLog("move front video", { from: frontVideoTmp, to: finalFrontVideo });
                await FileSystem.moveAsync({ from: frontVideoTmp, to: finalFrontVideo });
                frontVideoPath = finalFrontVideo;
            }
            if (frontPhotoTmp) {
                sosLog("move front photo", { from: frontPhotoTmp, to: finalFrontPhoto });
                await FileSystem.moveAsync({ from: frontPhotoTmp, to: finalFrontPhoto });
                frontPhotoPath = finalFrontPhoto;
            }
            if (audioTmp) {
                sosLog("move audio", { from: audioTmp, to: finalAudio });
                await FileSystem.moveAsync({ from: audioTmp, to: finalAudio });
                audioPath = finalAudio;
            }

            const result: SosMediaResult = withDefaultUploaded({
                id,
                createdAt,
                backPhotoPath,
                backVideoPath,
                frontPhotoPath,
                frontVideoPath,
                audioPath,
            });

            sosLog("triggerSOSCapture: result", result);

            await addToOutbox(result);

            // kick upload worker immediately (best-effort)
            processOutbox().catch(() => { });

            // Your debug sharing stays
            await shareIfPossible(result.backPhotoPath, "Back photo");
            await shareIfPossible(result.backVideoPath, "Back video");
            await shareIfPossible(result.frontPhotoPath, "Front photo");
            await shareIfPossible(result.frontVideoPath, "Front video");
            await shareIfPossible(result.audioPath, "Audio");

            return result;
        } catch (e) {
            sosLog("triggerSOSCapture: FAILED", fmtErr(e));
            return { id, createdAt };
        } finally {
            await resumeMicMetering?.().catch(() => { });
            setIsCapturing(false);

            try {
                await setFacingAndWait("back", 12000);
            } catch {
                // ignore
            }
        }
    }, [
        ensurePermissions,
        isCapturing,
        pauseMicMetering,
        resumeMicMetering,
        recorder,
        recordVideoForMs,
        takePhoto,
        setFacingAndWait,
        setModeAndWait,
        processOutbox,
    ]);

    const triggerRef = useRef(triggerSOSCapture);
    useEffect(() => {
        triggerRef.current = triggerSOSCapture;
    }, [triggerSOSCapture]);

    const tryCaptureForIncidentRef = useRef<((inc: ActiveIncident) => void) | null>(null);
    useEffect(() => {
        tryCaptureForIncidentRef.current = async (inc: ActiveIncident) => {
            if (!isConfirmedIncident(inc)) return;
            if (!isForegroundish()) return;

            if (lastCapturedIncidentIdRef.current === inc.id) return;
            lastCapturedIncidentIdRef.current = inc.id;

            const res = await triggerRef.current();
            if (!res) lastCapturedIncidentIdRef.current = null;
        };
    }, []);

    useEffect(() => {
        const unsub = incidentManager.subscribe((incident) => {
            if (!incident) {
                lastCapturedIncidentIdRef.current = null;
                return;
            }
            if (!isForegroundish()) return;

            tryCaptureForIncidentRef.current?.(incident);
        });

        return () => unsub();
    }, []);

    // run outbox once at startup
    useEffect(() => {
        processOutbox().catch(() => { });
    }, [processOutbox]);

    useEffect(() => {
        const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
            if (state === "active" || state === "unknown") {
                // Try capture if incident exists
                const inc = incidentManager.getActive();
                if (inc) tryCaptureForIncidentRef.current?.(inc);

                //also retry uploads when app becomes active
                processOutbox().catch(() => { });
            } else {
                try {
                    cameraRef.current?.stopRecording();
                } catch {
                    // ignore
                }
                recorder.stop().catch(() => { });
            }
        });

        return () => sub.remove();
    }, [recorder, processOutbox]);

    const value = useMemo(
        () => ({ triggerSOSCapture, processOutbox, isCapturing }),
        [triggerSOSCapture, processOutbox, isCapturing]
    );

    return (
        <SosMediaContext.Provider value={value}>
            {children}

            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    width: 64,
                    height: 64,
                    opacity: 0.01,
                    right: 0,
                    bottom: 0,
                }}
            >
                <CameraView
                    key={cameraInstanceKey}
                    ref={cameraRef}
                    facing={cameraFacing}
                    mode={cameraMode}
                    videoQuality="480p"
                    videoBitrate={2_000_000}
                    onCameraReady={() => {
                        cameraReadyRef.current = true;
                        sosLog("onCameraReady", {
                            facing: cameraFacingRef.current,
                            mode: cameraModeRef.current,
                            cameraInstanceKey,
                        });
                    }}
                />
            </View>
        </SosMediaContext.Provider>
    );
}
