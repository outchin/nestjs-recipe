import type { ReactNode } from 'react';
import type { Lang } from './content';

/*
 * Page chrome for the inventory report, English + Burmese.
 * Rule: Burmese explains, technical words stay English (key, retry, MySQL, Reset DB, status codes).
 * Button labels stay English in both, so they match the docs and the code.
 */

export interface UiText {
  title: string;
  lead: string;
  recorded: (date: string, commit: string) => string;
  differs: string;
  hintNoApi: ReactNode;
  hintNoDb: ReactNode;
  apiStopped: ReactNode;
  footerReplay: string;
  footerLive: string;
  notReset: ReactNode;
  dirty: ReactNode;
  resetOk: (time: string, done: number, total: number) => string;
  needReset: string;
  needResetDirty: string;
  alreadyRun: string;
  runFirst: (n: number) => string;
  idea: string;
  dataSays: string;
  replayVsBuy: (replayMs: string, buyMs: string, rq?: number, bq?: number) => ReactNode;
  oneOrder: (tshirt?: number) => ReactNode;
  race500: ReactNode;
  nextLab: ReactNode;
  timings: string;
  playground: string;
}

export const UI: Record<Lang, UiText> = {
  en: {
    title: 'Buy twice, pay once.',
    lead: 'Real requests, real server path, real milliseconds. Nothing on this stage is scripted.',
    recorded: (date, commit) => `Recorded ${date} · ${commit}`,
    differs: 'differs',
    hintNoApi: <>Live needs the API: run <code>npm run dev:api</code>. Live turns on by itself once it answers.</>,
    hintNoDb: <>The API is up but MySQL isn't: run <code>npm run db:up -- mysql</code> and set <code>DB_DRIVER=mysql</code>.</>,
    apiStopped: <>The API stopped answering. Start it again with <code>npm run dev:api</code>.</>,
    footerReplay: 'Tables: MySQL rows from the recorded run',
    footerLive: 'Tables: MySQL rows, read back after every request',
    notReset: <>MySQL hasn't been reset in this session. <b>Reset DB</b> first, so every step starts from the same rows.</>,
    dirty: <>MySQL changed outside the scenario (playground, another tab, a test…). <b>Reset DB</b> to run it again.</>,
    resetOk: (time, done, total) => `✓ Reset at ${time} · ${done}/${total} steps run`,
    needReset: 'Reset the DB first',
    needResetDirty: 'MySQL changed outside the scenario: reset first',
    alreadyRun: 'Already run in this session: reset to run it again',
    runFirst: (n) => `Run step ${n} first`,
    idea: 'The idea',
    dataSays: 'What the data says',
    replayVsBuy: (r, b, rq, bq) => (
      <><b>{r} ms</b> replay vs <b>{b} ms</b> purchase<span className="muted"> · {rq} vs {bq} queries</span></>
    ),
    oneOrder: (t) => <><b>1</b> order from the double tap<span className="muted"> · T-shirt stock {t}</span></>,
    race500: <><b className="tone-error">500</b> on a same-key race<span className="muted"> · next fix: duplicate key → 200</span></>,
    nextLab: <><b>Next lab</b> <span className="muted">· two users, last item: row locks</span></>,
    timings: 'Timings',
    playground: 'Playground · click around yourself',
  },
  my: {
    title: 'နှစ်ခါနှိပ်၊ တစ်ခါပဲ ပေး။',
    lead: 'Request အစစ်၊ server ထဲက လမ်းကြောင်းအစစ်၊ millisecond အစစ်တွေပဲ။ ဒီ stage ပေါ်က ဘာကိုမှ လက်နဲ့ script ရေးထားတာ မဟုတ်ဘူး။',
    recorded: (date, commit) => `${date} မှာ record လုပ်ထား · ${commit}`,
    differs: 'မကိုက်',
    hintNoApi: <>Live သုံးဖို့ API လိုတယ်: <code>npm run dev:api</code> ကို run ပါ။ API ပြန်ဖြေတာနဲ့ Live အလိုလို ပွင့်လာမယ်။</>,
    hintNoDb: <>API ရှိပေမဲ့ MySQL မရှိဘူး: <code>npm run db:up -- mysql</code> ကို run ပြီး <code>DB_DRIVER=mysql</code> သတ်မှတ်ပါ။</>,
    apiStopped: <>API ပြန်မဖြေတော့ဘူး။ <code>npm run dev:api</code> နဲ့ ပြန်ဖွင့်ပါ။</>,
    footerReplay: 'Tables: record လုပ်ထားတဲ့ run ထဲက MySQL rows',
    footerLive: 'Tables: request တစ်ခုပြီးတိုင်း MySQL ကနေ ပြန်ဖတ်ထားတဲ့ rows',
    notReset: <>ဒီ session မှာ MySQL ကို reset မလုပ်ရသေးဘူး။ Step တိုင်း row တူတူကနေ စနိုင်အောင် <b>Reset DB</b> ကို အရင်နှိပ်ပါ။</>,
    dirty: <>Scenario အပြင်ကနေ MySQL ပြောင်းသွားတယ် (playground၊ တခြား tab၊ test…)။ ပြန် run ဖို့ <b>Reset DB</b> နှိပ်ပါ။</>,
    resetOk: (time, done, total) => `✓ ${time} မှာ reset လုပ်ထား · step ${done}/${total} run ပြီး`,
    needReset: 'DB ကို အရင် reset လုပ်ပါ',
    needResetDirty: 'Scenario အပြင်ကနေ MySQL ပြောင်းထားတယ်: အရင် reset လုပ်ပါ',
    alreadyRun: 'ဒီ session မှာ run ပြီးသား: ပြန် run ဖို့ reset လုပ်ပါ',
    runFirst: (n) => `Step ${n} ကို အရင် run ပါ`,
    idea: 'အိုင်ဒီယာ',
    dataSays: 'Data က ဘာပြောလဲ',
    replayVsBuy: (r, b, rq, bq) => (
      <>Replay <b>{r} ms</b>၊ တကယ်ဝယ်တာ <b>{b} ms</b><span className="muted"> · query {rq} ခု vs {bq} ခု</span></>
    ),
    oneOrder: (t) => <>Double tap ကနေ order <b>1</b> ခုပဲ ဖြစ်တယ်<span className="muted"> · T-shirt stock {t}</span></>,
    race500: <>Key တူ race မှာ <b className="tone-error">500</b><span className="muted"> · နောက်ပြင်ရန်: duplicate key → 200</span></>,
    nextLab: <><b>Next lab</b> <span className="muted">· user နှစ်ယောက်၊ နောက်ဆုံးပစ္စည်း တစ်ခု: row locks</span></>,
    timings: 'Timings (ကြာချိန်)',
    playground: 'Playground · ကိုယ်တိုင် နှိပ်စမ်းကြည့်',
  },
};
