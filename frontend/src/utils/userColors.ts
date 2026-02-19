interface UserColorPalette {
  textColor: string;
  borderColor: string;
  backgroundColor: string;
  glowColor: string;
}

const BLUE_HUE = 205;
const MAGENTA_HUE = 318;

function hashUsername(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i += 1) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getUserColorPalette(username: string): UserColorPalette {
  const normalized = username.trim().toLowerCase();
  const hueRange = MAGENTA_HUE - BLUE_HUE + 1;
  const hue = BLUE_HUE + (hashUsername(normalized) % hueRange);

  return {
    textColor: `hsl(${hue}, 100%, 72%)`,
    borderColor: `hsla(${hue}, 95%, 70%, 0.55)`,
    backgroundColor: `hsla(${hue}, 95%, 62%, 0.12)`,
    glowColor: `0 0 12px hsla(${hue}, 95%, 70%, 0.18)`,
  };
}
