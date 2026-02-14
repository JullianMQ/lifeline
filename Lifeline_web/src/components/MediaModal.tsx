import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { clearMediaCache, isMediaCacheBypassActive } from "../scripts/mediaCache";
import { clearBlobCache, getCachedBlob, setCachedBlob } from "../scripts/mediaBlobCache";

export type MediaType = "picture" | "video" | "voice_recording";

export interface MediaFile {
  id: number;
  user_id: string;
  drive_file_id: string;
  file_name: string;
  original_name: string;
  mime_type: string;
  media_type: MediaType;
  file_size: number;
  web_view_link: string | null;
  web_content_link: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string | null;
}


type MediaModalProps = {
  open: boolean;
  onClose: () => void;
  files: MediaFile[];
  mediaType: MediaType;
  loading: boolean;
  error: string | null;
  contactName: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getMediaTypeLabel(mediaType: MediaType): string {
  switch (mediaType) {
    case "picture":
      return "Photos";
    case "video":
      return "Videos";
    case "voice_recording":
      return "Voice Recordings";
    default:
      return "Media";
  }
}

export default function MediaModal({
  open,
  onClose,
  files,
  mediaType,
  loading,
  error,
  contactName,
}: MediaModalProps) {
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  const [blobUrls, setBlobUrls] = useState<Record<number, string>>({});
  const blobUrlsRef = useRef<Record<number, string>>({});

  useEffect(() => {
    if (!open) {
      setPreviewFile(null);
    }
  }, [open]);

  useEffect(() => {
    blobUrlsRef.current = blobUrls;
  }, [blobUrls]);

  useEffect(() => {
    return () => {
      Object.values(blobUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleImageClick = (file: MediaFile) => {
    if (file.media_type === "picture") {
      setPreviewFile(file);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
  };

  const getDownloadUrl = (fileId: number) => {
    return `${API_BASE_URL}/api/media/files/${fileId}/download`;
  };

  const isSameOrigin = useMemo(() => {
    if (!open) return true;
    if (!API_BASE_URL) return true;
    try {
      return new URL(API_BASE_URL, window.location.href).origin === window.location.origin;
    } catch {
      return true;
    }
  }, [open]);

  const fetchMediaBlob = async (file: MediaFile) => {
    const cached = await getCachedBlob(file.id);
    if (cached) {
      return URL.createObjectURL(cached.blob);
    }

    const response = await fetch(getDownloadUrl(file.id), {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch media");
    }
    const blob = await response.blob();
    const contentType = blob.type || file.mime_type || "application/octet-stream";
    await setCachedBlob(file.id, file.user_id, blob, contentType);
    return URL.createObjectURL(blob);
  };

  useEffect(() => {
    if (!open || isSameOrigin || files.length === 0) return;

    let cancelled = false;

    const load = async () => {
      const nextUrls: Record<number, string> = {};
      for (const file of files) {
        if (blobUrlsRef.current[file.id]) continue;
        try {
          const url = await fetchMediaBlob(file);
          if (cancelled) {
            URL.revokeObjectURL(url);
            continue;
          }
          nextUrls[file.id] = url;
        } catch {
          // keep fallback URL
        }
      }

      if (!cancelled && Object.keys(nextUrls).length > 0) {
        setBlobUrls((prev) => ({
          ...prev,
          ...nextUrls,
        }));
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [open, files, isSameOrigin]);

  useEffect(() => {
    setBlobUrls((prev) => {
      const next: Record<number, string> = {};
      const keepIds = new Set(files.map((file) => file.id));
      Object.entries(prev).forEach(([id, url]) => {
        const numericId = Number(id);
        if (keepIds.has(numericId)) {
          next[numericId] = url;
        } else {
          URL.revokeObjectURL(url);
        }
      });
      return next;
    });
  }, [files]);

  useEffect(() => {
    if (!open || files.length === 0) return;
    const bypassUsers = new Set(
      files.map((file) => file.user_id).filter((userId) => isMediaCacheBypassActive(userId))
    );
    if (bypassUsers.size === 0) return;
    clearBlobCache();
    clearMediaCache();
    setBlobUrls((prev) => {
      Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
      return {};
    });
  }, [open, files]);

  if (!open) return null;

  return (
    <div className="modal media-modal-overlay" onClick={onClose}>
      <div className="modal-content media-modal" onClick={(e) => e.stopPropagation()}>
        <div className="media-modal-header">
          <h3 className="info-label">
            {contactName}'s {getMediaTypeLabel(mediaType)}
          </h3>
          <button className="media-close-btn" onClick={onClose} aria-label="Close">
            <img src="/images/close.svg" alt="Close" />
          </button>
        </div>

        {loading && (
          <div className="media-loading">
            <p>Loading...</p>
          </div>
        )}

        {error && (
          <div className="media-error">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && files.length === 0 && (
          <div className="media-empty">
            <p>No {getMediaTypeLabel(mediaType).toLowerCase()} found</p>
          </div>
        )}

        {!loading && !error && files.length > 0 && (
          <div className="media-grid">
            {files.map((file) => (
              <div key={file.id} className="media-item">
                {file.media_type === "picture" && (
                  <div
                    className="media-thumbnail clickable"
                    onClick={() => handleImageClick(file)}
                  >
                    <img
                      src={blobUrls[file.id] || getDownloadUrl(file.id)}
                      alt={file.original_name}
                      loading="lazy"
                    />
                  </div>
                )}

                {file.media_type === "video" && (
                  <div className="media-thumbnail video-thumbnail">
                    <video
                      src={blobUrls[file.id] || getDownloadUrl(file.id)}
                      controls
                      preload="metadata"
                    >
                      Your browser does not support video playback.
                    </video>
                  </div>
                )}

                {file.media_type === "voice_recording" && (
                  <div className="media-thumbnail audio-thumbnail">
                    <div className="audio-icon">
                      <img src="/images/mic.svg" alt="Audio" />
                    </div>
                    <audio
                      src={blobUrls[file.id] || getDownloadUrl(file.id)}
                      controls
                      preload="metadata"
                    >
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}

                <div className="media-info">
                  <p className="media-name" title={file.original_name}>
                    {file.original_name}
                  </p>
                  <p className="media-meta">
                    {formatFileSize(file.file_size)} - {formatDate(file.createdAt)}
                  </p>
                  {file.description && (
                    <p className="media-description" title={file.description}>
                      {file.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewFile && (
        <div className="image-preview-overlay" onClick={(e) => {
          e.stopPropagation();
          closePreview();
        }}>
          <div className="image-preview-content" onClick={(e) => e.stopPropagation()}>
            <button className="preview-close-btn" onClick={closePreview} aria-label="Close preview">
              <img src="/images/close.svg" alt="Close" />
            </button>
            <img
              src={blobUrls[previewFile.id] || getDownloadUrl(previewFile.id)}
              alt={previewFile.original_name}
              className="preview-image"
            />
            <div className="preview-info">
              <p className="preview-name">{previewFile.original_name}</p>
              {previewFile.description && (
                <p className="preview-description">{previewFile.description}</p>
              )}
              <p className="preview-meta">
                {formatFileSize(previewFile.file_size)} - {formatDate(previewFile.createdAt)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
