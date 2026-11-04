export function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

/** Digit-based match that tolerates country-code / formatting differences. */
export function samePhone(aDigits: string, bPhone: string) {
  const bDigits = digitsOnly(bPhone);
  return Boolean(aDigits && bDigits && (aDigits.endsWith(bDigits) || bDigits.endsWith(aDigits)));
}
