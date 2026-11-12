import { CAP, GLASSES, HAIR_BUN, HAIR_CURLY, HAIR_LONG, PERSON, type Sprite } from "@/components/pixel-sprites";
import { personas } from "@/lib/demo/personas";

export type HairStyle = "short" | "long" | "bun" | "curly" | "cap";

export interface AvatarLook {
  skin: string;
  hair: string;
  shirt: string;
  cap: string;
  hairStyle: HairStyle;
  glasses: boolean;
}

// Neutral on purpose. Nothing here marks a religion or a group, so any account can land on any combination.
const SKIN = ["#F7C9A4", "#E8B48A", "#D39A6B", "#B87A4B", "#8F5A35", "#6B4125"] as const;
const HAIR = ["#2A1A12", "#4A2E1C", "#7A4A2A", "#1F1F24", "#8A5A2B", "#5A3A55"] as const;
const SHIRT = ["#D8453B", "#2F6B3F", "#3E6FB0", "#C98A1B", "#7B5BA8", "#D96A8E", "#2C8C8C", "#E07A3A"] as const;
const CAPS = ["#3A2A1A", "#2F6B3F", "#3E6FB0", "#D8453B"] as const;
// "short" is listed twice so it is the most common look.
const STYLES: readonly HairStyle[] = ["short", "short", "long", "bun", "curly", "cap"];

/** The five demo accounts keep one look each, so the story reads the same everywhere (and in the video). */
const CURATED: Record<string, AvatarLook> = {
  ayu: { skin: "#F7C9A4", hair: "#2A1A12", shirt: "#D8453B", cap: "#3A2A1A", hairStyle: "bun", glasses: false },
  budi: { skin: "#E8B48A", hair: "#7A4A2A", shirt: "#2F6B3F", cap: "#3A2A1A", hairStyle: "short", glasses: false },
  citra: { skin: "#D39A6B", hair: "#2A1A12", shirt: "#C98A1B", cap: "#3A2A1A", hairStyle: "long", glasses: true },
  dewi: { skin: "#B87A4B", hair: "#4A2E1C", shirt: "#7B5BA8", cap: "#3A2A1A", hairStyle: "curly", glasses: false },
  eko: { skin: "#E8B48A", hair: "#2A1A12", shirt: "#3E6FB0", cap: "#3E6FB0", hairStyle: "cap", glasses: false },
};

/** FNV-1a. Same text, same number, on every device. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Picks one entry. The salt `k` makes each trait use its own part of the hash, so traits do not move together. */
function pick<T>(list: readonly T[], h: number, k: number): T {
  let x = Math.imul(h ^ Math.imul(k + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0; // XOR gives a signed number, so every step goes back to unsigned
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return list[x % list.length] as T;
}

/**
 * The look of an account. `seed` is the account id when there is one, otherwise the name. The same seed always
 * gives the same look, nothing is stored, and a demo account gets its curated look.
 */
export function avatarLook(name: string, seed?: string): AvatarLook {
  const demo = personas.find((p) => (seed ? p.account_id === seed : p.name.toLowerCase() === name.trim().toLowerCase()));
  const curated = demo ? CURATED[demo.id] : undefined;
  if (curated) return curated;
  const h = hash((seed ?? name).toLowerCase());
  return {
    skin: pick(SKIN, h, 0),
    hair: pick(HAIR, h, 1),
    shirt: pick(SHIRT, h, 2),
    cap: pick(CAPS, h, 3),
    hairStyle: pick(STYLES, h, 4),
    glasses: pick([false, false, false, true], h, 5),
  };
}

function layer(base: Sprite, over: Sprite): string[] {
  return base.map((row, y) => {
    const o = over[y] ?? "";
    let out = "";
    for (let x = 0; x < row.length; x++) {
      const ch = o[x] ?? ".";
      out += ch === "." ? row[x] : ch;
    }
    return out;
  });
}

/** The head and shoulders of a look, 16 by 15 pixels, plus the colors to draw it with. */
export function avatarSprite(look: AvatarLook): { sprite: Sprite; palette: Record<string, string> } {
  let sprite: Sprite = PERSON;
  if (look.hairStyle === "long") sprite = layer(sprite, HAIR_LONG);
  if (look.hairStyle === "bun") sprite = layer(sprite, HAIR_BUN);
  if (look.hairStyle === "curly") sprite = layer(sprite, HAIR_CURLY);
  if (look.hairStyle === "cap") sprite = layer(sprite, CAP);
  if (look.glasses) sprite = layer(sprite, GLASSES);
  return {
    sprite: sprite.slice(0, 15),
    palette: { S: look.skin, h: look.hair, r: look.shirt, c: look.cap },
  };
}
