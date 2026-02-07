import { useState } from "react";
import { API_BASE_URL } from "../config/api";
import AvatarModal from "./avatarModal";

type Props = {
    email: string;
    initialValues: {
    image: string;
    name: string;
    phone_no: string;
    role: "mutual" | "dependent" | "";
  };
  onCancel: () => void;
};

export default function ProfileForm({ email,initialValues, onCancel }: Props) {
    const [updateForm, setUpdateForm] = useState(initialValues);
    const [loading, setLoading] = useState(false);
    const [openAvatar, setOpenAvatar] = useState(false);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setUpdateForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/auth/update-user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(updateForm),
        });
        if (!res.ok) throw new Error("Update failed");
        window.location.reload();
        } catch (err) {
        console.error(err);
        } finally {
        setLoading(false);
        }
    };

    return (
        <form className="profile-user">
        <div className="profile-user-content">
            <div className="profile-id">

                <div className="relative">
                    <img src={updateForm.image || "/images/user-example.svg"} alt="" />
                    <p className="edit-img" onClick={() => setOpenAvatar(true)}>
                        &#9998;
                    </p>
                </div>
                <input
                name="name"
                value={updateForm.name}
                onChange={handleChange}
                placeholder="Name"
                className="input-name"
                />
            </div>
            <AvatarModal
                open={openAvatar}
                value={updateForm.image}
                onChange={handleChange}
                onClose={() => setOpenAvatar(false)}
            />

            <div className="profile-info">
                <div>
                    <p className="info-label">Email:</p>   
                    <p>{email}</p>
                </div>

                <div>
                <p className="info-label">Phone number:</p>
                <input
                    name="phone_no"
                    value={updateForm.phone_no}
                    onChange={handleChange}
                    placeholder="Phone number"
                />
                </div>

                <div>
                    <p className="info-label">Role:</p>
                    <div className="info-options">
                        <label className="info-radio">
                            <input type="radio" name="role" value="mutual" checked={updateForm.role === "mutual"} onChange={handleChange}/>
                            Mutual
                        </label>
                        <label className="info-radio">
                            <input type="radio" name="role" value="dependent" checked={updateForm.role === "dependent"} onChange={handleChange}/>
                            Dependent
                        </label>
                    </div>
                </div>
            </div>
        </div> 
        <hr />

        <div className="profile-edit btn">
            <button className="neg-btn" onClick={onCancel} type="button">
            Cancel
            </button>
            <button
            className="pos-btn"
            onClick={handleSubmit}
            type="button"
            disabled={loading}
            >
            {loading ? "Saving..." : "Save"}
            </button>
        </div>
        </form>
    );
}
