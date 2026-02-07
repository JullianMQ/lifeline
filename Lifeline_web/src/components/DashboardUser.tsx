import type { User } from "../types";
import type { ContactCard } from "../types/realtime";
import { useNavigate } from 'react-router-dom';

type Props = {
  user: User | null;
  contactCards: ContactCard[];
  onSelectContact: (contact: ContactCard) => void;
  onAddContact: () => void;
};

/** Presence indicator dot component */
function PresenceIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      className={`presence-indicator ${isOnline ? 'online' : 'offline'}`}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
}

export default function DashboardUser({
  user,
  contactCards,
  onSelectContact,
}: Props) {
  const navigate = useNavigate();

  const renderContactCard = (contact: ContactCard, index: number) => {
    const isOnline = contact.presence?.status === 'online';
    const hasAlert = contact.hasActiveAlert;
    
    return (
      <li
        key={contact.id || index}
        className={`dashboard-card ${hasAlert ? 'alert-mode' : ''}`}
        onClick={() => onSelectContact(contact)}
      >
        <div style={{ position: 'relative'}}>
          <img
            src={contact.image || "/images/user-example.svg"}
            alt={contact.name || "User image"}
            className="dashboard-card-img avatar"
          />
          {!contact.hasActiveAlert && (
            <PresenceIndicator isOnline={isOnline} />
          )}
        </div>
        <h3 className={hasAlert ? 'alert-text' : ''}>{contact.name.split(" ")[0]}</h3>
      </li>
    );
  };

  return (
    <>
      <div className="dashboard-user">
        <div className="dashboard-user-img">
          <img src={user?.image || "/images/user-example.svg"} alt="User" className="user-img avatar"/>
        </div>
        <div className="dashboard-user-info">
          <p>Hey there,</p>
          <h1>{user?.name?.split(" ")[0] || "User"}</h1>
        </div>
      </div>

      <div className="dashboard-contacts">
        {contactCards && contactCards.length !== 0 ? (  
          <>
            <div>
              <div className="add-btn">
                <h2>Mutual</h2>
                <p className="uline-btn" onClick={() => navigate('/addContact')}>
                  + ADD
                </p>
              </div>
              <div className="scrollable">
                <ul>
                  {contactCards
                    .filter((c) => c.role === "mutual")
                    .map((contact, index) => renderContactCard(contact, index))}           
                </ul>
              </div>
            </div>

            <div>
              <h2>Dependent</h2>
              <div className="scrollable">
                <ul>
                  {contactCards
                    .filter((c) => c.role === "dependent")
                    .map((contact, index) => renderContactCard(contact, index))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <div>
            <h3>Oops! looks like you don't have any contacts yet</h3>
            <p><span className="uline-btn" onClick={() => navigate('/addContact')}>Add a contact</span> to get started</p>
          </div>
        )}
      </div>
    </>
  );
}
