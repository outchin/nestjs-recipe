import type { ReactNode } from 'react';
import type { Lang } from './ui';

/*
 * Words every lab report shares (EN + Burmese). Lab-specific words live in labs/<lab>/ui-text.tsx.
 * Rule: Burmese explains; technical words, status codes, digits and button labels stay English.
 */

export interface CommonText {
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
  timings: string;
  codeTitle: string;
  codeRan: string;
  playground: string;
  busyReset: string;
}

export const COMMON: Record<Lang, CommonText> = {
  en: {
    recorded: (date, commit) => `Recorded ${date} · ${commit}`,
    differs: 'differs',
    hintNoApi: <>Live needs the API: run <code>npm run dev:api</code>. Live turns on by itself once it answers.</>,
    hintNoDb: <>The API is up but MySQL isn't: run <code>npm run db:up -- mysql</code> and set <code>DB_DRIVER=mysql</code>.</>,
    apiStopped: <>The API stopped answering. Start it again with <code>npm run dev:api</code>.</>,
    footerReplay: 'Tables: MySQL state from the recorded run',
    footerLive: 'Tables: MySQL state, read back after every request',
    notReset: <>MySQL hasn't been reset in this session. <b>Reset DB</b> first, so every step starts from the same state.</>,
    dirty: <>MySQL changed outside the scenario (playground, another tab, a test…). <b>Reset DB</b> to run it again.</>,
    resetOk: (time, done, total) => `✓ Reset at ${time} · ${done}/${total} steps run`,
    needReset: 'Reset the DB first',
    needResetDirty: 'MySQL changed outside the scenario: reset first',
    alreadyRun: 'Already run in this session: reset to run it again',
    runFirst: (n) => `Run step ${n} first`,
    idea: 'The idea',
    dataSays: 'What the data says',
    timings: 'Timings',
    codeTitle: 'The code behind this step',
    codeRan: 'What this run sent to MySQL',
    playground: 'Playground · click around yourself',
    busyReset: 'Resetting…',
  },
  my: {
    recorded: (date, commit) => `${date} မှာ record လုပ်ထား · ${commit}`,
    differs: 'မကိုက်',
    hintNoApi: <>Live သုံးဖို့ API လိုတယ်: <code>npm run dev:api</code> ကို run ပါ။ API ပြန်ဖြေတာနဲ့ Live အလိုလို ပွင့်လာမယ်။</>,
    hintNoDb: <>API ရှိပေမဲ့ MySQL မရှိဘူး: <code>npm run db:up -- mysql</code> ကို run ပြီး <code>DB_DRIVER=mysql</code> သတ်မှတ်ပါ။</>,
    apiStopped: <>API ပြန်မဖြေတော့ဘူး။ <code>npm run dev:api</code> နဲ့ ပြန်ဖွင့်ပါ။</>,
    footerReplay: 'Tables: record လုပ်ထားတဲ့ run ထဲက MySQL state',
    footerLive: 'Tables: request တစ်ခုပြီးတိုင်း MySQL ကနေ ပြန်ဖတ်ထားတဲ့ state',
    notReset: <>ဒီ session မှာ MySQL ကို reset မလုပ်ရသေးဘူး။ Step တိုင်း state တူတူကနေ စနိုင်အောင် <b>Reset DB</b> ကို အရင်နှိပ်ပါ။</>,
    dirty: <>Scenario အပြင်ကနေ MySQL ပြောင်းသွားတယ် (playground၊ တခြား tab၊ test…)။ ပြန် run ဖို့ <b>Reset DB</b> နှိပ်ပါ။</>,
    resetOk: (time, done, total) => `✓ ${time} မှာ reset လုပ်ထား · step ${done}/${total} run ပြီး`,
    needReset: 'DB ကို အရင် reset လုပ်ပါ',
    needResetDirty: 'Scenario အပြင်ကနေ MySQL ပြောင်းထားတယ်: အရင် reset လုပ်ပါ',
    alreadyRun: 'ဒီ session မှာ run ပြီးသား: ပြန် run ဖို့ reset လုပ်ပါ',
    runFirst: (n) => `Step ${n} ကို အရင် run ပါ`,
    idea: 'အိုင်ဒီယာ',
    dataSays: 'Data က ဘာပြောလဲ',
    timings: 'Timings (ကြာချိန်)',
    codeTitle: 'ဒီ step နောက်ကွယ်က code',
    codeRan: 'ဒီ run မှာ MySQL ကို တကယ် ပို့ခဲ့တာ',
    playground: 'Playground · ကိုယ်တိုင် နှိပ်စမ်းကြည့်',
    busyReset: 'Reset လုပ်နေတယ်…',
  },
};
