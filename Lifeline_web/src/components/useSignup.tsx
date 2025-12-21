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
    setFormData((prev) => ({ ...prev, [name]: value }));
    setInvalidFields((prev) => prev.filter((f) => f !== name));
    setError(null);
  };

  const validateStep1 = () => {
    const errors: string[] = [];
    if (!formData.firstName) errors.push("firstName");
    if (!formData.lastName) errors.push("lastName");
    if (!formData.email) errors.push("email");
    if (!formData.phoneNo) errors.push("phoneNo");
    return errors;
  };

  const validateStep2 = () => {
    const errors: string[] = [];
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      const errors = validateStep1();
      if (errors.length) {
        setInvalidFields(errors);
        return;
      }
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
        if (
          data.code === "USER_ALREADY_EXISTS" ||
          data.message?.toLowerCase().includes("already")
        ) {
          setStep(1);
          setInvalidFields(["email"]);
          setError("User already exists. Please log in.");
          setLoading(false);
          return;
        }

        if (data.details?.detail?.includes("phone_no")) {
          setStep(1);
          setInvalidFields(["phoneNo"]);
          setError("Phone number already exists. Please use another one.");
          setLoading(false);
          return;
        }

        setError(data.message || "Signup failed");
        setLoading(false);
        return;
      }

      localStorage.setItem(
        "lifeline_user",
        JSON.stringify({ email: formData.email, role: formData.role })
      );

      navigate("/addContact");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return { step, formData, invalidFields, error, loading, handleChange, handleSubmit };
}
