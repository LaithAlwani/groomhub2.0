export function digitsOnly(phone: string | undefined | null): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * Formats a US-style phone number as xxx-xxx-xxxx. 11-digit numbers that
 * start with "1" are formatted the same way, dropping the country code.
 * Anything else is returned as-is (digits only) so unusual lengths still
 * render legibly.
 */
export function formatPhone(phone: string | undefined | null): string {
  const digits = digitsOnly(phone);
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits;
}
