/**
 * Pixel art, drawn as text. One character is one pixel and `.` is empty. The letters are colors from
 * PALETTE in pixel.tsx, so a sprite can be recolored without redrawing it (the two people share one body).
 * Every row of a sprite must have the same length, which pixel.test.ts checks.
 */
export type Sprite = readonly string[];

/** The guest book: an open page with lines of writing. Used for "a record nobody edits alone". */
export const BOOK: Sprite = [
  "................",
  "................",
  "..KKKKKKKKKKKK..",
  ".KCCCCCKKCCCCCK.",
  ".KCEEECKKCEEECK.",
  ".KCCCCCKKCCCCCK.",
  ".KCEEEEKKCEEECK.",
  ".KCCCCCKKCCCCCK.",
  ".KCEEECKKCEEEEK.",
  ".KCCCCCKKCCCCCK.",
  ".KCEEECKKCEEECK.",
  ".KCCCCCKKCCCCCK.",
  ".KDDDDDDDDDDDDK.",
  "..KKKKKKKKKKKK..",
  "................",
  "................",
];

/** An open eye. Used for "amounts are public". */
export const EYE: Sprite = [
  "................",
  "................",
  "................",
  "....KKKKKKKK....",
  "...KWWWWWWWWK...",
  "..KWWWKKKKWWWK..",
  ".KWWWKNNNNKWWWK.",
  "KWWWKNNHHNNKWWWK",
  "KWWWKNWHHNNKWWWK",
  ".KWWWKNNNNKWWWK.",
  "..KWWWKKKKWWWK..",
  "...KWWWWWWWWK...",
  "....KKKKKKKK....",
  "................",
  "................",
  "................",
];

/** A flask with a bubble. Used for "testnet only". */
export const FLASK: Sprite = [
  "................",
  ".....KKKKKK.....",
  ".....KWWWWK.....",
  ".....KWWWWK.....",
  ".....KWWWWK.....",
  ".....KWWWWK.....",
  "....KWWWWWWK....",
  "...KWWWWWWWWK...",
  "..KWWWnnnnWWWK..",
  "..KWWnnnnnnWWK..",
  ".KWWnnnnnnnnWWK.",
  ".KWnnnWnnnnnnWK.",
  ".KWnnnnnnnnnnWK.",
  "..KKKKKKKKKKKK..",
  "................",
  "................",
];

/** A treasure chest with a gold lock. Used for "one shared vault". */
export const CHEST: Sprite = [
  "................",
  "................",
  "................",
  "...KKKKKKKKKK...",
  "..KBBBBBBBBBBK..",
  ".KBBTBBBBBBTBBK.",
  ".KBBBBBBBBBBBBK.",
  ".KKKKKKGGKKKKKK.",
  ".KBBBBKGgKBBBBK.",
  ".KBTBBBGGBBBTBK.",
  ".KBBBBBBBBBBBBK.",
  ".KBBBBBBBBBBBBK.",
  ".KKKKKKKKKKKKKK.",
  "................",
  "................",
  "................",
];

/** A paper lantern. Used for "a gift tradition". */
export const LANTERN: Sprite = [
  "................",
  ".......KK.......",
  ".......KK.......",
  ".....KKKKKK.....",
  "....KGGGGGGK....",
  "...KRRLRRRRRK...",
  "..KRRLRRRRRRRK..",
  "..KRRLRRRRRRRK..",
  "..KRRRRRRRRRRK..",
  "..KRRRRRRRRRRK..",
  "..KRRRRRRRRRRK..",
  "...KRRRRRRRRK...",
  "....KGGGGGGK....",
  ".....KKKKKK.....",
  "......G..G......",
  "......G..G......",
];

/** A person. `h` is hair and `r` is the shirt, so each guest gets a palette of their own. */
export const PERSON: Sprite = [
  "................",
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "...hhhhhhhhhh...",
  "...hhSSSSSShh...",
  "...hSSSSSSSSh...",
  "...hSKSSSSKSh...",
  "...hSOSSSSOSh...",
  "....SSSSSSSS....",
  ".....SSKKSS.....",
  "...rrrrrrrrrr...",
  "..rrrrrrrrrrrr..",
  "..SrrrrrrrrrrS..",
  "..SrrrrrrrrrrS..",
  "...rrrrrrrrrr...",
  "....KK....KK....",
];

/** The envelope with its little face, Pao in pixels. */
export const ENVELOPE: Sprite = [
  "................",
  "................",
  "................",
  ".KKKKKKKKKKKKKK.",
  ".KDRRRRRRRRRRDK.",
  ".KRDRRRRRRRRDRK.",
  ".KRRDRRRRRRDRRK.",
  ".KRRRDDGGDDRRRK.",
  ".KRRRRRGGRRRRRK.",
  ".KRRKRRRRRRKRRK.",
  ".KROORRKKRROORK.",
  ".KRRRRRRRRRRRRK.",
  ".KDDDDDDDDDDDDK.",
  ".KKKKKKKKKKKKKK.",
  "................",
  "................",
];

/** A gold coin with a dollar sign. */
export const COIN: Sprite = [
  "................",
  ".....KKKKKK.....",
  "...KKGGGGGGKK...",
  "..KGGYYGGGGGGK..",
  ".KGGYGGGGGGGGgK.",
  ".KGYGGGggggGGgK.",
  ".KGGGGgGGGGGGgK.",
  ".KGGGGgGGGGGGgK.",
  ".KGGGGggggGGGgK.",
  ".KGGGGGGGGgGGgK.",
  ".KGGGGGGGGgGGgK.",
  ".KGGGgggggGGGgK.",
  ".KGGGGGGGGGGGgK.",
  "..KGGGGGGGGGgK..",
  "...KKggggggKK...",
  ".....KKKKKK.....",
];

/** A green stamp with a check mark: repaid. */
export const CHECK: Sprite = [
  "................",
  ".....KKKKKK.....",
  "...KKNNNNNNKK...",
  "..KNNNNNNNNNNK..",
  ".KNNNNNNNNNNNNK.",
  ".KNNNNNNNNNNWNK.",
  ".KNNNNNNNNNWWNK.",
  ".KNNNWNNNNWWNNK.",
  ".KNNNWWNNWWNNNK.",
  ".KNNNNWWWWNNNNK.",
  ".KNNNNNWWNNNNNK.",
  ".KNNNNNNNNNNNNK.",
  "..KNNNNNNNNNNK..",
  "...KKNNNNNNKK...",
  ".....KKKKKK.....",
  "................",
];

/** A right arrow. `K` takes whatever color the page gives it. */
export const ARROW: Sprite = [
  ".....K......",
  ".....KK.....",
  "KKKKKKKKK...",
  "KKKKKKKKKK..",
  "KKKKKKKKKKK.",
  "KKKKKKKKKK..",
  "KKKKKKKKK...",
  ".....KK.....",
  ".....K......",
];
