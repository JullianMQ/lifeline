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
      style={{
        display: 'inline-block',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: isOnline ? '#22c55e' : '#9ca3af',
        position: 'absolute',
        bottom: '2px',
        right: '2px',
        border: '2px solid white',
      }}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
}

/** Alert badge component */
function AlertBadge() {
  return (
    <span
      className="alert-badge"
      style={{
        display: 'inline-block',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        backgroundColor: '#ef4444',
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold',
        lineHeight: '18px',
        textAlign: 'center',
        position: 'absolute',
        top: '-4px',
        right: '-4px',
        border: '2px solid white',
      }}
      title="Active Alert"
    >
      !
    </span>
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
    
    return (
      <li
        key={contact.id || index}
        className="dashboard-card"
        onClick={() => onSelectContact(contact)}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={contact.image || "/images/user-example.svg"}
            alt={contact.name || "User image"}
            className="dashboard-card-img"
          />
          <PresenceIndicator isOnline={isOnline} />
          {contact.hasActiveAlert && <AlertBadge />}
        </div>
        <h3>{contact.name.split(" ")[0]}</h3>
      </li>
    );
  };

  return (
    <>
      <div className="dashboard-user">
        <div className="dashboard-user-img">
          <img src={user?.image || "/images/user-example.svg"} alt="User" className="user-img"/>
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
          <div onClick={() => navigate('/addContact')}>
            
            <h3>Oops! looks like you don't have any contacts yet</h3>
            <p><span className="uline-btn" onClick={() => navigate('/addContact')}>Add a contact</span> to get started</p>
          </div>
        )}
      </div>
    </>
  );
}
