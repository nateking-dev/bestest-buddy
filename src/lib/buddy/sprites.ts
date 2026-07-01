import type { Companion, Species } from './types';

const BODIES: Record<Species, string[][]> = {
  duck: [
    ['            ', '    __      ', '  <({E} )___  ', '   (  ._>   ', '    `--´    '],
    ['            ', '    __      ', '  <({E} )___  ', '   (  ._>   ', '    `--´~   '],
    ['            ', '    __      ', '  <({E} )___  ', '   (  .__>  ', '    `--´    '],
  ],
  goose: [
    ['            ', '     ({E}>    ', '     ||     ', '   _(__)_   ', '    ^^^^    '],
    ['            ', '    ({E}>     ', '     ||     ', '   _(__)_   ', '    ^^^^    '],
    ['            ', '     ({E}>>   ', '     ||     ', '   _(__)_   ', '    ^^^^    '],
  ],
  blob: [
    ['            ', '   .----.   ', '  ( {E}  {E} )  ', '  (      )  ', '   `----´   '],
    ['            ', '  .------.  ', ' (  {E}  {E}  ) ', ' (        ) ', '  `------´  '],
    ['            ', '    .--.    ', '   ({E}  {E})   ', '   (    )   ', '    `--´    '],
  ],
  cat: [
    ['            ', '   /\\_/\\    ', '  ( {E}   {E})  ', '  (  w  )   ', '  (")_(")   '],
    ['            ', '   /\\_/\\    ', '  ( {E}   {E})  ', '  (  w  )   ', '  (")_(")~  '],
    ['            ', '   /\\-/\\    ', '  ( {E}   {E})  ', '  (  w  )   ', '  (")_(")   '],
  ],
  dragon: [
    ['            ', '  /^\\  /^\\  ', ' <  {E}  {E}  > ', ' (   ~~   ) ', '  `-vvvv-´  '],
    ['            ', '  /^\\  /^\\  ', ' <  {E}  {E}  > ', ' (        ) ', '  `-vvvv-´  '],
    ['   ~    ~   ', '  /^\\  /^\\  ', ' <  {E}  {E}  > ', ' (   ~~   ) ', '  `-vvvv-´  '],
  ],
  octopus: [
    ['            ', '   .----.   ', '  ( {E}  {E} )  ', '  (______)  ', '  /\\/\\/\\/\\  '],
    ['            ', '   .----.   ', '  ( {E}  {E} )  ', '  (______)  ', '  \\/\\/\\/\\/  '],
    ['     o      ', '   .----.   ', '  ( {E}  {E} )  ', '  (______)  ', '  /\\/\\/\\/\\  '],
  ],
  owl: [
    ['            ', '   /\\  /\\   ', '  (({E})({E}))  ', '  (  ><  )  ', '   `----´   '],
    ['            ', '   /\\  /\\   ', '  (({E})({E}))  ', '  (  ><  )  ', '   .----.   '],
    ['            ', '   /\\  /\\   ', '  (({E})(-))  ', '  (  ><  )  ', '   `----´   '],
  ],
  penguin: [
    ['            ', '  .---.     ', '  ({E}>{E})     ', ' /(   )\\    ', '  `---´     '],
    ['            ', '  .---.     ', '  ({E}>{E})     ', ' |(   )|    ', '  `---´     '],
    ['  .---.     ', '  ({E}>{E})     ', ' /(   )\\    ', '  `---´     ', '   ~ ~      '],
  ],
  turtle: [
    ['            ', '   _,--._   ', '  ( {E}  {E} )  ', ' /[______]\\ ', '  ``    ``  '],
    ['            ', '   _,--._   ', '  ( {E}  {E} )  ', ' /[______]\\ ', '   ``  ``   '],
    ['            ', '   _,--._   ', '  ( {E}  {E} )  ', ' /[======]\\ ', '  ``    ``  '],
  ],
  snail: [
    ['            ', ' {E}    .--.  ', '  \\  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
    ['            ', '  {E}   .--.  ', '  |  ( @ )  ', '   \\_`--´   ', '  ~~~~~~~   '],
    ['            ', ' {E}    .--.  ', '  \\  ( @  ) ', '   \\_`--´   ', '   ~~~~~~   '],
  ],
  ghost: [
    ['            ', '   .----.   ', '  ( {E}  {E} )  ', '  |  --  |  ', '  ~~~~~~~~  '],
    ['            ', '   .----.   ', '  ( {E}  {E} )  ', '  |  ..  |  ', '  ~~~~~~~~  '],
    ['    o       ', '   .----.   ', '  ( {E}  {E} )  ', '  |  --  |  ', '  ~~~~~~~~  '],
  ],
  axolotl: [
    ['            ', '  ~=({E} {E})=~ ', '   /  ..  \\ ', '  /|      |\\', '   ^^    ^^ '],
    ['            ', '  ~=({E} {E})=~ ', '   /  --  \\ ', '  /|      |\\', '   ^^    ^^ '],
    ['  *      *  ', '  ~=({E} {E})=~ ', '   /  ..  \\ ', '  /|      |\\', '   ^^    ^^ '],
  ],
  capybara: [
    ['            ', '   .----.   ', '  / {E}  {E} \\  ', ' |   --   | ', '  `-____-´  '],
    ['            ', '   .----.   ', '  / {E}  {E} \\  ', ' |   ..   | ', '  `-____-´  '],
    ['   ~~~~~    ', '   .----.   ', '  / {E}  {E} \\  ', ' |   --   | ', '  `-____-´  '],
  ],
  cactus: [
    ['            ', '    _ _     ', '  _| {E} |__  ', ' |  ___   | ', '  `-|-|--´  '],
    ['            ', '    _ _     ', '  _| {E} |__  ', ' |  ___   | ', '   -|-|-    '],
    ['    *       ', '    _ _     ', '  _| {E} |__  ', ' |  ___   | ', '  `-|-|--´  '],
  ],
  robot: [
    ['            ', '   .----.   ', '  | {E}  {E} |  ', '  |  --  |  ', '   /_||_\\   '],
    ['            ', '   .----.   ', '  | {E}  {E} |  ', '  |  ==  |  ', '   /_||_\\   '],
    ['    []      ', '   .----.   ', '  | {E}  {E} |  ', '  |  --  |  ', '   /_||_\\   '],
  ],
  rabbit: [
    ['   /\\  /\\   ', '  ( {E}  {E} )  ', '  (   w  )  ', '  /|    |\\  ', '   ^^  ^^   '],
    ['   /\\  /\\   ', '  ( {E}  {E} )  ', '  (   -  )  ', '  /|    |\\  ', '   ^^  ^^   '],
    ['   /\\  /\\   ', '  ( {E}  {E} )  ', '  (   w  )  ', '  /|    |\\  ', '   ~~  ~~   '],
  ],
  mushroom: [
    ['    ____    ', '  .´ {E}  `.  ', ' /  {E}     \\ ', ' \\   --   / ', '  `-.__.-´  '],
    ['    ____    ', '  .´ {E}  `.  ', ' /  {E}     \\ ', ' \\   ..   / ', '  `-.__.-´  '],
    ['   _**_     ', '  .´ {E}  `.  ', ' /  {E}     \\ ', ' \\   --   / ', '  `-.__.-´  '],
  ],
  chonk: [
    ['            ', '   .----.   ', '  ({E}____{E})  ', '  (  --  )  ', '   `----´   '],
    ['            ', '  .------.  ', ' ({E}______{E}) ', ' (  ....  ) ', '  `------´  '],
    ['    zzz     ', '   .----.   ', '  ({E}____{E})  ', '  (  --  )  ', '   `----´   '],
  ],
};

const HATS: Record<string, string> = {
  none: '            ',
  crown: '    .-.     ',
  tophat: '   _____    ',
  propeller: '    -+-     ',
  halo: '   .---.    ',
  wizard: '     /\\     ',
  beanie: '   _____    ',
  tinyduck: '     __     ',
};

export function spriteFrameCount(species: Species): number {
  return BODIES[species].length;
}

// Species whose head occupies the top body row. When they wear a hat we pad a
// blank row on top so every body has the head on row 1, keeping hat placement uniform.
const HEAD_AT_TOP: ReadonlySet<Species> = new Set(['rabbit', 'mushroom']);

// Each species' true head center (column), measured from eye/head positions.
// The hat is shifted so its own glyph center lands here — to sub-column precision,
// since e.g. a 3-char hat can't sit at column 5.5 without a fractional nudge.
const HEAD_CENTER: Record<Species, number> = {
  duck: 4,
  goose: 6,
  blob: 5.5,
  cat: 5,
  dragon: 5.5,
  octopus: 5.5,
  owl: 5.5,
  penguin: 4,
  turtle: 5.5,
  snail: 7.5, // the shell, not the eyestalk
  ghost: 5.5,
  axolotl: 6,
  capybara: 5.5,
  cactus: 5,
  robot: 5.5,
  rabbit: 5.5,
  mushroom: 5.5,
  chonk: 5.5,
};

const BLANK_ROW = '            ';

// Column index of the midpoint between a string's first and last non-space glyph.
function glyphCenter(s: string): number {
  const cols: number[] = [];
  [...s].forEach((ch, i) => {
    if (ch !== ' ') cols.push(i);
  });
  return cols.length ? (cols[0] + cols[cols.length - 1]) / 2 : (s.length - 1) / 2;
}

export function renderSprite(companion: Companion, frame: number): string[] {
  const speciesFrames = BODIES[companion.species];
  const frameLines = speciesFrames[frame % speciesFrames.length];
  const lines = frameLines.map((line) => line.replaceAll('{E}', companion.eye));
  // Head-at-top species need a blank row above so the hat (drawn separately and
  // floated above row 1) doesn't land on their ears/cap.
  return HEAD_AT_TOP.has(companion.species) && companion.hat !== 'none'
    ? [BLANK_ROW, ...lines]
    : lines;
}

// The hat is drawn as its own line above the sprite (see BuddyView). `offsetColumns`
// is how far to slide it (in body columns, may be fractional) to center over the head.
// Returns null when no hat is worn.
export function renderHat(companion: Companion): { line: string; offsetColumns: number } | null {
  if (companion.hat === 'none') return null;
  const line = HATS[companion.hat] ?? HATS.none;
  const offsetColumns = (HEAD_CENTER[companion.species] ?? 5.5) - glyphCenter(line);
  return { line, offsetColumns };
}

export function renderFace(companion: Companion): string {
  switch (companion.species) {
    case 'duck':
      return `(${companion.eye}>`;
    case 'blob':
      return `${companion.eye}_${companion.eye}`;
    case 'dragon':
      return `^${companion.eye}${companion.eye}^`;
    default:
      return `${companion.eye}${companion.eye}`;
  }
}

