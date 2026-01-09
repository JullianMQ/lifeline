export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: string;
  phone_no: string;
}

export interface Contact {
  name: string;
  email?: string | null;
  phone: string;
  image?: string;
}