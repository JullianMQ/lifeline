import { useState } from "react";
import { authClient } from "./auth-client";
import { API_BASE_URL } from "../config/api";

type createForm = {
    firstName: string;
    lastName: string;
    email: string;
    phoneNo: string;
    password: string;
    confirmPassword: string;
    role: "" | "mutual" | "dependent";
};

type addForm = {
    phoneNo: string;
};

export function useAddContact() {
    const [step, setStep] = useState<number>(1);
    const [invalidFields, setInvalidFields] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [qrUrl, setQrUrl] = useState<string>("");
    const [fetchedUser, setFetchedUser] = useState<any>(null);

    const [createForm, setcreateForm] = useState<createForm>({
        firstName: "",
        lastName: "",
        email: "",
        phoneNo: "",
        password: "",
        confirmPassword: "",
        role: "",
    });

    const [addForm, setaddForm] = useState<addForm>({
        phoneNo: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setcreateForm(prev => ({ ...prev, [name]: value }));
        setaddForm(prev => ({ ...prev, [name]: value }));
        setInvalidFields(prev => prev.filter(f => f !== name));
        setError(null);
    };

    const validateForm = (mode: "create" | "add") => {
        const errors: string[] = [];
        const phoneRegex = /^09\d{9}$/;

        if (mode === "create") {
            if (!createForm.firstName) errors.push("firstName");
            if (!createForm.lastName) errors.push("lastName");
            if (!createForm.email) errors.push("email");

            if (!createForm.role) {  
                errors.push("role");  
                setError("Please select a role");  
            }  

            if (!createForm.phoneNo || !phoneRegex.test(createForm.phoneNo)) {
                errors.push("phoneNo");
                setError(!createForm.phoneNo
                    ? "Phone number is required"
                    : "Invalid phone number. Must start with 09 and be 11 digits."
                );
            }

            if (!createForm.password) errors.push("password");

            if (!createForm.confirmPassword || createForm.password !== createForm.confirmPassword) {
                errors.push("confirmPassword");
                setError(!createForm.confirmPassword
                    ? "Please confirm your password"
                    : "Passwords do not match"
                );
            }
        }

        if (mode === "add") {
            if (!addForm.phoneNo || !phoneRegex.test(addForm.phoneNo)) {
                errors.push("phoneNo");
                setError(!addForm.phoneNo
                    ? "Phone number is required"
                    : "Invalid phone number. Must start with 09 and be 11 digits."
                );
            }
        }

        return errors;
    };

    const handleCreate = async () => {
        setError(null);
        setInvalidFields([]);

        const errors = validateForm("create");
        if (errors.length) {
            setInvalidFields(errors);
            return;
        }
        setLoading(true);
        try {
            const { error } = await authClient.signUp.email({
                name: `${createForm.firstName} ${createForm.lastName}`,
                email: createForm.email,
                password: createForm.password,
                phone_no: createForm.phoneNo,
                role: createForm.role,
            } as any);

            if (error) {
                const message = error.message?.toLowerCase() || "";

                if (message.includes("phone")) {
                    setInvalidFields(["phone_no"]);
                    setError("Phone number already exists.");
                } else if (message.includes("email")) {
                    setInvalidFields(["email"]);
                    setError("Email already exists.");
                } else {
                    setError(error.message || "Failed to sign up");
                }
                return;
            }

            await addEmContact(createForm.phoneNo, createForm.role as "mutual" | "dependent");
            

            setStep(3);
            await generateQrLink()

        } catch (err) {
            console.error("Signup failed:", err);
            setError("Failed to sign up");
        } finally {
            setLoading(false);
        }
    };

    const generateQrLink = async () => {
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/auth/magic-link/qr`,
                {
                    method: "POST",
                    credentials: "include",
                    body: JSON.stringify({
                        email: createForm.email,
                        name: `${createForm.firstName} ${createForm.lastName}`,
                        callbackURL: `${window.location.origin}/dashboard`,
                        newUserCallbackURL: "",
                        errorCallbackURL: "",
                    }),
                }
            )

            const data = await res.json()

            if (!res.ok || !data.url) {
                throw new Error("Failed to generate QR")
            }

            setQrUrl(data.url)
        } catch (err) {
            console.error("QR generation failed:", err)
        }
    }

    const handleAdd = async () => {
        try {
            setLoading(true);
            await addEmContact(addForm.phoneNo, fetchedUser.role);
            setStep(3);
        } catch (err) {
            console.error(err);
            setError(
            err instanceof Error
                ? err.message
                : "Failed to add emergency contact"
            );
        } finally {
            setLoading(false);
        }
    };

    // contact handling

    const addEmContact = async ( contact: string, role: "mutual" | "dependent" ) => {
        const body = role === "dependent"
            ? { dependent_contacts: [contact] }
            : { emergency_contacts: [contact] };

        const res = await fetch(`${API_BASE_URL}/api/contacts`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) { throw new Error("Failed to add contact"); }

        return await res.json();
    };

    const validateNumber = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setInvalidFields([]);
        console.log(addForm.phoneNo);
        const errors = validateForm("add");
        if (errors.length) {
            setInvalidFields(errors);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/contacts/${addForm.phoneNo}`, { method: "GET", credentials: "include", });
            const data = await res.json();

            setFetchedUser(data);
            if (!res.ok || data.error) {
                setInvalidFields(["phoneNo"]);
                setError("Contact does not exist. Try again");
                return;
            }

            setStep(2);
        } catch (err) {
            console.error(err);
            setError("Something went wrong. Try again");
        }
    };

    return {
        step,
        setStep,
        createForm,
        addForm,
        fetchedUser,
        invalidFields,
        error,
        loading,
        handleChange,
        handleCreate,
        qrUrl,
        validateNumber,
        addEmContact,
        handleAdd
    };
}
