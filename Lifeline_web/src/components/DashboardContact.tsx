import type { ContactCard } from "../types/realtime";

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
        <button className="d-btn">
          <img src="/images/cam.svg" alt="camera" />
        </button>
        <button className="d-btn">
          <img src="/images/photos.svg" alt="photos" />
        </button>
        <button className="d-btn">
          <img src="/images/mic.svg" alt="microphone" />
        </button>
        <button className="d-btn">
          <img src="/images/docs.svg" alt="documents" />
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
    </>
  );
}
