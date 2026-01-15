import { API_BASE_URL } from "../config/api";
import { useDashboard } from "./useDashboard";

function useProfile() {
    const { displayContact } = useDashboard();
    const getContactIndex = async (phone:string, role: "mutual" | "dependent" | "emergency") => {
        const getPhoneIndex = await fetch(`${API_BASE_URL}/api/contacts`, {
            credentials: "include",
        });
        const data = await getPhoneIndex.json();
        if(role==="mutual"){
            for(let i = 0; i < data.emergency_contacts.length; i++){
                if(data.emergency_contacts[i] === phone){
                    return i;
                }
            };
        }
        else if(role==="dependent"){
            for(let i = 0; i < data.dependent_contacts.length; i++){
                if(data.dependent_contacts[i] === phone){
                    return i;
                }
            };
        }
    }

    const removeContact = async (phone:string, role: "mutual" | "dependent" | "emergency") => {
        const index = String(await getContactIndex(phone, role));
        if(role === "mutual"){role="emergency";};
        try{
            const res = await fetch(`${API_BASE_URL}/api/contacts/${role}/${index}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) {
                throw new Error("Failed to remove contact");
            }
            await displayContact();
        }catch(err){
            console.error("Remove contact error:", err);
        }
    }

    return {
        removeContact
    };
}

export default useProfile;