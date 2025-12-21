import { useState } from "react";
import { useNavigate } from "react-router-dom";

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNo: string;
  password: string;
  confirmPassword: string;
  role: "mutual" | "dependent";
};

export function useSignup() {
  const [step, setStep] = useState<1 | 2>(1);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>({
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

  const validateStep1 = () => {
    const errors: string[] = [];
    if (!formData.firstName) errors.push("firstName");
    if (!formData.lastName) errors.push("lastName");
    if (!formData.email) errors.push("email");

    return errors;
  };

  const validateStep2 = () => {
    const errors: string[] = [];
    
    const phoneRegex = /^09\d{9}$/;
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

  const checkEmail = async () => {
    if (!formData.email) return;

    try {
      const res = await fetch("/api/check/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await res.json();
      console.log("Email check response:", data);

      if (!res.ok || data.error) {
        setInvalidFields((prev) => [...prev, "email"]);
        setError(data.error || "Email already in use");
        return false;
      } else {
        setInvalidFields((prev) => prev.filter((f) => f !== "email"));
        setError(null);
        return true;
      }
    } catch (err: any) {
      console.error("Email validation error:", err);
      setError(err.message || "Failed to validate email");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      const errors = validateStep1();
      if (errors.length) {
        setInvalidFields(errors);
        return;
      }

      const emailValid = await checkEmail();
      if (!emailValid) return;

      setStep(2);
      return;
    }

    const errors = validateStep2();
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
          role: formData.role,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "USER_ALREADY_EXISTS" || data.message?.toLowerCase().includes("already")) {
          setInvalidFields(["email"]);
          setError("User already exists. Please log in.");
        } else if (data.details?.detail?.includes("phone_no")) {
          setInvalidFields(["phoneNo"]);
          setError("Phone number already exists.");
        } else {
          setError(data.message || "Signup failed");
        }
        return;
      }

      localStorage.setItem("lifeline_user", JSON.stringify({ email: formData.email, role: formData.role }));
      navigate("/addContact");
    } catch (err: any) {
      setError(err.message || "Signup failed");
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
    checkEmail
  };
}
