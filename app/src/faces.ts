// Faces come from DiceBear's line-face set. The seed is the person's id, never their name,
// so no names leave the device. Failed loads (offline, blocked) fall back to initials.
const BASE = 'https://api.dicebear.com/10.x/line-face/svg?seed=';
export const faceUrl = (id: string) => BASE + encodeURIComponent(id);

export function initials(name: string | undefined, isMe: boolean, sex: string): string {
  const t = (name ?? '').trim();
  if (t) return [...t].slice(0, 2).join('').toUpperCase();
  return isMe ? 'Me' : sex === 'm' ? '♂' : '♀';
}
