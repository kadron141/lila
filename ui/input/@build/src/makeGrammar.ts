import * as ps from 'node:process';
import * as fs from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

// requires node 18.x

const defaultCrowdvFile = 'crowdv-27-02-2023.json';

const lexicon: Entry[] = [
  { in: 'a', tok: 'a', tags: ['file', 'move'] },
  { in: 'b', tok: 'b', tags: ['file', 'move'] },
  { in: 'c', tok: 'c', tags: ['file', 'move'] },
  { in: 'd', tok: 'd', tags: ['file', 'move'] },
  { in: 'e', tok: 'e', tags: ['file', 'move'] },
  { in: 'f', tok: 'f', tags: ['file', 'move'] },
  { in: 'g', tok: 'g', tags: ['file', 'move'] },
  { in: 'h', tok: 'h', tags: ['file', 'move'] },

  { in: 'one', tok: '1', tags: ['rank', 'move'] },
  { in: 'two', tok: '2', tags: ['rank', 'move'] },
  { in: 'three', tok: '3', tags: ['rank', 'move'] },
  { in: 'four', tok: '4', tags: ['rank', 'move'] },
  { in: 'five', tok: '5', tags: ['rank', 'move'] },
  { in: 'six', tok: '6', tags: ['rank', 'move'] },
  { in: 'seven', tok: '7', tags: ['rank', 'move'] },
  { in: 'eight', tok: '8', tags: ['rank', 'move'] },

  { in: 'pawn', tok: 'P', tags: ['role', 'move'] },
  { in: 'knight', tok: 'N', tags: ['role', 'move'] },
  { in: 'bishop', tok: 'B', tags: ['role', 'move'] },
  { in: 'rook', tok: 'R', tags: ['role', 'move'] },
  { in: 'queen', tok: 'Q', tags: ['role', 'move'] },
  { in: 'king', tok: 'K', tags: ['role', 'move'] },

  { in: 'castle', val: 'O-O', tags: ['move', 'exact'] },
  { in: 'short castle', val: 'O-O', tags: ['move', 'exact'] },
  { in: 'king side castle', val: 'O-O', tags: ['move', 'exact'] },
  { in: 'castle king side', val: 'O-O', tags: ['move', 'exact'] },
  { in: 'long castle', val: 'O-O-O', tags: ['move', 'exact'] },
  { in: 'castle queen side', val: 'O-O-O', tags: ['move', 'exact'] },
  { in: 'queen side castle', val: 'O-O-O', tags: ['move', 'exact'] },

  { in: 'takes', val: 'x', tags: ['move'] },
  { in: 'captures', val: 'x', tags: ['move'] },
  { in: 'promote', val: '=', tags: ['move'] },
  { in: 'promotes', val: '=', tags: ['move'] },
  { in: 'mate', val: '', tags: ['move', 'ignore'] },
  { in: 'check', val: '', tags: ['move', 'ignore'] },
  { in: 'takeback', val: 'takeback', tags: ['command', 'rounds', 'exact'] },
  { in: 'draw', val: 'draw', tags: ['command', 'rounds', 'exact'] },
  { in: 'offer draw', val: 'draw', tags: ['command', 'rounds', 'exact'] },
  { in: 'accept draw', val: 'draw', tags: ['command', 'rounds', 'exact'] },
  { in: 'resign', val: 'resign', tags: ['command', 'rounds', 'exact'] },

  { in: 'rematch', val: 'rematch', tags: ['command', 'exact'] },
  { in: 'next', val: 'next', tags: ['command', 'exact'] },
  //{ in: 'skip', val: 'next', tags: ['command', 'exact'] },
  //{ in: 'continue', val: 'next', tags: ['command', 'exact'] },
  { in: 'back', val: 'back', tags: ['command', 'exact'] },
  //{ in: 'last', val: 'last', tags: ['command', 'exact'] },
  //{ in: 'first', val: 'first', tags: ['command', 'exact'] },
  { in: 'up vote', val: 'upv', tags: ['command', 'exact'] },
  { in: 'down vote', val: 'downv', tags: ['command', 'exact'] },
  { in: 'help', val: '?', tags: ['command', 'exact'] },
  { in: 'clock', val: 'clock', tags: ['command', 'exact'] },
  { in: 'opponent', val: 'who', tags: ['command', 'exact'] },
  { in: 'stop', val: 'stop', tags: ['command', 'exact'] },

  { in: 'red', val: 'red', tags: ['choice', 'exact'] },
  { in: 'yellow', val: 'yellow', tags: ['choice', 'exact'] },
  { in: 'green', val: 'green', tags: ['choice', 'exact'] },
  { in: 'blue', val: 'blue', tags: ['choice', 'exact'] },
  { in: 'yes', val: 'yes', tags: ['choice', 'exact'] },
  { in: 'okay', val: 'yes', tags: ['choice', 'exact'] },
  { in: 'confirm', val: 'yes', tags: ['choice', 'exact'] },
  { in: 'no', val: 'no', tags: ['choice', 'exact'] },
  { in: 'clear', val: 'no', tags: ['choice', 'exact'] },
  { in: 'close', val: 'no', tags: ['choice', 'exact'] },
  { in: 'cancel', val: 'no', tags: ['choice', 'exact'] },
  { in: 'abort', val: 'no', tags: ['choice', 'exact'] },

  { in: 'puzzle', val: '', tags: ['ignore'] },
  { in: 'and', val: '', tags: ['ignore'] },
  { in: 'oh', val: '', tags: ['ignore'] },
  { in: 'um', val: '', tags: ['ignore'] },
  { in: 'uh', val: '', tags: ['ignore'] },
  { in: 'hmm', val: '', tags: ['ignore'] },
  { in: 'huh', val: '', tags: ['ignore'] },
  { in: 'his', val: '', tags: ['ignore'] },
  { in: 'her', val: '', tags: ['ignore'] },
  { in: 'the', val: '', tags: ['ignore'] },
  { in: 'their', val: '', tags: ['ignore'] },
];

