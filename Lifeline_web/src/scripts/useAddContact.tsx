import { useState } from "react";
import { authClient } from "./auth-client";

type memberForm = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNo: string;
  password: string;
  confirmPassword: string;
  role: "" | "mutual" | "dependent";
};

export function useAddContact() {
  

  const [step, setStep] = useState<number>(1);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>("")

  const [memberForm, setmemberForm] = useState<memberForm>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNo: "",
    password: "",
    confirmPassword: "",
    role: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setmemberForm(prev => ({ ...prev, [name]: value }));
    setInvalidFields(prev => prev.filter(f => f !== name));
    setError(null);
  };

  const validateForm = () => {
    const errors: string[] = [];
    const phoneRegex = /^09\d{9}$/;

    if (!memberForm.firstName) errors.push("firstName");
    if (!memberForm.lastName) errors.push("lastName");
    if (!memberForm.email) errors.push("email");

    if (!memberForm.phoneNo || !phoneRegex.test(memberForm.phoneNo)) {
      errors.push("phone_no");
      setError(
        !memberForm.phoneNo
          ? "Phone number is required"
          : "Invalid phone number. Must start with 09 and be 11 digits."
      );
    }

    if (!memberForm.password) errors.push("password");

    if (!memberForm.confirmPassword || memberForm.password !== memberForm.confirmPassword) {
      errors.push("confirmPassword");
      setError(
        !memberForm.confirmPassword
          ? "Please confirm your password"
          : "Passwords do not match"
      );
    }

    return errors;
  };

  const addEmContact = async (emergency_contact: string) => {
  for (let count = 1; count <= 5; count++) {
    const res = await fetch("http://localhost:3000/api/contacts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [`emergency_contact_${count}`]: emergency_contact,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      return data;
    }

    if (count === 5) {
      throw new Error(data.message || "Failed to add emergency contact");
    }
  }
};


  const handleSubmit = async () => {
    setError(null);
    setInvalidFields([]);

    const errors = validateForm();
    if (errors.length) {
      setInvalidFields(errors);
      return;
    }

    setLoading(true);

    try {
      const { error } = await authClient.signUp.email({
        name: `${memberForm.firstName} ${memberForm.lastName}`,
        email: memberForm.email,
        password: memberForm.password,
      });

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

      if (memberForm.role === "mutual") {
        addEmContact(memberForm.phoneNo);
      }
      
      setStep(4);
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
        "http://localhost:3000/api/auth/magic-link/qr",
        {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            email: memberForm.email,
            name: `${memberForm.firstName} ${memberForm.lastName}`,
            callbackURL: "http://localhost:5173/dashboard",
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


  return {
    step,
    setStep,
    memberForm,
    invalidFields,
    error,
    loading,
    handleChange,
    handleSubmit,

    qrUrl
  };
}
