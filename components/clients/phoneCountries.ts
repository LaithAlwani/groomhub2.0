import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

export type CountryOption = { code: CountryCode; calling: string };

/** Every dialable country, sorted by ISO code, with its calling code. */
export const COUNTRY_OPTIONS: CountryOption[] = getCountries()
  .map((code) => ({ code, calling: getCountryCallingCode(code) }))
  .sort((first, second) => first.code.localeCompare(second.code));
