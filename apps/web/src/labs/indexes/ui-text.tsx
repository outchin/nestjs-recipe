import type { ReactNode } from 'react';
import type { Lang } from '../../stage/ui';

/* Lab 02's own words (EN + Burmese). Shared report words: stage/common-text.tsx. */

export interface LabText {
  title: string;
  lead: string;
  speedup: (times: string, scanMs: number, seekMs: number) => ReactNode;
  rowsRead: (scan: string, seek: string, returned: number) => ReactNode;
  gotcha: (ms: number) => ReactNode;
  writeCost: (ratio: string) => ReactNode;
  indexSize: (indexMB: number, dataMB: number, buildS: string) => ReactNode;
  playgroundHint: string;
  run: string;
  /** under "The code behind this step"; every value is formatted from the run (undefined until it ran) */
  codeNote: Record<string, (d: CodeNoteData) => ReactNode>;
}

export interface CodeNoteData {
  scanType?: string;
  scanRead?: string;
  seekType?: string;
  seekRead?: string;
  gotchaRead?: string;
  inserted?: string;
  ratio?: string;
}
const v = (x?: string) => x ?? '…';

export const UI: Record<Lang, LabText> = {
  en: {
    title: 'Read less, find faster.',
    lead: 'A million real rows in MySQL. Every number here is measured: EXPLAIN, rows actually read, median of 5 runs.',
    speedup: (x, a, b) => <><b>×{x}</b> faster with the index<span className="muted"> · {a} ms → {b} ms</span></>,
    rowsRead: (a, b, n) => <>Rows read <b>{a}</b> → <b>{b}</b><span className="muted"> · same {n} results</span></>,
    gotcha: (ms) => <><b className="tone-error">LOWER()</b> brings the full scan back<span className="muted"> · {ms} ms</span></>,
    writeCost: (r) => <>Inserts <b>×{r}</b> slower with one index<span className="muted"> · every row goes into the B-tree too</span></>,
    indexSize: (i, d, s) => <>Index <b>≈ {i} MB</b> on {d} MB of data<span className="muted"> · built in {s} s</span></>,
    playgroundHint: 'Any email: user0 … user99999 @shop.test exist; try one that doesn’t.',
    run: 'Run query',
    codeNote: {
      scan: (d) => <>No index on <code>customer_email</code> yet, so MySQL has nothing to seek with: <b>type {v(d.scanType)}</b>, every row checked ({v(d.scanRead)}).</>,
      'write-base': (d) => <>One <code>INSERT … SELECT</code> adds {v(d.inserted)} rows. With no secondary index, only PRIMARY (the rows) is written.</>,
      create: (d) => <>This one statement is the whole fix: the query code doesn't change. Effect on the same query: <b>type {v(d.scanType)} → {v(d.seekType)}</b>, rows read <b>{v(d.scanRead)} → {v(d.seekRead)}</b>.</>,
      seek: (d) => <>Exactly the same code as step 1, not one character changed. Only the index is new, and MySQL now reads <b>{v(d.seekRead)}</b> rows instead of <b>{v(d.scanRead)}</b>.</>,
      gotcha: (d) => <>Wrapping the column in <code>LOWER()</code> hides it from the B-tree: MySQL has to compute LOWER() for every row ({v(d.gotchaRead)} read). Fix: compare the column as stored, or add a functional index.</>,
      'write-cost': (d) => <>The same INSERT as step 2. Now every new row also goes into <code>idx_email</code>: <b>×{v(d.ratio)}</b> the time.</>,
    },
  },
  my: {
    title: 'နည်းနည်းဖတ်၊ မြန်မြန်တွေ့။',
    lead: 'MySQL ထဲမှာ row တစ်သန်း အစစ်။ ဒီက ဂဏန်းတိုင်း တကယ်တိုင်းထားတာ: EXPLAIN၊ တကယ်ဖတ်ခဲ့တဲ့ row အရေအတွက်၊ 5 ခါ run ရဲ့ median။',
    speedup: (x, a, b) => <>Index နဲ့ <b>×{x}</b> မြန်တယ်<span className="muted"> · {a} ms → {b} ms</span></>,
    rowsRead: (a, b, n) => <>ဖတ်ရတဲ့ row <b>{a}</b> → <b>{b}</b><span className="muted"> · ရလဒ် {n} ခု အတူတူပဲ</span></>,
    gotcha: (ms) => <><b className="tone-error">LOWER()</b> က full scan ကို ပြန်ခေါ်လာတယ်<span className="muted"> · {ms} ms</span></>,
    writeCost: (r) => <>Index တစ်ခုနဲ့ INSERT က <b>×{r}</b> နှေးတယ်<span className="muted"> · row တိုင်းကို B-tree ထဲပါ ထည့်ရလို့</span></>,
    indexSize: (i, d, s) => <>Data {d} MB ပေါ်မှာ index <b>≈ {i} MB</b><span className="muted"> · ဆောက်ချိန် {s} s</span></>,
    playgroundHint: 'Email ကြိုက်တာ ရိုက်ကြည့်ပါ: user0 … user99999 @shop.test ရှိတယ်၊ မရှိတာလည်း စမ်းကြည့်ပါ။',
    run: 'Run query',
    codeNote: {
      scan: (d) => <><code>customer_email</code> ပေါ်မှာ index မရှိသေးတော့ MySQL မှာ တန်းရှာစရာ မရှိဘူး: <b>type {v(d.scanType)}</b>၊ row အားလုံး ({v(d.scanRead)}) ကို စစ်ရတယ်။</>,
      'write-base': (d) => <><code>INSERT … SELECT</code> တစ်ခုတည်းနဲ့ row {v(d.inserted)} ထည့်တယ်။ Secondary index မရှိသေးလို့ PRIMARY (row တွေ) ကိုပဲ ရေးရတယ်။</>,
      create: (d) => <>ဒီ statement တစ်ကြောင်းတည်းက ပြင်ဆင်ချက် အကုန်ပါပဲ: query code ကို လုံးဝ မပြောင်းဘူး။ Query အတူတူမှာ အကျိုး: <b>type {v(d.scanType)} → {v(d.seekType)}</b>၊ ဖတ်ရတဲ့ row <b>{v(d.scanRead)} → {v(d.seekRead)}</b>။</>,
      seek: (d) => <>Step 1 နဲ့ code အတူတူပဲ၊ စာလုံး တစ်လုံးမှ မပြောင်းဘူး။ Index ပဲ အသစ်ပါတယ်။ အခု MySQL က row <b>{v(d.scanRead)}</b> အစား <b>{v(d.seekRead)}</b> ပဲ ဖတ်တယ်။</>,
      gotcha: (d) => <>Column ကို <code>LOWER()</code> နဲ့ ပတ်လိုက်တော့ B-tree က သုံးလို့ မရတော့ဘူး: MySQL က row တိုင်းအတွက် LOWER() ကို တွက်ရတယ် ({v(d.gotchaRead)} ဖတ်)။ ပြင်နည်း: column ကို သိမ်းထားတဲ့အတိုင်း နှိုင်းယှဉ်ပါ၊ ဒါမှမဟုတ် functional index ထည့်ပါ။</>,
      'write-cost': (d) => <>Step 2 က INSERT အတူတူပဲ။ အခု row အသစ်တိုင်းကို <code>idx_email</code> ထဲပါ ထည့်ရတော့ အချိန် <b>×{v(d.ratio)}</b> ကြာတယ်။</>,
    },
  },
};
