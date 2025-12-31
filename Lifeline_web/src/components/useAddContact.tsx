import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const [step, setStep] = useState<number>(1);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"mutual" | "dependent">();


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
      const { data, error } = await authClient.signUp.email({
        name: `${memberForm.firstName} ${memberForm.lastName}`,
        email: memberForm.email,
        password: memberForm.password,
        phone_no: memberForm.phoneNo,
        role: memberForm.role,
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

      setStep(4);
      // navigate("/dashboard");

    } catch (err) {
      console.error("Signup failed:", err);
      setError("Failed to sign up");
    } finally {
      setLoading(false);
    }
  };


  return {
    step,
    setStep,
    memberForm,
    invalidFields,
    error,
    loading,
    handleChange,
    handleSubmit,
    selectedRole,
    setSelectedRole,
  };
}