const buildMode: SubRestriction = { del: true, sub: 2 }; // allow dels and/or specify max sub length

function buildCostMap(
  subMap: Map<string, SubInfo>, // the map of all valid substitutions within --max-ops distance
  freqThreshold: number, // minimum frequency of a substitution to be considered
  countThreshold: number // minimum count for a substitution to be considered
) {
  const costMax = 0.9;
  const subCostMin = 0.4;
  const delCostMin = 0.2;

  // we don't do anything with crowdv json confs, don't trust em
  const costs = [...subMap.entries()]
    .filter(([_, e]) => e.freq >= freqThreshold && e.count >= countThreshold)
    .sort((a, b) => b[1].freq - a[1].freq);

  costs.forEach(([_, v], i) => {
    v.cost = ((costMax - subCostMin) * i) / costs.length + (v.tpe === 'del' ? delCostMin : subCostMin);
  });
  return new Map(costs);
}

async function main() {
  const opThreshold = parseInt(getArg('max-ops') ?? '1');
  const freqThreshold = parseFloat(getArg('freq') ?? '0.003');
  const countThreshold = parseInt(getArg('count') ?? '6');
  const lexfile = getArg('out') ?? '../src/voiceMoveGrammar.ts';
  const subMap = new Map<string, SubInfo>();
  const entries = (await parseCrowdvData(getArg('in') ?? defaultCrowdvFile))
    .map(data => makeLexEntry(data))
    .filter(x => x) as LexEntry[];

  for (const e of entries.filter(e => e.h != e.x)) {
    parseTransforms(findTransforms(e.h, e.x, buildMode), e, subMap, opThreshold);
  }
  subMap.forEach(v => (v.freq = v.count / v.all));

  buildCostMap(subMap, freqThreshold, countThreshold).forEach((sub, key) => {
    ppCost(key, sub);
    const [from, to] = key.split(' ');
    grammarBuilder.addSub(from, { to: to, cost: sub.cost ?? 1 });
  });
  writeGrammar(lexfile);
}

// flatten list of transforms into sub map
function parseTransforms(xss: Transform[][], entry: LexEntry, subMap: Map<string, SubInfo>, opThreshold = 1) {
  return xss
    .filter(xss => xss.length <= opThreshold)
    .forEach(xs =>
      xs.forEach(x => {
        const cost = subMap.get(`${x.from} ${x.to}`) ?? {
          tpe: x.to === '' ? 'del' : 'sub',
          count: 0,
          all: grammarBuilder.occurrences.get(x.from || x.to)!,
          conf: 0,
          freq: 0,
        };
        cost.count++;
        cost.conf += x.at < entry.c.length ? entry.c[x.at] : 0;
        subMap.set(`${x.from} ${x.to}`, cost);
      })
    );
}

