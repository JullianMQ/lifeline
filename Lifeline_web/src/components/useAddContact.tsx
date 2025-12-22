import { useState } from "react";
import { useNavigate } from "react-router-dom";

type MemberForm = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNo: string;
  password: string;
  confirmPassword: string;
  role: "mutual";
};

export function useAddContact() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<MemberForm>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNo: "",
    password: "",
    confirmPassword: "",
    role: "mutual",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setInvalidFields(prev => prev.filter(f => f !== name));
    setError(null);
  };

  const validateForm = () => {
    const errors: string[] = [];
    const phoneRegex = /^09\d{9}$/;

    if (!formData.firstName) errors.push("firstName");
    if (!formData.lastName) errors.push("lastName");
    if (!formData.email) errors.push("email");

    if (!formData.phoneNo || !phoneRegex.test(formData.phoneNo)) {
      errors.push("phoneNo");
      setError(
        !formData.phoneNo
          ? "Phone number is required"
          : "Invalid phone number. Must start with 09 and be 11 digits."
      );
    }

    if (!formData.password) errors.push("password");

    if (!formData.confirmPassword || formData.password !== formData.confirmPassword) {
      errors.push("confirmPassword");
      setError(
        !formData.confirmPassword
          ? "Please confirm your password"
          : "Passwords do not match"
      );
    }

    return errors;
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
      const res = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          password: formData.password,
          phone_no: formData.phoneNo,
          role: "mutual",
        }),
      });

      const data = await res.json();
      console.log("Add contact signup:", data);

      if (!res.ok) {
        if (data.details?.detail?.includes("phone_no")) {
          setInvalidFields(["phoneNo"]);
          setError("Phone number already exists.");
        } else if (data.message?.toLowerCase().includes("email")) {
          setInvalidFields(["email"]);
          setError("Email already exists.");
        } else {
          setError(data.message || "Failed to add contact");
        }
        setLoading(false);
        return;
      }
      setStep(3);
      // navigate("/dashboard");

    } catch (err) {
      console.error("Signup failed:", err);
      setError("Failed to add contact");
    } finally {
      setLoading(false);
    }
  };

  return {
    step,
    setStep,
    formData,
    invalidFields,
    error,
    loading,
    handleChange,
    handleSubmit,
  };
}
