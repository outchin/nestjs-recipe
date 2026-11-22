/*
 * Words for the inventory report, in English and Burmese (my).
 * Burmese explains; technical terms (key, retry, COMMIT, status codes…) stay in English.
 * Short on purpose: the stage does the explaining. Numbers never live here.
 */

import type { CodeRef } from '../../stage/CodePanel';
import type { Lang } from '../../stage/ui';

export type { Lang };

export const REPO = 'https://github.com/outchin/nestjs-recipe/blob/main';

export interface StepCopy {
  /** tab label */
  short: string;
  /** one line */
  title: string;
  /** shown only when the real statuses differ from the prediction */
  whenDifferent?: string;
}

export const STEP_COPY: Record<Lang, Record<string, StepCopy>> = {
  en: {
    buy: { short: 'Buy', title: 'Alice buys the last sneaker (stock 1) with a new key.' },
    retry: { short: 'Retry', title: 'Her response is lost. She retries with the same key.' },
    bob: { short: 'Bob', title: 'Bob tries next. Different key, but the sneaker stock is 0.' },
    double: {
      short: 'Double tap · T-shirt',
      title: 'The sneaker is sold out, so Alice buys a T-shirt (stock 50) and double-taps Buy: two requests, same key, same instant.',
      whenDifferent:
        'Both missed the key before either committed. The second INSERT hit UNIQUE(user, key) and rolled back: still one order, but the client got a 500. Fix: catch the duplicate-key error and return the existing order as 200.',
    },
  },
  my: {
    buy: { short: 'ဝယ်', title: 'Alice က နောက်ဆုံး sneaker (stock 1) ကို key အသစ်နဲ့ ဝယ်တယ်။' },
    retry: { short: 'Retry', title: 'Response ပျောက်သွားလို့ Alice က key အဟောင်းနဲ့ပဲ retry လုပ်တယ်။' },
    bob: { short: 'Bob', title: 'နောက်မှ Bob ဝယ်ကြည့်တယ်။ Key မတူပေမဲ့ sneaker stock က 0 ဖြစ်နေပြီ။' },
    double: {
      short: 'Double tap · T-shirt',
      title: 'Sneaker ကုန်သွားပြီမို့ Alice က T-shirt (stock 50) ကို ဝယ်ပြီး Buy ကို double tap လုပ်တယ်: key တူ request နှစ်ခု တစ်ပြိုင်နက် ရောက်တယ်။',
      whenDifferent:
        'Request နှစ်ခုလုံးက တစ်ခုမှ commit မဖြစ်ခင် key ကို ရှာကြတော့ နှစ်ခုလုံး "key မမြင်ဖူးသေး" လို့ ထင်ပြီး ဝယ်တဲ့အလုပ်ကို လုပ်ကြတယ်။ ' +
        'ဒုတိယ INSERT က UNIQUE(user, key) ကို တိုက်မိပြီး rollback ဖြစ်တယ်။ Order တစ်ခုပဲ ဖြစ်လို့ data မှန်တယ်၊ ဒါပေမဲ့ client က order အစား 500 ရတယ်။ ' +
        'ပြင်နည်း: duplicate-key error ကို ဖမ်းပြီး order အဟောင်းကို 200 နဲ့ ပြန်ပေး။',
    },
  },
};

export const QUESTION: Record<Lang, string> = {
  en: 'Send a purchase twice. Do you pay twice?',
  my: 'ဝယ်တဲ့ request ကို နှစ်ခါ ပို့မိရင် ပိုက်ဆံ နှစ်ခါ ဖြတ်ခံရမလား။',
};

export const THEORY_NOTES: Record<Lang, string[]> = {
  en: [
    'A timeout hides whether the order happened, so clients retry.',
    'One key per purchase attempt. Retry → same key; new purchase → new key.',
    'Server: UNIQUE(user_id, idempotency_key). Known key → 200 + old order.',
  ],
  my: [
    'Timeout ဖြစ်ရင် order ဖြစ်သွားလား မဖြစ်ဘူးလား client က မသိဘူး၊ ဒါကြောင့် retry လုပ်တယ်။ Key မပါရင် retry တစ်ခါ = order တစ်ခု ထပ်တိုး။',
    'ဝယ်ယူမှု attempt တစ်ခုကို key တစ်ခု။ Retry → key အဟောင်း၊ ဝယ်ယူမှု အသစ် → key အသစ်။ (Product တစ်ခုကို key တစ်ခု မဟုတ်ဘူး)',
    'Server: UNIQUE(user_id, idempotency_key)။ Key မြင်ဖူးရင် → ဘာမှ ထပ်မလုပ်ဘဲ order အဟောင်းကို 200 နဲ့ ပြန်ပေး။ Key အသစ်ဆို → 201။',
  ],
};

export const CODE_LINKS = [
  { label: 'createOrder', path: 'apps/api/src/modules/inventory/inventory.service.ts' },
  { label: '201 vs 200', path: 'apps/api/src/modules/inventory/inventory.controller.ts' },
  { label: 'UNIQUE constraint', path: 'apps/api/src/modules/inventory/entities/order.entity.ts' },
  { label: 'Lab trace', path: 'apps/api/src/common/lab-trace/lab-trace.ts' },
  { label: 'Scenario', path: 'apps/web/src/labs/inventory/scenario.json' },
];

/** The code behind each step: snippet ids from apps/api/src (`// lab:snippet inventory/<id>`) + the lines that decide it. */
export const STEP_CODE: Record<string, CodeRef[]> = {
  buy: [{ id: 'idempotency-lookup', highlight: ['where: { userId, idempotencyKey'] }],
  retry: [{ id: 'idempotency-lookup', highlight: ['if (existing) return'] }],
  bob: [{ id: 'stock-check', highlight: ['const enough', 'if (!enough)', 'ConflictException'] }],
  double: [
    { id: 'order-insert', highlight: ["'db.order.insert'", 'idempotencyKey: dto.idempotencyKey'] },
    { id: 'unique-key', highlight: ['uq_orders_user_idempotency'] },
  ],
};
