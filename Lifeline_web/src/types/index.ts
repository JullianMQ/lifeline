import type { ContactCard } from "./realtime";

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: string;
  phone_no: string;
  location?: { lat: number; lng: number };
}

export interface Contact {
  name: string;
  email?: string | null;
  phone: string;
  image?: string;
  location?: { lat: number; lng: number };
  role: "mutual" | "dependent";
}

export type LatLng = {
  lat: number;
  lng: number;
};

export type pinMarker = {
  lat: number;
  lng: number;
  id?: string;
  image: string;
  contact: ContactCard;
};