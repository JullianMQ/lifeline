import { API_BASE_URL } from "../config/api";

function useProfile() {
    const getContactIndex = async (phone:string, role: "mutual" | "dependent") => {
        const getPhoneIndex = await fetch(`${API_BASE_URL}/api/contacts`, {credentials: "include",});
        if (!getPhoneIndex.ok) { throw new Error("Failed to fetch contacts"); }
        
        const data = await getPhoneIndex.json();
        if (!data) { throw new Error("Invalid contacts response"); }

        if(role==="mutual"){
            const index = data.emergency_contacts?.indexOf(phone);
            if (index !== -1) return index;
        }
        if (role === "dependent") {
            const index = data.dependent_contacts?.indexOf(phone);
            if (index !== -1) return index;
        }
        throw new Error("Contact not found");
    }

    const removeContact = async (phone:string, role: "mutual" | "dependent") => { 
        const index = String(await getContactIndex(phone, role)); 
        if(role === "mutual"){ 
            const res = await fetch(`${API_BASE_URL}/api/contacts/emergency/${index}`, { method: "DELETE", credentials: "include", }); 
            if (!res.ok) {throw new Error("Failed to remove contact");} 
        } else if(role === "dependent"){ 
            const res = await fetch(`${API_BASE_URL}/api/contacts/dependent/${index}`, { method: "DELETE", credentials: "include", }); 
            if (!res.ok) {throw new Error("Failed to remove contact");} 
        } 
    }

    return {
        removeContact
    };
}

export default useProfile;