// find transforms to turn h (heard) into x (exact)
function findTransforms(
  h: string,
  x: string,
  mode: SubRestriction,
  pos = 0, // for recursion
  line: Transform[] = [],
  lines: Transform[][] = [],
  crumbs = new Map<string, number>()
): Transform[][] {
  if (h === x) return [line];
  if (pos >= x.length && !mode.del) return [];
  if (crumbs.has(h + pos) && crumbs.get(h + pos)! <= line.length) return [];
  crumbs.set(h + pos, line.length);

  return validOps(h, x, pos, mode).flatMap(({ hnext, op }) =>
    findTransforms(
      hnext,
      x,
      mode,
      pos + (op === 'skip' ? 1 : op.to.length),
      op === 'skip' ? line : [...line, op],
      lines,
      crumbs
    )
  );
}

function validOps(h: string, x: string, pos: number, mode: SubRestriction) {
  const validOps: { hnext: string; op: Transform | 'skip' }[] = [];
  if (h[pos] === x[pos]) validOps.push({ hnext: h, op: 'skip' });
  const minSlice = mode.del !== true || validOps.length > 0 ? 1 : 0;
  let slen = Math.min(mode.sub ?? 0, x.length - pos);
  while (slen >= minSlice) {
    const slice = x.slice(pos, pos + slen);
    if (pos < h.length && !(slen > 0 && h.startsWith(slice, pos)))
      validOps.push({
        hnext: h.slice(0, pos) + slice + h.slice(pos + 1),
        op: { from: h[pos], at: pos, to: slice }, // replace h[pos] with slice
      });
    slen--;
  }
  return validOps;
}

function makeLexEntry(entry: CrowdvData): LexEntry | undefined {
  const xset = new Set([...grammarBuilder.encode(entry.exact)]);
  const hunique = [...new Set([...grammarBuilder.encode(entry.heard)])];
  if (hunique.filter(h => xset.has(h)).length < xset.size - 2) return undefined;
  if (entry.heard.endsWith(' next')) entry.heard = entry.heard.slice(0, -5);
  grammarBuilder.addOccurrence(entry.heard); // for token frequency
  return {
    h: grammarBuilder.encode(entry.heard),
    x: grammarBuilder.encode(entry.exact),
    c: entry.data.map(x => x.conf),
  };
}

function ppCost(key: string, e: SubInfo) {
  const grey = (s: string) => `\x1b[30m${s}\x1b[0m`;
  const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
  const nameC = (s: string) => `\x1b[36m${s}\x1b[0m`;
  const opC = (s: string) => `\x1b[0m${s}\x1b[0m`;
  const valueC = (s: string) => `\x1b[0m${s}\x1b[0m`;
  const prettyPair = (k: string, v: string) => `${nameC(k)}${grey(':')} ${valueC(v)}`;
  const [from, to] = key.split(' ').map(x => grammarBuilder.wordsOf(x));
  console.log(
    `'${opC(from)}${grey(' => ')}${to === '' ? red('<delete>') : opC(to)}'${grey(':')} { ` +
      [
        prettyPair('count', `${e.count}`),
        prettyPair('all', `${e.all}`),
        prettyPair('conf', (e.conf / e.count).toFixed(2)),
        prettyPair('freq', e.freq.toFixed(3)),
        prettyPair('cost', e.cost?.toFixed(2) ?? '1'),
      ].join(grey(', ')) +
      ` }${grey(',')}`
  );
}

function writeGrammar(out: string) {
  fs.writeFileSync(
    out,
    '// *************************** this file is generated. see ui/input/@build/README.md ***************************\n\n' +
      'export type Sub = { to: string, cost: number };\n\n' +
      `export type Tag = 'file' | 'rank' | 'role' | 'move' | 'choice' | 'command' | 'ignore' | 'exact' | 'rounds';\n\n` +
      'export type Entry = { in: string, tok: string, tags: Tag[], val?: string, subs?: Sub[] };\n\n' +
      `export const lexicon: Entry[] = ${JSON.stringify(lexicon, null, 2)};`
  );
}

