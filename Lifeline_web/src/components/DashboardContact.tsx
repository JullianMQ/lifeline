import { useState, useCallback } from "react";
import type { ContactCard } from "../types/realtime";
import MediaModal, { type MediaFile, type MediaType } from "./MediaModal";
import { API_BASE_URL } from "../config/api";
import { debugMedia } from "../scripts/debug";
import { printHistoryDocument } from "./document";

type Props = {
  contact: ContactCard;
  onBack: () => void;
  geocode: string;
  history: { time: string; timestamp: string; lat: number; lng: number; formatted_location: string; sos: boolean }[];
  onHistoryHover?: (location: { lat: number; lng: number; image: string; formatted_location: string } | null) => void;
  onHistoryClick?: (location: { lat: number; lng: number; image: string; formatted_location: string } | null, index: number) => void;
  selectedRowIndex?: number | null;
  hoveredLocation?: { lat: number; lng: number; image: string; formatted_location: string } | null;
  selectedLocation?: { lat: number; lng: number; image: string; formatted_location: string } | null;
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

export default function DashboardContact({
  contact,
  onBack,
  geocode,
  history,
  onHistoryHover,
  onHistoryClick,
  selectedRowIndex,
  hoveredLocation,
  selectedLocation,
}: Props) {
  const location = selectedLocation || hoveredLocation || contact.location?.coords;
  const isOnline = contact.presence?.status === "online";
  const lastUpdate = contact.activeAlert?.timestamp || contact.location?.timestamp;
  // Media modal state
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [activeMediaType, setActiveMediaType] = useState<MediaType>("picture");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // History filter state
  const [historyFilter, setHistoryFilter] = useState<"all" | "1h" | "6h" | "today" | "yesterday">("all");

  // Filter history based on selected time range
  const getFilteredHistory = useCallback(() => {
    if (historyFilter === "all") return history;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return history.filter((item) => {
      const itemDate = new Date(item.timestamp);
      
      switch (historyFilter) {
        case "1h":
          return (now.getTime() - itemDate.getTime()) <= 1 * 60 * 60 * 1000;
        case "6h":
          return (now.getTime() - itemDate.getTime()) <= 6 * 60 * 60 * 1000;
        case "today":
          return itemDate >= today && itemDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
        case "yesterday":
          return itemDate >= yesterday && itemDate < today;
        default:
          return true;
      }
    });
  }, [history, historyFilter]);

  const fetchMediaFiles = useCallback(async (mediaType: MediaType) => {
    // Use contact.id which is the user ID from the ContactCard
    const userId = contact.id || contact.location?.userId;
    let shouldStopLoading = false;
    
    // Debug logging
    debugMedia.log("=== Media Fetch ===");
    debugMedia.log("Contact object:", contact);
    debugMedia.log("contact.id:", contact.id);
    debugMedia.log("contact.location?.userId:", contact.location?.userId);
    debugMedia.log("Final userId being used:", userId);
    debugMedia.log("contact.phone:", contact.phone);
    debugMedia.log("mediaType:", mediaType);
    
    if (!userId) {
      setMediaLoading(false);
      setMediaError("User ID not available");
      return;
    }

    shouldStopLoading = true;
    setMediaLoading(true);
    setMediaError(null);

    try {
      const url = `${API_BASE_URL}/api/media/files?user_id=${encodeURIComponent(userId)}&media_type=${encodeURIComponent(mediaType)}`;
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
      if (shouldStopLoading) {
        setMediaLoading(false);
      }
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

  const handlePrintDocuments = useCallback(async () => {
    let previousHover = hoveredLocation ?? null;
    let previewLocation =
      selectedLocation ||
      hoveredLocation ||
      (contact.location?.coords
        ? {
            lat: contact.location.coords.lat,
            lng: contact.location.coords.lng,
            image: contact.image || "/images/user-example.svg",
            formatted_location:
              contact.location.formatted_location || geocode || "",
          }
        : null);

    if (onHistoryHover && previewLocation) {
      onHistoryHover(previewLocation);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    await sleep(150);
    try {
      await printHistoryDocument({
        contactName: contact?.name,
        history: getFilteredHistory(),
      });
    } finally {
      if (onHistoryHover && previewLocation) {
        onHistoryHover(previousHover);
      }
    }
    previewLocation = null;previousHover = null;
  }, [
    contact?.name,
    contact.image,
    contact.location?.coords,
    contact.location?.formatted_location,
    geocode,
    getFilteredHistory,
    hoveredLocation,
    onHistoryHover,
    selectedLocation,
  ]);

  return (
    <div className={`dashboard-contact-wrapper ${contact.hasActiveAlert ? 'alert-mode' : ''}`}>

      <button className="back-btn" onClick={onBack}>
        <img src="/images/close.svg" alt="Back" />
      </button>

      <section className="dashboard-user">
        <div className="relative">
          <img
            src={contact?.image || "/images/user-example.svg"}
            alt={`${contact?.name}`}
            className="dashboard-user-img avatar"
          />
          {!contact.hasActiveAlert && (
            <span
            className={`presence-indicator ${isOnline ? "presence-online" : "presence-offline"}`}
            title={isOnline ? "Online" : "Offline"}
            />
          )}
        </div>
        <div className="dashboard-cont-info">
          <div className="dashboard-name-row">
            <h1>
              {contact.hasActiveAlert ? contact?.name : contact?.name?.split(" ")[0]}
            </h1>
            
          </div>
          <p className={contact.hasActiveAlert ? 'alert-text' : ''}>{contact?.phone}</p>
          {!isOnline && !contact.hasActiveAlert && lastUpdate &&(
            <p className={`last-seen`}>Last seen: {formatLastSeen(lastUpdate)}</p>
          )}
          
        </div>
      </section>

      {contact.hasActiveAlert && lastUpdate && (
        <section className="dashboard-cont-ws">
          <p>Time:</p>
          <h2 className="alert-text">{formatTimestamp(lastUpdate)}</h2>
        </section>
      )}

      <section className="dashboard-cont-ws">
        {contact.hasActiveAlert && (<p>Origin:</p>)}
        <h2 className={`geo-loc ${contact.hasActiveAlert ? 'alert-text' : ''}`}>
          {geocode === "" ? "Loading..." : geocode}
        </h2>
        <p className={contact.hasActiveAlert ? 'alert-text' : ''}>
          {location ? `${location.lng}, ${location.lat}` : "Loading..."}
        </p>
        {lastUpdate && !contact.hasActiveAlert && (
          <p className={`location-timestamp ${contact.hasActiveAlert ? 'alert-text-muted' : ''}`}>
            Last Updated: {formatTimestamp(lastUpdate)}
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
        <button className="d-btn" onClick={handlePrintDocuments}>
          <img src="/images/docs.svg" alt="documents" aria-label="document button" />
        </button>
      </section>

      <section  className={`dashboard-history ${contact.hasActiveAlert ? 'hidden' : ''}`}>
        <div className="history-header">
          <p className={contact.hasActiveAlert ? 'alert-text' : ''}>History:</p>
          <select 
            value={historyFilter} 
            onChange={(e) => setHistoryFilter(e.target.value as typeof historyFilter)}
            className="history-filter"
          >
            <option value="all">All</option>
            <option value="1h">Past 1 hr</option>
            <option value="6h">Past 6 hrs</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
          </select>
        </div>
        <div className="table-card">
          <article className="table-scroll">
            <table>
              <tbody>
                <tr>
                  <td>Time Stamp</td>
                  <td>Location</td>
                </tr>
                {getFilteredHistory().map((row, i) => {
                  const isSelected = selectedRowIndex === i;
                  const isSos = row.sos;
                  return (
                    <tr
                      key={i}
                      onMouseEnter={() => onHistoryHover?.({ lat: row.lat, lng: row.lng, image: contact.image || '/images/user-example.svg', formatted_location: row.formatted_location })}
                      onMouseLeave={() => onHistoryHover?.(null)}
                      onClick={() => onHistoryClick?.({ lat: row.lat, lng: row.lng, image: contact.image || '/images/user-example.svg', formatted_location: row.formatted_location }, i)}
                      className={`history-row-hoverable${isSelected ? ' selected' : ''}${isSos ? ' sos' : ''}`}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{row.time}</td>
                      <td>
                        {row.lng}
                        <br />
                        {row.lat}
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
}
