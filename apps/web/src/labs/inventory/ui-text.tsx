import type { ReactNode } from 'react';
import type { Lang } from '../../stage/ui';

/*
 * Lab 01's own words (EN + Burmese). Shared report words are in stage/common-text.tsx.
 * Rule: Burmese explains, technical words stay English (key, retry, MySQL, status codes).
 */

export interface LabText {
  title: string;
  lead: string;
  replayVsBuy: (replayMs: string, buyMs: string, rq?: number, bq?: number) => ReactNode;
  oneOrder: (tshirt?: number) => ReactNode;
  race500: ReactNode;
  nextLab: ReactNode;
  /** under "The code behind this step"; values come from the run's trace */
  codeNote: Record<string, (d: CodeNoteData) => ReactNode>;
}

/** what the notes quote from the trace (undefined until the step has run) */
export interface CodeNoteData {
  hit?: boolean;
  orderId?: number | null;
  stock?: number;
  /** error the failing request's span recorded */
  error?: string;
  statuses?: number[];
}

export const UI: Record<Lang, LabText> = {
  en: {
    title: 'Buy twice, pay once.',
    lead: 'Real requests, real server path, real milliseconds. Nothing on this stage is scripted.',
    replayVsBuy: (r, b, rq, bq) => (
      <><b>{r} ms</b> replay vs <b>{b} ms</b> purchase<span className="muted"> · {rq} vs {bq} queries</span></>
    ),
    oneOrder: (t) => <><b>1</b> order from the double tap<span className="muted"> · T-shirt stock {t}</span></>,
    race500: <><b className="tone-error">500</b> on a same-key race<span className="muted"> · next fix: duplicate key → 200</span></>,
    nextLab: <><b>Next lab</b> <span className="muted">· two users, last item: row locks</span></>,
    codeNote: {
      buy: (d) => <>A new key: the lookup finds nothing{d.hit === false && <span className="mono"> (hit: false)</span>}, so the purchase goes on: stock check, UPDATE, INSERT.</>,
      retry: (d) => <>Same key: the lookup finds order{d.orderId ? <b> #{d.orderId}</b> : ''} and this line returns it as <b>200</b>. No stock check, no new row.</>,
      bob: (d) => <>Bob's key is new, so he gets past the lookup. Stock is <b>{d.stock ?? '…'}</b>, the check fails and Nest turns the ConflictException into <b>409</b>.</>,
      double: (d) => (
        <>Both taps run the lookup at the same moment and both miss. Both INSERT; the UNIQUE index rejects the second
          {d.error && <> (<code>{d.error}</code>)</>}. Nothing catches that error, so the client gets <b>{d.statuses?.join(' + ') ?? '…'}</b>.
          The fix: catch the duplicate key and return the first order (200).</>
      ),
    },
  },
  my: {
    title: 'နှစ်ခါနှိပ်၊ တစ်ခါပဲ ပေး။',
    lead: 'Request အစစ်၊ server ထဲက လမ်းကြောင်းအစစ်၊ millisecond အစစ်တွေပဲ။ ဒီ stage ပေါ်က ဘာကိုမှ လက်နဲ့ script ရေးထားတာ မဟုတ်ဘူး။',
    replayVsBuy: (r, b, rq, bq) => (
      <>Replay <b>{r} ms</b>၊ တကယ်ဝယ်တာ <b>{b} ms</b><span className="muted"> · query {rq} ခု vs {bq} ခု</span></>
    ),
    oneOrder: (t) => <>Double tap ကနေ order <b>1</b> ခုပဲ ဖြစ်တယ်<span className="muted"> · T-shirt stock {t}</span></>,
    race500: <>Key တူ race မှာ <b className="tone-error">500</b><span className="muted"> · နောက်ပြင်ရန်: duplicate key → 200</span></>,
    nextLab: <><b>Next lab</b> <span className="muted">· user နှစ်ယောက်၊ နောက်ဆုံးပစ္စည်း တစ်ခု: row locks</span></>,
    codeNote: {
      buy: (d) => <>Key အသစ်မို့ lookup က ဘာမှ မတွေ့ဘူး{d.hit === false && <span className="mono"> (hit: false)</span>}။ ဒါကြောင့် ဝယ်တာ ဆက်သွားတယ်: stock စစ်၊ UPDATE၊ INSERT။</>,
      retry: (d) => <>Key တူတော့ lookup က order{d.orderId ? <b> #{d.orderId}</b> : ''} ကို တွေ့ပြီး ဒီ line က အဲဒါကို <b>200</b> နဲ့ ပြန်ပေးတယ်။ Stock မစစ်ဘူး၊ row အသစ် မဖြစ်ဘူး။</>,
      bob: (d) => <>Bob ရဲ့ key က အသစ်မို့ lookup ကို ကျော်သွားတယ်။ Stock က <b>{d.stock ?? '…'}</b> ဖြစ်နေတော့ စစ်တာ မအောင်ဘဲ ConflictException ကို Nest က <b>409</b> အဖြစ် ပြောင်းပေးတယ်။</>,
      double: (d) => (
        <>နှိပ်တာ နှစ်ခုလုံး တစ်ပြိုင်နက် lookup လုပ်တော့ နှစ်ခုလုံး မတွေ့ဘူး။ နှစ်ခုလုံး INSERT လုပ်တော့ UNIQUE index က ဒုတိယတစ်ခုကို ငြင်းတယ်
          {d.error && <> (<code>{d.error}</code>)</>}။ အဲဒီ error ကို ဘယ်သူမှ မဖမ်းထားလို့ client က <b>{d.statuses?.join(' + ') ?? '…'}</b> ရတယ်။
          ပြင်နည်း: duplicate key ကို ဖမ်းပြီး ပထမ order ကို ပြန်ပေး (200)။</>
      ),
    },
  },
};
