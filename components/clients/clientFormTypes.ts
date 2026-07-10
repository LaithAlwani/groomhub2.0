import { EMPTY_PHONE, type PhoneFormEntry } from "./clientPhones";

export type ClientFormState = {
  firstName: string;
  lastName: string;
  phones: PhoneFormEntry[];
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  notes: string;
};

export type FieldErrors = Partial<
  Record<keyof ClientFormState | "fullName", string>
>;

export type SetField = <K extends keyof ClientFormState>(
  key: K,
  value: ClientFormState[K],
) => void;

export const INITIAL_STATE: ClientFormState = {
  firstName: "",
  lastName: "",
  phones: [{ ...EMPTY_PHONE }],
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  notes: "",
};
