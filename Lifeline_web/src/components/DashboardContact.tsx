import type { Contact, LatLng } from "../types";

type Props = {
  contact: Contact;
  onBack: () => void;
  geocode: string;
  location?: LatLng | null;
  history: { time: string; lat: number; lng: number }[];
};

export default function DashboardContact({ contact, onBack, geocode, location, history }: Props) {
    return (
    <>
        <button className="back-btn" onClick={onBack}>
            <img src="/images/close.svg" alt="Back"/>
        </button>
        <section className="dashboard-user">
            <img src={contact?.image || "/images/user-example.svg"} alt={`${contact?.name}`} className="dashboard-user-img"/>
            <div className="dashboard-cont-info">
                <h1>{contact?.name?.split(" ")[0] || "User"}</h1>
                <p>{contact?.phone}</p>
            </div>
        </section>
        <section className="dashboard-cont-ws">
            <h2 className="geo-loc">
                {geocode==="" ? "Loading..." : geocode}
            </h2>
            <p>
                {location ? `${location.lng}, ${location.lat}` : "Loading..."}
            </p>
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
