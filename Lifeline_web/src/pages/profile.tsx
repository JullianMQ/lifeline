import "../styles/dashboard.css";
import "../styles/profile.css";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../scripts/useDashboard";
import { useState } from "react";
import  useProfile  from "../scripts/useProfile";
import ProfileForm from "../components/profileForm";
import ConfirmModal from "../components/confirmModal";

function Profile() {
    const navigate = useNavigate();
    const { user, contactCards} = useDashboard();
    const { removeContact } = useProfile();
    const [isEditing, setIsEditing] = useState(false);
    const [isRemoving, setRemoving] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingRemove, setPendingRemove] = useState<{
        phone: string;
        role: "mutual" | "dependent";
    } | null>(null);

    return (
        <main className="dashboard">
        <header>
            <h2 className="head-title">Lifeline</h2>
            <button className="back">
                <img src="/images/close.svg" alt="Back"  onClick={()=> navigate("/dashboard")}/>
            </button>
        </header>
        
        <section className="profile-body">
            {!isEditing ? (
            <article className="profile-user">
                <section className="profile-user-content">
                    <div className="profile-id">
                        <img src={user?.image || "/images/user-example.svg"} alt="user-img" className="profile-img avatar"/>
                        <h2>{user?.name}</h2>
                    </div>
                        <hr className="vr"/>
                    <div className="profile-info">
                        <div>
                            <p className="info-label">Email:</p>   
                            <p>{user?.email}</p>
                        </div>
                        <div>
                            <p className="info-label">Phone number:</p> 
                            <p>{user?.phone_no}</p>
                        </div>
                        <div>
                            <p className="info-label">Role:</p>
                            <p>{user?.role}</p>
                        </div>                  
                    </div>
                </section>
                    <hr />
                <div className="profile-edit">
                    <button className="neg-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
                </div>

            </article>
            ) : (
                <ProfileForm
                email={user?.email || ""}
                initialValues={{
                    image: user?.image || "",
                    name: user?.name || "",
                    phone_no: user?.phone_no || "",
                    role: user?.role as "" | "mutual" | "dependent" || "",
                }}
                onCancel={() => setIsEditing(false)}
                />
            )}
            <div className="profile-contacts">
            {contactCards && contactCards.length !== 0 ? (  
                <>
                    <div>
                        <div className="add-btn">
                            <h2>Mutual</h2>
                            {isRemoving ? (
                                <p className="uline-btn pos" onClick={()=>setRemoving(false)}>DONE</p>
                            ) : (                            
                                <p className="uline-btn neg" onClick={()=>setRemoving(true)}>REMOVE</p>
                            )}
                        </div>
                        <div className="scrollable">
                            <ul className="profile-grid">
                                {contactCards.filter((c) => c.role === "mutual").map((contact, index) => (
                                    <li key={index} className="profile-card" >
                                        <div className="profile-card-content">
                                            <div className="profile-card-name">
                                                <img src={contact.image || "/images/user-example.svg"} className="avatar"/>
                                                <h3>{contact.name}</h3>
                                            </div>
                                            <p>{contact.email}</p>
                                            <p>{contact.phone}</p>
                                        </div>
                                        {isRemoving &&(
                                            <button className="pos-btn remove" onClick={() => {
                                                setPendingRemove({ phone: contact.phone, role: contact.role });
                                                setShowConfirm(true);
                                            }}>
                                                REMOVE
                                            </button>
                                        )}
                                    </li>
                                ))}           
                            </ul>
                        </div>
                    </div>

                    <div>
                        <h2>Dependent</h2>
                        <div className="scrollable">
                            <ul className="profile-grid">
                            {contactCards.filter((c) => c.role === "dependent").map((contact, index) => (
                                <li key={index} className="profile-card" >
                                    <div className="profile-card-content">
                                        <div className="profile-card-name">
                                            <img src={contact.image || "/images/user-example.svg"} className="avatar"/>
                                            <h3>{contact.name}</h3>
                                        </div>
                                        <p>{contact.email}</p>
                                        <p>{contact.phone}</p>
                                    </div>
                                    {isRemoving &&(
                                        <button className="pos-btn remove" onClick={() => {
                                            setPendingRemove({ phone: contact.phone, role: contact.role });
                                            setShowConfirm(true);
                                        }}>
                                            REMOVE
                                        </button>
                                    )}
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
        </section>
            {showConfirm && pendingRemove && (
                <ConfirmModal
                    open={showConfirm} onClose={() => {
                        setShowConfirm(false);
                        setPendingRemove(null);
                    }}
                    onConfirm={async () => { 
                        await removeContact(pendingRemove.phone, pendingRemove.role);
                        setShowConfirm(false);
                        setPendingRemove(null);
                    }}
                />
            )}
        <footer></footer>
        </main>
    );
}
export default Profile;