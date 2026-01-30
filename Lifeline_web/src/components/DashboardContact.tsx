import { useState, useCallback } from "react";
import type { ContactCard } from "../types/realtime";
import MediaModal, { type MediaFile, type MediaType } from "./MediaModal";
import { debugMedia } from "../scripts/debug";

type Props = {
  contact: ContactCard;
  onBack: () => void;
  geocode: string;
  history: { time: string; lat: number; lng: number }[];
  onAcknowledgeAlert?: (alertId: string) => void;
};

function formatLastSeen(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export default function DashboardContact({
  contact,
  onBack,
  geocode,
  history,
  onAcknowledgeAlert,
}: Props) {
  const location = contact.location?.coords ?? null;
  const isOnline = contact.presence?.status === "online";
  const lastSeen = contact.presence?.lastSeen;
  const lastUpdate = contact.location?.timestamp;

  // Media modal state
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [activeMediaType, setActiveMediaType] = useState<MediaType>("picture");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const fetchMediaFiles = useCallback(async (mediaType: MediaType) => {
    // Use contact.id which is the user ID from the ContactCard
    const userId = contact.id || contact.location?.userId;
    
    // Debug logging
    debugMedia.log("=== Media Fetch ===");
    debugMedia.log("Contact object:", contact);
    debugMedia.log("contact.id:", contact.id);
    debugMedia.log("contact.location?.userId:", contact.location?.userId);
    debugMedia.log("Final userId being used:", userId);
    debugMedia.log("contact.phone:", contact.phone);
    debugMedia.log("mediaType:", mediaType);
    
    if (!userId) {
      setMediaError("User ID not available");
      return;
    }

    setMediaLoading(true);
    setMediaError(null);

    try {
      const url = `${API_BASE_URL}/api/media/files?user_id=${userId}&media_type=${mediaType}`;
      debugMedia.log("Fetching from URL:", url);
      
      const response = await fetch(
        url,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch media files");
      }

      const data = await response.json();
      setMediaFiles(data.files || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load media";
      setMediaError(message);
      setMediaFiles([]);
    } finally {
      setMediaLoading(false);
    }
  }, [contact.id, contact.location?.userId]);

  const openMediaModal = (mediaType: MediaType) => {
    setActiveMediaType(mediaType);
    setMediaModalOpen(true);
    fetchMediaFiles(mediaType);
  };

  const closeMediaModal = () => {
    setMediaModalOpen(false);
    setMediaFiles([]);
    setMediaError(null);
  };

  return (
    <>
      {/* Emergency Alert Banner */}
      {contact.hasActiveAlert && contact.activeAlert && (
        <div className="alert-banner">
          <div className="alert-banner-content">
            <span className="alert-banner-icon">⚠</span>
            <span className="alert-banner-message">
              {contact.activeAlert.message || "Emergency alert active"}
            </span>
          </div>
          {onAcknowledgeAlert && (
            <button
              className="alert-acknowledge-btn"
              onClick={() => onAcknowledgeAlert(contact.activeAlert!.id)}
            >
              Acknowledge
            </button>
          )}
        </div>
      )}

      <button className="back-btn" onClick={onBack}>
        <img src="/images/close.svg" alt="Back" />
      </button>

      <section className="dashboard-user">
        <img
          src={contact?.image || "/images/user-example.svg"}
          alt={`${contact?.name}`}
          className="dashboard-user-img avatar"
        />
        <div className="dashboard-cont-info">
          <div className="dashboard-name-row">
            <h1>{contact?.name?.split(" ")[0] || "User"}</h1>
            <span
              className={`presence-indicator ${isOnline ? "presence-online" : "presence-offline"}`}
              title={isOnline ? "Online" : "Offline"}
            />
          </div>
          <p>{contact?.phone}</p>
          {!isOnline && lastSeen && (
            <p className="last-seen">Last seen: {formatLastSeen(lastSeen)}</p>
          )}
        </div>
      </section>

      <section className="dashboard-cont-ws">
        <h2 className="geo-loc">
          {geocode === "" ? "Loading..." : geocode}
        </h2>
        <p>
          {location ? `${location.lng}, ${location.lat}` : "Loading..."}
        </p>
        {lastUpdate && (
          <p className="location-timestamp">
            Updated: {formatTimestamp(lastUpdate)}
          </p>
        )}
      </section>

      <section className="dashboard-buttons">
        <button className="d-btn" onClick={() => openMediaModal("video")}>
          <img src="/images/cam.svg" alt="camera" aria-label="video button" />
        </button>
        <button className="d-btn" onClick={() => openMediaModal("picture")}>
          <img src="/images/photos.svg" alt="photos" aria-label="picture button" />
        </button>
        <button className="d-btn" onClick={() => openMediaModal("voice_recording")}>
          <img src="/images/mic.svg" alt="microphone" aria-label="audio recording button" />
        </button>
        <button className="d-btn" disabled>
          <img src="/images/docs.svg" alt="documents" aria-label="document button" />
        </button>
      </section>

      <section className="dashboard-history">
        <p>History:</p>
        <div className="table-card">
          <article className="table-scroll">
            <table>
              <tbody>
                <tr>
                  <td>Time Stamp</td>
                  <td>Location</td>
                </tr>
                {history.map((row, i) => (
                  <tr key={i}>
                    <td>{row.time}</td>
                    <td>
                      {row.lng}
                      <br />
                      {row.lat}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      </section>

      {/* Media Modal */}
      <MediaModal
        open={mediaModalOpen}
        onClose={closeMediaModal}
        files={mediaFiles}
        mediaType={activeMediaType}
        loading={mediaLoading}
        error={mediaError}
        contactName={contact?.name?.split(" ")[0] || "User"}
      />
    </>
  );
}
