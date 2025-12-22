import { useState } from "react";

type MemberForm = {
  firstName: string;
  lastName: string;
  email: string;
};

export function useAddContact() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  const validateStep2 = () => {
    const errors: string[] = [];
    if (!formData.firstName) errors.push("firstName");
    if (!formData.lastName) errors.push("lastName");
    if (!formData.email) errors.push("email");
    return errors;
  };

  const nextFromStep2 = () => {
    const errors = validateStep2();
    if (errors.length) {
      setInvalidFields(errors);
      return;
    }
    setStep(3);
  };

  return {
    step,
    setStep,
    formData,
    invalidFields,
    handleChange,
    nextFromStep2,
  };
}
