const enabled = (Boolean(process.stdout.isTTY) || Boolean(process.env.FORCE_COLOR)) && !process.env.NO_COLOR && !process.argv.includes('--no-color');

const wrap = (code) => (text) => (enabled ? `\x1b[${code}m${text}\x1b[0m` : String(text));

export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
  gray: wrap('90'),
  inverseRed: wrap('1;97;41'),
  inverseOrange: wrap('1;30;48;5;208'),
  inverseYellow: wrap('1;30;43'),
  inverseBlue: wrap('1;97;44'),
  inverseGray: wrap('1;97;100'),
};

export const BADGES = {
  critical: (s) => c.inverseRed(s),
  high: (s) => c.inverseOrange(s),
  medium: (s) => c.inverseYellow(s),
  low: (s) => c.inverseBlue(s),
  info: (s) => c.inverseGray(s),
};

export const TONES = {
  critical: c.red,
  high: wrap('38;5;208'),
  medium: c.yellow,
  low: c.blue,
  info: c.gray,
};
