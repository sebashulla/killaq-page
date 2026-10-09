import type { User } from "@supabase/supabase-js";

export type DocumentType = "dni" | "carnet_extranjeria" | "pasaporte" | "ruc";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: "customer" | "admin";
  document_type?: DocumentType | null;
  document_number?: string | null;
  birthdate?: string | null;
  residence_country?: string | null;
  residence_city?: string | null;
  residence_district?: string | null;
  residence_address?: string | null;
  reference_note?: string | null;
}

export interface SessionUser {
  user: User;
  profile: Profile | null;
}
