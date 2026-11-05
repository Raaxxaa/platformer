// Online daily leaderboard (06 §14.3, M18). The user's free Supabase project. With no URL, the leaderboard is
// hidden and nothing is sent. The anon key is public by design; the table's row rules protect the data.
export const ONLINE = {
  url: '' as string,
  anonKey: '' as string,
  table: 'daily_scores', resultTop: 10, listTop: 50, pastDays: 30, timeoutMs: 8000,
  namePrompt: 'Your leaderboard name (3–12 letters, numbers or _)', unavailable: 'Leaderboard unavailable',
} as const;
export const BOARD_UI = {
  panel: [80, 16, 480, 328] as const, titleY: 24, rowsY: 46, rowStep: 14, listY: 128, listStep: 11, listShown: 16, colRank: 120, colName: 150, colTime: 470, colKit: 280, highlightWidth: 400, hintY: 318,
  rows: ['day', 'list', 'name', 'send', 'back'] as const,
} as const;
