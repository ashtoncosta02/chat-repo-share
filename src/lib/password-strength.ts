export type PasswordCheck = { label: string; passed: boolean };

export function checkPassword(pwd: string): PasswordCheck[] {
  return [
    { label: "At least 8 characters", passed: pwd.length >= 8 },
    { label: "One uppercase letter", passed: /[A-Z]/.test(pwd) },
    { label: "One lowercase letter", passed: /[a-z]/.test(pwd) },
    { label: "One number", passed: /[0-9]/.test(pwd) },
    { label: "One symbol", passed: /[^A-Za-z0-9]/.test(pwd) },
  ];
}

export function isPasswordStrong(pwd: string): boolean {
  return checkPassword(pwd).every((c) => c.passed);
}

export const PASSWORD_REQUIREMENTS_TEXT =
  "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.";
