// lib/services/media_upload.ts
import { API_BASE_URL, SESSION_COOKIE_NAME } from "../api/config";
import { getToken } from "../api/storage/user";

export type MediaType = "picture" | "video" | "voice_recording";

export type MediaUploadSuccess = {
    success: true;
    file: {
        id: number;
        drive_file_id: string;
        file_name: string;
        original_name: string;
        mime_type: string;
        media_type: MediaType;
        file_size: number;
        web_view_link: string;
        web_content_link: string;
        description?: string | null;
        createdAt: string;
    };
};

export type MediaUploadFailure = {
    success: false;
    error: string;
    status?: number;
    details?: any;
};

export type MediaUploadResponse = MediaUploadSuccess | MediaUploadFailure;

function filenameFromUri(uri: string, fallback: string) {
    const clean = uri.split("?")[0];
    const name = clean.slice(clean.lastIndexOf("/") + 1);
    return name && name.includes(".") ? name : fallback;
}

function guessMime(uri: string, kind: MediaType) {
    const u = uri.toLowerCase().split("?")[0];

    if (kind === "picture") {
        if (u.endsWith(".png")) return "image/png";
        if (u.endsWith(".webp")) return "image/webp";
        if (u.endsWith(".gif")) return "image/gif";
        if (u.endsWith(".heic")) return "image/heic";
        if (u.endsWith(".heif")) return "image/heif";
        return "image/jpeg";
    }

    if (kind === "video") {
        if (u.endsWith(".webm")) return "video/webm";
        if (u.endsWith(".mov")) return "video/quicktime";
        if (u.endsWith(".avi")) return "video/x-msvideo";
        if (u.endsWith(".3gp")) return "video/3gpp";
        return "video/mp4";
    }

    if (u.endsWith(".wav")) return "audio/wav";
    if (u.endsWith(".ogg")) return "audio/ogg";
    if (u.endsWith(".webm")) return "audio/webm";
    if (u.endsWith(".aac")) return "audio/aac";
    if (u.endsWith(".m4a")) return "audio/m4a";
    if (u.endsWith(".mp3")) return "audio/mpeg";
    if (u.endsWith(".mp4")) return "audio/mp4";
    return "audio/m4a";
}

async function safeReadJson(res: Response) {
    const text = await res.text().catch(() => "");
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

// Small helper: build a timeout-abortable fetch
async function fetchWithTimeout(
    input: RequestInfo,
    init: RequestInit,
    timeoutMs: number
) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(input, { ...init, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(t);
    }
}

export async function uploadMediaFile(params: {
    fileUri: string;
    mediaType: MediaType;
    description?: string;
    metadata?: Record<string, string | number | boolean | null | undefined>;
    attachCookieFromStoredToken?: boolean;
}): Promise<MediaUploadResponse> {
    const {
        fileUri,
        mediaType,
        description,
        metadata,
        attachCookieFromStoredToken = true,
    } = params;

    const url = `${API_BASE_URL}/api/media/upload`;
    const timeoutMs = 45_000;

    const name =
        mediaType === "picture"
            ? filenameFromUri(fileUri, "photo.jpg")
            : mediaType === "video"
                ? filenameFromUri(fileUri, "video.mp4")
                : filenameFromUri(fileUri, "audio.m4a");

    const primaryMime = guessMime(fileUri, mediaType);

    const buildForm = (mime: string) => {
        const form = new FormData();
        form.append("file", { uri: fileUri, type: mime, name } as any);
        form.append("media_type", mediaType);
        if (description) form.append("description", description);

        if (metadata) {
            for (const [k, v] of Object.entries(metadata)) {
                if (v === undefined || v === null) continue;
                form.append(k, String(v));
            }
        }
        return form;
    };

    const headers: Record<string, string> = {
        Accept: "application/json",
    };

    if (attachCookieFromStoredToken) {
        const token = await getToken().catch(() => null);
        if (token) headers["Cookie"] = `${SESSION_COOKIE_NAME}=${token}`;
    }

    try {
        // MAIN UPLOAD (timeout protected)
        const res = await fetchWithTimeout(
            url,
            {
                method: "POST",
                body: buildForm(primaryMime),
                credentials: "include",
                headers,
            },
            timeoutMs
        );

        const data = await safeReadJson(res);

        if (!res.ok) {
            const msg =
                (data && (data.error || data.message)) ||
                `Upload failed (HTTP ${res.status})`;

            // Voice fallback retry on invalid type
            if (mediaType === "voice_recording") {
                const lower = String(msg).toLowerCase();
                if (res.status === 400 && lower.includes("invalid file type")) {
                    const fallbackMime =
                        primaryMime === "audio/m4a" ? "audio/mp4" : "audio/m4a";

                    const retryRes = await fetchWithTimeout(
                        url,
                        {
                            method: "POST",
                            body: buildForm(fallbackMime),
                            credentials: "include",
                            headers,
                        },
                        timeoutMs
                    );

                    const retryData = await safeReadJson(retryRes);

                    if (!retryRes.ok) {
                        const retryMsg =
                            (retryData && (retryData.error || retryData.message)) ||
                            `Upload failed (HTTP ${retryRes.status})`;
                        return {
                            success: false,
                            error: retryMsg,
                            status: retryRes.status,
                            details: retryData,
                        };
                    }

                    // ensure success+file exists
                    if (retryData?.success === true && retryData?.file) {
                        return retryData as MediaUploadSuccess;
                    }

                    // If backend returns file directly on success
                    if (retryData?.file) {
                        return { success: true, file: retryData.file } as MediaUploadSuccess;
                    }

                    return {
                        success: false,
                        error: "Upload succeeded but response missing file (retry)",
                        details: retryData,
                    };
                }
            }

            return { success: false, error: msg, status: res.status, details: data };
        }

        // ensure success+file exists
        if (data?.success === true && data?.file) return data as MediaUploadSuccess;

        if (data?.file) return { success: true, file: data.file } as MediaUploadSuccess;

        return {
            success: false,
            error: "Upload succeeded but response format was unexpected",
            details: data,
        };
    } catch (e: any) {
        const isAbort =
            e?.name === "AbortError" ||
            String(e?.message || "").toLowerCase().includes("abort");

        if (isAbort) {
            return {
                success: false,
                error: `Upload timed out after ${Math.round(timeoutMs / 1000)}s`,
                details: e,
            };
        }

        return {
            success: false,
            error: e?.message || "Network error during upload",
            details: e,
        };
    }
}
