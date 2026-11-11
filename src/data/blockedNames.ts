// Leaderboard names that are refused (06 §14.3, M19): checked case-insensitively, also inside longer names.
// Kept short and plain; it stops the obvious cases, not every one.
export const BLOCKED_NAMES: readonly string[] = [
  'admin', 'moderator', 'anthropic', 'rushblade',
  'fuck', 'fuk', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'dick', 'cock', 'pussy', 'penis', 'vagina', 'anal', 'porn', 'sex',
  'nigg', 'nigga', 'fag', 'retard', 'nazi', 'hitler', 'kkk', 'rape', 'pedo',
];
export const NAME_PRIVACY = 'We store this name and your times on the leaderboard. Nothing else is sent.';
