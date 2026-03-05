const RANDOM_NAMES = [
  "Fox", "Owl", "Bear", "Wolf", "Hawk",
  "Deer", "Lynx", "Seal", "Hare", "Crow",
  "Dove", "Swan", "Wren", "Lark", "Puma",
];

export function getRandomName(): string {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}

export function getRandomColor(): string {
  const COLORS = [
    "#ef4444", "#3b82f6", "#22c55e", "#f97316",
    "#ec4899", "#06b6d4", "#eab308", "#8b5cf6",
    "#14b8a6", "#f43f5e",
  ];
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}
