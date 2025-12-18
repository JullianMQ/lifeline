import { useState } from "react";

type MemberForm = {
  firstName: string;
  lastName: string;
  email: string;
};

export function useAddContact() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedRole, setSelectedRole] = useState<"mutual" | "dependent">("mutual");
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [formData, setFormData] = useState<MemberForm>({
    firstName: "",
    lastName: "",
    email: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setInvalidFields(prev => prev.filter(f => f !== name));
  };

  const validateStep3 = () => {
    const errors: string[] = [];
    if (!formData.firstName) errors.push("firstName");
    if (!formData.lastName) errors.push("lastName");
    if (!formData.email) errors.push("email");
    return errors;
  };

  const nextFromStep3 = () => {
    const errors = validateStep3();
    if (errors.length) {
      setInvalidFields(errors);
      return;
    }
    setStep(4);
  };

  return {
    step,
    setStep,
    selectedRole,
    setSelectedRole,
    formData,
    invalidFields,
    handleChange,
    nextFromStep3,
  };
}
