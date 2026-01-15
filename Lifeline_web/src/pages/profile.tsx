import "../styles/dashboard.css";
import "../styles/profile.css";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../scripts/useDashboard";
import { useState } from "react";
import ProfileForm from "../components/profileForm";

function Profile() {
    const navigate = useNavigate();
    const { user } = useDashboard();
    const [isEditing, setIsEditing] = useState(false);

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
                <div className="profile-id">
                    <img src={user?.image || "/images/user-example.svg"} alt="user-img"/>
                    <h2>{user?.name}</h2>
                </div>
                    <hr />
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
        </section>

        <footer></footer>
        </main>
    );
}
export default Profile;