import type { User, Contact } from "../types";
import { useNavigate } from 'react-router-dom';

type Props = {
  user: User | null;
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  onAddContact: () => void;
};

export default function DashboardUser({
  user,
  contacts,
  onSelectContact,
}: Props) {
  const navigate = useNavigate();
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
        {contacts && contacts.length !== 0 ? (  
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
                  {contacts.filter((c) => c.role === "mutual").map((contact, index) => (
                    <li key={index} className="dashboard-card" onClick={() => onSelectContact(contact)}>
                        <img src={contact.image || "/images/user-example.svg"} alt={contact.image || "User image"} className="dashboard-card-img avatar"/>
                        <h3>{contact.name.split(" ")[0]}</h3>
                      </li>
                  ))}           
                </ul>
              </div>
            </div>

            <div>
              <h2>Dependent</h2>
              <div className="scrollable">
                <ul>
                  {contacts.filter((c) => c.role === "dependent").map((contact, index) => (
                    <li key={index} className="dashboard-card" onClick={() => onSelectContact(contact)}>
                        <img src={contact.image || "/images/user-example.svg"} alt={contact.image || "User image"} className="dashboard-card-img avatar"/>
                        <h3>{contact.name.split(" ")[0]}</h3>
                      </li>
                  ))}
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
