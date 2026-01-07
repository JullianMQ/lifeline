import type { User, Contact } from "../types";

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
  onAddContact,
}: Props) {
  return (
    <>
      <div className="dashboard-user">
        <img src={user?.image || "src/assets/user-example.svg"} alt="User"/>
        <div className="dashboard-user-info">
          <p>Hey there,</p>
          <h1>{user?.name?.split(" ")[0] || "User"}</h1>
        </div>
      </div>

      <div className="dashboard-contacts">
        <ul>
          {contacts.map((contact, index) => (
            <li key={index} className="dashboard-card" onClick={() => onSelectContact(contact)}>
              <img src={contact.image || "src/assets/user-example.svg"} alt="Contact"/>
              <h3>{contact.name}</h3>
            </li>
          ))}

          <li className="dashboard-card" onClick={onAddContact}>
            <img src="src/assets/add.svg" alt="Add contact" />
            <h3>Add Contact</h3>
          </li>
        </ul>
      </div>
    </>
  );
}