function getArg(arg: string): string | undefined {
  return ps.argv
    .filter(v => v.startsWith(`--${arg}`))
    .pop()
    ?.slice(3 + arg.length);
}

async function parseCrowdvData(file: string) {
  if (!fs.existsSync(file)) {
    if (parseInt(ps.versions.node.split('.')[0]) < 18) {
      console.log(`Node 18+ required, you're running ${ps.version}\n\n`);
      ps.exit(1);
    }
    let url = file;
    if (/https?:/.test(url)) file = file.split('/').pop() ?? 'crowdv.json';
    else url = `https://raw.githubusercontent.com/schlawg/crowdv/master/${file}`;

    try {
      const { ok, statusText, body } = await (globalThis as any).fetch(url);
      if (!ok) throw new Error(statusText);
      const stream = fs.createWriteStream(file);
      await finished(Readable.fromWeb(body).pipe(stream));
      stream.close();
    } catch (e) {
      console.log(`${e} - ${url}`);
      ps.exit(1);
    }
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as CrowdvData[];
}

type SubRestriction = { del?: boolean; sub?: number };

type LexEntry = {
  h: string;
  x: string;
  c: number[];
};

type Transform = {
  from: string; // single token, or empty string for insertion
  to: string; // one or more tokens, or empty string for erasure
  at: number; // index (for breadcrumbs)
};

type SubInfo = {
  tpe: 'del' | 'sub';
  all: number;
  count: number;
  freq: number;
  conf: number;
  cost?: number;
};

type CrowdvData = {
  heard: string;
  exact: string;
  round: number;
  ip: string;
  data: Array<{
    word: string;
    start: number;
    end: number;
    conf: number;
  }>;
};

type Sub = {
  to: string;
  cost: number;
};

type Tag = 'file' | 'rank' | 'role' | 'move' | 'choice' | 'command' | 'ignore' | 'exact' | 'rounds';

type Entry = {
  in: string; // the word or phrase recognized by kaldi, unique in lexicon
  tok?: string; // single char token representation (or '' for ignored words)
  val?: string; // the string moveHandler receives, default is tok
  subs?: Sub[]; // allowable token transitions calculated by this script
  tags?: Tag[]; // classificiation context for this token, used by clients of the grammar
};

const grammarBuilder = new (class {
  occurrences = new Map<string, number>();
  tokenVal = new Map<string, string>();
  wordToken = new Map<string, string>();

  constructor() {
    const reserved = lexicon.map(t => t.tok ?? '').join('') + ','; // comma is reserved for val delimiters
    const available = Array.from({ length: 93 }, (_, i) => String.fromCharCode(33 + i)).filter(
      x => !reserved.includes(x)
    );

    for (const e of lexicon) {
      if (e.tok === undefined) {
        if (reserved.includes(e.in)) e.tok = e.in;
        else e.tok = available.shift();
      } else if (e.tok === ' ' || e.tok === ',') throw new Error(`Illegal token for ${e.in}`);
      const tok = e.tok as string;
      this.wordToken.set(e.in, tok);
      this.tokenVal.set(tok, e.val ?? '');
      if (e.tags?.includes('ignore')) {
        e.subs = [{ to: '', cost: 0 }];
      }
    }
  }
  addOccurrence(phrase: string) {
    this.encode(phrase)
      .split('')
      .forEach(token => this.occurrences.set(token, (this.occurrences.get(token) ?? 0) + 1));
  }
  addSub(token: string, sub: Sub) {
    const tok = lexicon.find(e => e.tok === token);
    if (tok) tok.subs = [...(tok.subs ?? []), sub];
  }
  tokenOf(word: string) {
    return this.wordToken.get(word) ?? ('12345678'.includes(word) ? word : '');
  }
  fromToken(token: string) {
    return this.tokenVal.get(token) ?? token;
  }
  encode(phrase: string) {
    return this.wordToken.has(phrase)
      ? this.tokenOf(phrase)
      : phrase
          .split(' ')
          .map(word => this.tokenOf(word))
          .join('');
  }
  decode(tokens: string) {
    return tokens
      .split('')
      .map(token => this.fromToken(token))
      .join(' ');
  }
  wordsOf(tokens: string) {
    return tokens
      .split('')
      .map(token => [...this.wordToken.entries()].find(([_, tok]) => tok === token)?.[0])
      .join(' ');
  }
})();

main();