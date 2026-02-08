// lib/services/media_upload.ts
import { API_BASE_URL } from "../api/config";
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

    // voice_recording
    if (u.endsWith(".wav")) return "audio/wav";
    if (u.endsWith(".ogg")) return "audio/ogg";
    if (u.endsWith(".webm")) return "audio/webm";
    if (u.endsWith(".aac")) return "audio/aac";
    // NOTE: your backend lists audio/m4a + audio/x-m4a as allowed
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

/**
 * Upload a single local media file (image/video/audio) to:
 *   POST {API_BASE_URL}/api/media/upload
 *
 * Backend expects multipart/form-data:
 * - file: File
 * - media_type: "picture" | "video" | "voice_recording"
 * - description?: string
 */
export async function uploadMediaFile(params: {
    fileUri: string;
    mediaType: MediaType;
    description?: string;
    /**
     * Extra optional fields (only use if backend ignores unknown fields or you’ve added support)
     */
    metadata?: Record<string, string | number | boolean | null | undefined>;
    /**
     * If true, tries to attach Cookie header using stored token.
     * Keep enabled if your backend needs explicit cookie header in RN.
     */
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

    const name =
        mediaType === "picture"
            ? filenameFromUri(fileUri, "photo.jpg")
            : mediaType === "video"
                ? filenameFromUri(fileUri, "video.mp4")
                : filenameFromUri(fileUri, "audio.m4a");

    const primaryMime = guessMime(fileUri, mediaType);

    const form = new FormData();
    form.append("file", { uri: fileUri, type: primaryMime, name } as any);
    form.append("media_type", mediaType);
    if (description) form.append("description", description);

    if (metadata) {
        for (const [k, v] of Object.entries(metadata)) {
            if (v === undefined || v === null) continue;
            form.append(k, String(v));
        }
    }

    const headers: Record<string, string> = {
        Accept: "application/json",
        // DO NOT set Content-Type manually for multipart in RN fetch.
        // RN will set boundary correctly.
    };

    if (attachCookieFromStoredToken) {
        const token = await getToken().catch(() => null);
        // Docs show cookie name: better-auth.session_token=...
        // Only helpful if the token you stored is actually that session token.
        if (token) headers["Cookie"] = `better-auth.session_token=${token}`;
    }

    try {
        const res = await fetch(url, {
            method: "POST",
            body: form,
            credentials: "include", // include session cookie (per docs)
            headers,
        });

        const data = await safeReadJson(res);

        if (!res.ok) {
            const msg =
                (data && (data.error || data.message)) ||
                `Upload failed (HTTP ${res.status})`;

            // Voice fallback: if backend complains invalid type, flip m4a/mp4
            if (mediaType === "voice_recording") {
                const lower = String(msg).toLowerCase();
                if (res.status === 400 && lower.includes("invalid file type")) {
                    const fallbackMime =
                        primaryMime === "audio/m4a" ? "audio/mp4" : "audio/m4a";

                    const retryForm = new FormData();
                    retryForm.append("file", { uri: fileUri, type: fallbackMime, name } as any);
                    retryForm.append("media_type", mediaType);
                    if (description) retryForm.append("description", description);
                    if (metadata) {
                        for (const [k, v] of Object.entries(metadata)) {
                            if (v === undefined || v === null) continue;
                            retryForm.append(k, String(v));
                        }
                    }

                    const retryRes = await fetch(url, {
                        method: "POST",
                        body: retryForm,
                        credentials: "include",
                        headers,
                    });

                    const retryData = await safeReadJson(retryRes);

                    if (!retryRes.ok) {
                        const retryMsg =
                            (retryData && (retryData.error || retryData.message)) ||
                            `Upload failed (HTTP ${retryRes.status})`;

                        return { success: false, error: retryMsg, status: retryRes.status, details: retryData };
                    }

                    // success
                    if (retryData?.success) return retryData as MediaUploadSuccess;
                    return { success: true, file: retryData?.file } as any;
                }
            }

            return { success: false, error: msg, status: res.status, details: data };
        }

        // Success shape per docs is { success: true, file: {...} }
        if (data?.success) return data as MediaUploadSuccess;

        // If your backend returns the file directly, still treat as success
        if (data?.file) return { success: true, file: data.file } as any;

        return { success: false, error: "Upload succeeded but response format was unexpected", details: data };
    } catch (e: any) {
        return {
            success: false,
            error: e?.message || "Network error during upload",
            details: e,
        };
    }
}
