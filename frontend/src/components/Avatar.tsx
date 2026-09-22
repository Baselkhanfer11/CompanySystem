// A colored initials avatar. Color is derived from the name so it's stable per person.
const GRADIENTS = [
  'linear-gradient(135deg,#7c6cff,#b06cff)',
  'linear-gradient(135deg,#33d6e6,#4f8cff)',
  'linear-gradient(135deg,#34d399,#10b981)',
  'linear-gradient(135deg,#fbbf24,#f97316)',
  'linear-gradient(135deg,#fb7185,#e11d48)',
  'linear-gradient(135deg,#a78bfa,#6366f1)',
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function pick(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  return (
    <div
      className="avatar"
      style={{ background: pick(name), width: size, height: size, fontSize: size * 0.37 }}
    >
      {initials(name)}
    </div>
  );
}
