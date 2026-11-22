import type { CodeRef } from '../../stage/CodePanel';
import type { Lang } from '../../stage/ui';

/*
 * Lab 02 words (EN + Burmese). Burmese explains; technical terms (index, B-tree, EXPLAIN,
 * full scan, INSERT…) stay English. No measured numbers here: they come from the run.
 */

export const REPO = 'https://github.com/outchin/nestjs-recipe/blob/main';

export interface StepCopy {
  short: string;
  title: string;
  /** only when the real result differs from the theory */
  whenDifferent?: string;
}

export const STEP_COPY: Record<Lang, Record<string, StepCopy>> = {
  en: {
    scan: { short: 'Scan', title: "Find one customer's orders among a million rows. No index yet." },
    'write-base': { short: 'Write', title: 'Insert 20,000 rows while there is no index: the baseline write cost.' },
    create: { short: 'CREATE INDEX', title: 'Build a B-tree index on customer_email.' },
    seek: {
      short: 'Seek',
      title: 'The same query again: the index can jump straight to the matching rows.',
      whenDifferent: 'MySQL chose not to use the index here. Check EXPLAIN key/rows: statistics may be stale (ANALYZE TABLE) or the match is too large.',
    },
    gotcha: {
      short: 'LOWER()',
      title: 'Same search, but the column is wrapped in LOWER(): the B-tree is sorted by customer_email, not by LOWER(customer_email).',
      whenDifferent: 'The index was used anyway: newer MySQL can use a functional index if one exists. Check EXPLAIN key.',
    },
    'write-cost': {
      short: 'Write + index',
      title: 'Insert 20,000 rows again: now every row also has to go into the B-tree.',
      whenDifferent: 'Inserts were not slower this time. Small batches are noisy: re-run, or try a bigger count.',
    },
  },
  my: {
    scan: { short: 'Scan', title: 'Row တစ်သန်းထဲက customer တစ်ယောက်ရဲ့ order တွေကို ရှာတယ်။ Index မရှိသေးဘူး။' },
    'write-base': { short: 'Write', title: 'Index မရှိခင် row 20,000 ထည့်ကြည့်တယ်: write ကုန်ကျစရိတ်ရဲ့ baseline။' },
    create: { short: 'CREATE INDEX', title: 'customer_email ပေါ်မှာ B-tree index ဆောက်တယ်။' },
    seek: {
      short: 'Seek',
      title: 'Query အတူတူကို ပြန် run တယ်: အခု index က ကိုက်တဲ့ row တွေဆီ တန်းရောက်နိုင်ပြီ။',
      whenDifferent: 'ဒီမှာ MySQL က index ကို မသုံးဘူး။ EXPLAIN key/rows ကို ကြည့်ပါ: statistics ဟောင်းနေတာ (ANALYZE TABLE) ဒါမှမဟုတ် ကိုက်တဲ့ row များလွန်းတာ ဖြစ်နိုင်တယ်။',
    },
    gotcha: {
      short: 'LOWER()',
      title: 'ရှာတာ အတူတူပဲ၊ ဒါပေမဲ့ column ကို LOWER() နဲ့ ပတ်ထားတယ်: B-tree က customer_email အတိုင်း စီထားတာ၊ LOWER(customer_email) အတိုင်း မဟုတ်ဘူး။',
      whenDifferent: 'Index ကို သုံးသွားတယ်: functional index ရှိရင် MySQL အသစ်တွေက သုံးနိုင်တယ်။ EXPLAIN key ကို ကြည့်ပါ။',
    },
    'write-cost': {
      short: 'Write + index',
      title: 'Row 20,000 ထပ်ထည့်တယ်: အခု row တိုင်းကို B-tree ထဲပါ ထည့်ရတယ်။',
      whenDifferent: 'ဒီတစ်ခါ INSERT က မနှေးဘူး။ Batch သေးရင် noise များတယ်: ပြန် run ကြည့်ပါ၊ ဒါမှမဟုတ် count ကို တိုးကြည့်ပါ။',
    },
  },
};

export const QUESTION: Record<Lang, string> = {
  en: 'Why does the same query go from reading the whole table to reading a handful of rows?',
  my: 'Query တစ်ခုတည်းက table တစ်ခုလုံး ဖတ်ရာကနေ row နည်းနည်းပဲ ဖတ်ရအောင် ဘာလို့ ဖြစ်သွားတာလဲ။',
};

export const THEORY_NOTES: Record<Lang, string[]> = {
  en: [
    'No index: MySQL reads every row and checks the WHERE (EXPLAIN type=ALL).',
    'The index is a second B-tree in the same table: customer_email → id, kept sorted. MySQL seeks the matching ids (type=ref), then fetches each row from PRIMARY by id.',
    'Not free: every INSERT/UPDATE also updates each index, and a function on the column (LOWER(…)) can’t use it.',
  ],
  my: [
    'Index မရှိရင်: MySQL က row တိုင်းကို ဖတ်ပြီး WHERE နဲ့ ကိုက်လား တစ်ခုချင်း စစ်တယ် (EXPLAIN type=ALL)။',
    'Index ဆိုတာ table တစ်ခုတည်းထဲက ဒုတိယ B-tree ပါ: customer_email → id ကို စီထားတယ်။ MySQL က ကိုက်တဲ့ id တွေကို တန်းရှာပြီး (type=ref) အဲဒီ id နဲ့ PRIMARY ထဲက row ကို ယူတယ်။',
    'အလကား မရဘူး: INSERT/UPDATE တိုင်း index တိုင်းကိုပါ update လုပ်ရတယ်။ Column ကို function (LOWER(…)) နဲ့ ပတ်ရင် index ကို သုံးလို့ မရဘူး။',
  ],
};

export const CODE_LINKS = [
  { label: 'IndexesService', path: 'apps/api/src/modules/indexes/indexes.service.ts' },
  { label: 'Endpoints', path: 'apps/api/src/modules/indexes/indexes.controller.ts' },
  { label: 'e2e test', path: 'apps/api/test/indexes.e2e-spec.ts' },
  { label: 'Scenario', path: 'apps/web/src/labs/indexes/scenario.json' },
];

/** The code behind each step: snippet ids from apps/api/src (`// lab:snippet indexes/<id>`) + the lines that decide it. */
export const STEP_CODE: Record<string, CodeRef[]> = {
  scan: [{ id: 'query', highlight: ['WHERE customer_email = ?'] }],
  'write-base': [{ id: 'insert', highlight: ['INSERT INTO'] }],
  create: [{ id: 'create-index', highlight: ['CREATE INDEX'] }],
  seek: [{ id: 'query', highlight: ['WHERE customer_email = ?'] }],
  gotcha: [{ id: 'query', highlight: ['WHERE LOWER(customer_email) = ?'] }],
  'write-cost': [{ id: 'insert', highlight: ['INSERT INTO'] }],
};
