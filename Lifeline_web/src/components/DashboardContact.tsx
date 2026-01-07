import type { Contact } from "../types";

type Props = {
  contact: Contact;
  onBack: () => void;
};

export default function DashboardContact({ contact, onBack }: Props) {
  return (
    <>
        <button className="back-btn" onClick={onBack}>
            <img src="src/assets/close.svg" alt="Back"/>
        </button>
        <div className="dashboard-user">
            <img src={contact?.image || "src/assets/user-example.svg"} alt="User"/>
            <div className="dashboard-user-info">
                <h1>{contact?.name?.split(" ")[0] || "User"}</h1>
            </div>
        </div>
    </>
  );
}
