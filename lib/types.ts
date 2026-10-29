export type Id = string | number;
export type Row = Record<string, unknown>;
export type Role = "teacher" | "superadmin";
export type Profile = {
  id: Id;
  name?: string;
  username?: string;
  email?: string;
  role: string;
  institute?: string;
  department?: string;
};
export type Session = {
  profile: Profile;
  accessToken: string;
  refreshToken: string;
};
export type Envelope<T> = {
  success: boolean;
  message?: string;
  data: T;
  error?: unknown;
};
export type Option = { value: string; label: string };
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "richtext"
    | "number"
    | "email"
    | "url"
    | "date"
    | "time"
    | "password"
    | "select"
    | "multiselect";
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  value?: string;
  options?: Option[];
  source?: string;
  hint?: string;
};
export type Resource = {
  title: string;
  endpoint: string;
  columns: [string, string][];
  fields?: Field[];
  createTitle?: string;
  createPath?: string;
  unavailable?: string;
};
