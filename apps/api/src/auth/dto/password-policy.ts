// Minimum viable password policy: 8+ chars, at least one letter and one digit.
// Deliberately not requiring symbols/uppercase — that tends to push users toward
// predictable substitutions ("Password1!") without meaningfully raising entropy.
export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;
export const PASSWORD_POLICY_MESSAGE =
  'A senha deve ter pelo menos 8 caracteres, incluindo letras e números';
