# Stage engine — 2D / 3D architecture diagram, ဘယ်လို ဆောက်ထားလဲ

Lab page တွေက stage (2D ↔ 3D ပြောင်းလို့ရတဲ့ architecture diagram + packet animation) ကို
တခြား project / architecture diagram မှာ ပြန်သုံးချင်ရင် ဒီ file ကို reference ယူပါ။
Code: `apps/web/src/stage/`။ Lab page တစ်ခုလုံးရဲ့ စည်းမျဉ်းတွေက [LAB-VISUALIZER.md](LAB-VISUALIZER.md) မှာ။

---

## 1. Library / framework — ဘာမှ အပို မသုံးဘူး

| သုံးတာ | ဘာအတွက် |
|---|---|
| **React 19 + TypeScript** | component, state (`useState`, `useRef`, `useEffect`) |
| **Vite 6** | dev server / build |
| **SVG** (browser built-in) | floor, link, 3D solid (polygon / path / ellipse), packet |
| **HTML + CSS** | node card / label (glass effect: `backdrop-filter`), caption, tag |
| **CSS custom properties (tokens)** | အရောင်အားလုံး; light / dark က `prefers-color-scheme` နဲ့ token ပြောင်းရုံ |
| **CSS container queries** (`cqw`) | stage အကျယ်အလိုက် font / card size ချိန် |

**မသုံးတာ:** Three.js, WebGL, Canvas, D3, GSAP, Framer Motion, React Flow — တစ်ခုမှ မသုံးဘူး။
3D က **"2.5D"** ပါ: 2D floor plan ကို သင်္ချာ projection နဲ့ စောင်းပြီး SVG နဲ့ ဆွဲတာ။
ဒါကြောင့် bundle သေး၊ text ကြည်ကြည် (flat HTML)၊ SSR / static page မှာလည်း အလုပ်လုပ်တယ်။

---

## 2. အဓိက အယူအဆ — scene တစ်ခု၊ view နှစ်ခု

```
Scene (data: nodes, links, groups — floor plan, 1200 × 600 units)
   │
   ├── <Stage>     2D: floor plan ကို တိုက်ရိုက် ဆွဲ
   └── <IsoStage>  3D: floor plan ကို proj() နဲ့ စောင်းပြီး ဆွဲ
         ▲
   props အတူတူ (StageProps) → toggle = component ပြောင်းရုံ
```

```tsx
const StageView = view === '3d' ? IsoStage : Stage;
<StageView scene={scene} packets={...} marks={...} caption={...} panels={...} />
```

- View ရွေးချယ်မှုကို `localStorage` (`lab:view`) မှာ မှတ်ထား။
- Animation state (packet ဘယ်နားရောက်နေလဲ) က view အပြင်မှာ (`usePlayer`) ရှိလို့ ပြေးနေရင်း
  view ပြောင်းလည်း ဆက်ပြေးတယ်။

---

## 3. Data model (`stage/types.ts`)

```ts
interface Scene {
  width: number; height: number;          // floor plan size (units, px မဟုတ်)
  nodes: SceneNode[];
  links: SceneLink[];                      // { id, from, to }
  groups?: SceneGroup[];                   // dashed box: { id, label, x, y, w, h }
}
interface SceneNode {
  id: string; x: number; y: number;        // floor ပေါ်က အလယ်မှတ်
  title: string; subtitle?: string;
  kind: 'client' | 'server' | 'db' | 'index' | 'rows';   // 3D shape ကို ဆုံးဖြတ်
  labelSide?: 'top' | 'bottom' | 'left' | 'right';      // 3D label နေရာ
}
```

Animation ကို **hop** တွေနဲ့ ဖော်ပြ (lab ရဲ့ adapter က server trace ကနေ ထုတ်):

```ts
type Hop =
  | { kind: 'travel'; link: string; reverse?: boolean; tone: Tone; label?: string; quick?: boolean }
  | { kind: 'pulse'; node: string; tone: Tone; tag: string; ms?: number; event?: string };
// tone: 'neutral' | 'info' | 'ok' | 'replay' | 'error'  → CSS class t-<tone>
```

- `travel` = link တစ်ခုပေါ် packet (ဘောလုံး) ပြေး။ `pulse` = node မှာ tag ပေါ် + caption ပြောင်း။
- **Lane** = hop list တစ်ခု = request တစ်ခု။ Lane အများကြီး = parallel request (တစ်ပြိုင်နက် ပြေး)။
- Node ပေါ်က ဇယားသေး (DB state) = `panels: Record<nodeId, NodePanel>`; `absent: true` ဆို dashed (မရှိသေး)။

---

## 4. 2D view (`stage/Stage.tsx`)

1. **Layer နှစ်ထပ်**, coordinate system တစ်ခုတည်း:
   - အောက်: `<svg viewBox="0 0 W H">` — group box, link, packet
   - အပေါ်: HTML card တွေ `position:absolute; left: x/W %; top: y/H %; transform: translate(-50%,-50%)`
   - `<figure style="aspect-ratio: W / H">` ဆိုတော့ ဘယ်အကျယ်မှာမဆို layer နှစ်ခု ထပ်တူကျ
2. **Link** = cubic Bézier: `M a.x a.y C mx a.y, mx b.y, b.x b.y` (mx = x နှစ်ခုရဲ့ အလယ်) — S-curve လှလှ
3. **Node card** = HTML (SVG မဟုတ်) — `backdrop-filter: blur()` glass effect ရဖို့
4. Active link = `stroke-dasharray` + `stroke-dashoffset` animation (data စီးနေသလို)

---

## 5. 3D view (`stage/IsoStage.tsx`) — အရေးကြီးဆုံး

### 5.1 Projection (floor → screen) — function တစ်ခုတည်း

```ts
const ANGLE = 21 * Math.PI / 180;   // floor ကို လှည့်တဲ့ ထောင့်
const SQUASH = 0.56;                // ထောင်လိုက် ချုံ့ (ကြည့်တဲ့ အမြင့်)
const DEPTH = 1.4;                  // y ကို ဆွဲဆန့် (column တွေ မပူးအောင်)

const proj = (x: number, y0: number) => {
  const y = y0 * DEPTH;
  return { x: x * Math.cos(ANGLE) - y * Math.sin(ANGLE),
           y: (x * Math.sin(ANGLE) + y * Math.cos(ANGLE)) * SQUASH };
};
const up = (p, h) => ({ x: p.x, y: p.y - h });   // အမြင့် = screen y ကို အပေါ်ရွှေ့ရုံ
```

Rotate + vertical squash = **dimetric projection**။ Scene data ကို လုံးဝ မပြောင်းဘဲ 2D နဲ့ အတူတူ သုံး။

### 5.2 Floor
- Scene ရဲ့ လေးထောင့် 4 ခုကို `proj()` → `<polygon>`; အောက်မှာ slab ဘေးမျက်နှာ 2 ခု + blur shadow
- Grid line = 75 unit တိုင်း line ကို project

### 5.3 Solid (shape) တွေ — SVG polygon / path သက်သက်

| kind | shape | ဆွဲနည်း |
|---|---|---|
| `server` | rack box | `Box` + ညာမျက်နှာမှာ slot line 3 ခု + LED |
| `client` | device box (နိမ့်) | `Box` |
| `db` | cylinder = **DB server တစ်ခု** | ဘေး = `path` (ellipse arc) + band 2 ခု + ထိပ် `ellipse` (ry = r × SQUASH) |
| `index` | B-tree | plinth `Box` + page rect 1→2→4 + edge line (viewer ဘက် လှည့်ထား) |
| `rows` | row slab | `Box` ပါးပါး 5 ခု ထပ် (`lift` နဲ့) |

**`Box` ရဲ့ algorithm** (cube တိုင်းရဲ့ အခြေခံ):
1. Floor ပေါ် footprint 4 ထောင့် → `proj()` → base; base ကို `up(h)` → top
2. ဘေးမျက်နှာ 4 ခုထဲက **အောက်ခြေ edge ရဲ့ အလယ်မှတ်က centre ထက် screen ပေါ်မှာ နိမ့်တာ** (viewer ဘက်ကျ)
   ၂ ခုပဲ ဆွဲ (`mid.y > c.y`) — hidden face ဖယ်တဲ့ ရိုးရှင်းဆုံး နည်း
3. ဘယ်/ညာ မျက်နှာ = `iso-left` / `iso-right` class (အရောင် မတူ → အလင်းအမှောင်) ; ထိပ် = `iso-top`
4. ထိပ်ပေါ်မှာ `iso-tint` polygon ထပ် → node "marked" ဖြစ်ရင် tone အရောင် ဖျော့ဖျော့ သုတ်

**Painter's algorithm:** solid တွေကို projected y နဲ့ စီ (`sort by proj(n).y`) — နောက်ကျတာ အရင်ဆွဲ၊ ရှေ့ကျတာ နောက်မှ။

### 5.4 Link + packet က floor ပေါ်မှာ ပြေးအောင်
- 2D Bézier ကို **floor space ထဲမှာ** 33 မှတ် sample → မှတ်တိုင်း `proj()` → `M … L …` path
- ဒါကြောင့် 3D မှာလည်း packet က floor ပေါ်မှာ ကွေးကွေးလေး ပြေး
- Packet = ellipse shadow + glow circle + core circle + အဖြူ shine (ဘောလုံးပုံ)

### 5.5 Text က flat HTML
- Label (`iso-label`) = HTML, SVG text မဟုတ် — ဖတ်ရလွယ်၊ blur / wrap / `cqw` font ရ
- `labelAnchor(node, side)` က solid ရဲ့ ထိပ် / အောက် / ဘေး projected point ကို တွက်ပြီး
  viewBox ထဲ % အဖြစ် ပြောင်း (`left: (p.x - minX)/W %`)
- ViewBox ကို floor + label အတွက် နေရာ (`SIDE_ROOM`, အပေါ် caption နေရာ) ပါ ထည့်တွက်ပြီး
  `aspect-ratio` ကိုလည်း အဲဒီကနေ ယူ

### 5.6 Interaction effect
- Current node: solid ကို `translateY(-10px)` (မြှောက်) + label scale 1.06
- Marked node: ring ellipse animation (scale 0.7 → 1.25) + tint
- `is-absent`: opacity 0.4 + dashed stroke (ဥပမာ CREATE INDEX မလုပ်ခင် B-tree)

---

## 6. Animation (`usePlayer.ts` + `motion.ts`) — view နှစ်ခု မျှသုံး

1. **`usePlayer(speed)`** — `play(lanes)`:
   - lane တိုင်း `async` loop; lane တွေ `Promise.all` နဲ့ ပြိုင်ပြေး (lane ကြား 400 ms stagger)
   - `travel`: packet တစ်ခု state ထဲ ထည့် → `sleep(1300 / speed)` → ဖယ်
   - `pulse`: node mark + caption ပြောင်း → `event` ပါရင် `onEvent('commit')` (DB ဇယား အဲဒီအချိန်မှ ပြောင်း)
   - `play()` အသစ် ခေါ်ရင် generation counter (`gen`) နဲ့ အဟောင်းကို ရပ်
   - `prefers-reduced-motion` ဆို travel ကျော်၊ ချက်ချင်း ပြ
2. **`usePacketMotion(packets)`** — `requestAnimationFrame` loop:
   - packet တိုင်းအတွက် `t = ease((now - start) / dur)`
   - `path.getPointAtLength(t × path.getTotalLength())` → `<g transform="translate(x y)">`
   - React re-render မလုပ်ဘဲ DOM ကို တိုက်ရိုက် ပြင် (frame တိုင်း) → ချောချော
   - 2D / 3D က path `ref` ကိုသာ register လုပ်ပေး → path ပုံ မတူလည်း code တစ်ခုတည်း

---

## 7. Styling / theme

- `styles.css` မှာ token: `--glass-strong`, `--hairline`, `--ok-fill/text/soft` … ; dark mode = token ပြန်သတ်မှတ်
- Tone class: `.t-ok { --tone-fill: var(--ok-fill); --tone-text: …; --tone-soft: … }` → component တိုင်း `var(--tone-*)` ပဲ ဖတ်
- 3D material အရောင်: `.iso-stage { --block-top; --block-left; --block-right; --cyl-a/b/c; … }` (dark မှာ ပြန်သတ်မှတ်)
- Responsive: `container-type: inline-size` + `clamp(…, 1.6cqw, …)`; ဖုန်းမှာ stage ≥ 640 px နဲ့ ဘေးတိုက် scroll

---

## 8. File map

| File | တာဝန် |
|---|---|
| `stage/types.ts` | Scene, Hop, NodePanel … (data shape) |
| `stage/Stage.tsx` + `stage.css` | 2D view, `ICON`, `PanelView`, `CaptionBox` (3D ကလည်း သုံး) |
| `stage/IsoStage.tsx` + `iso.css` | 3D view: `proj`, `Box`, `Cylinder`, `Tree`, `RowStack`, `labelAnchor` |
| `stage/motion.ts` | `usePacketMotion` (rAF + `getPointAtLength`) |
| `stage/usePlayer.ts` | lanes → packets / marks / caption |
| `labs/<lab>/scene.ts` | node နေရာ (diagram တစ်ခုချင်း) |
| `labs/<lab>/adapter.ts` | trace → hops (data source တစ်ခုချင်း) |

---

## 9. တခြား architecture diagram မှာ ပြန်သုံးနည်း (step by step)

1. **Copy:** `types.ts`, `Stage.tsx`, `IsoStage.tsx`, `motion.ts`, `usePlayer.ts`, `stage.css`, `iso.css`
   + `styles.css` ထဲက token တွေ (React + TS project ဆို dependency အသစ် မလို)
2. **Scene ရေး:** floor plan (1200 × 600) ပေါ် node နေရာချ — ဘယ်→ညာ request flow,
   အလွှာ (client / app / data) ကို column ခွဲ။ Column ကြား ~170+ unit ခြား (3D label မထပ်အောင်)
3. **Shape အသစ် လိုရင်** (ဥပမာ cache, queue, load balancer):
   - `SceneNode['kind']` ထဲ ထည့်
   - `SOLID` ထဲ `{ w, d, h }` ထည့်
   - `IsoStage` မှာ component တစ်ခု — `Box` ကို ပေါင်း (queue = box အသေး တန်းစီ၊ LB = ပြား + မြှား)
   - `Stage.tsx` ရဲ့ `ICON` ထဲ SVG icon ထည့် (2D card အတွက်)
   - **Shape က အဓိပ္ပာယ် မှန်ရမယ်:** cylinder တစ်ခု = DB server တစ်ခု (table / index အတွက် မသုံး)
4. **Hop ထုတ်:** ကိုယ့် data (log, trace, k8s event, ဒါမှမဟုတ် လက်ရေး demo) → `Hop[][]` → `player.play(lanes)`
5. **Label ထပ်ရင်:** `labelSide` ပြောင်း၊ node ရွှေ့၊ ဒါမှမဟုတ် `SIDE_ROOM` / `DEPTH` ချိန်
6. **Toggle:** `view === '3d' ? IsoStage : Stage` — props တူအောင် ထိန်းရင် ဘာမှ ထပ်မလို

### React မဟုတ်တဲ့ project ဆိုရင်
သင်္ချာနဲ့ SVG က framework မမှီခိုဘူး: `proj()`, `Box` face ရွေးနည်း, painter sort, Bézier sample →
project, `getPointAtLength` + `requestAnimationFrame` — ဒီ 5 ခုကို vanilla JS / Vue / Svelte
ဘယ်မှာမဆို တိုက်ရိုက် ပြန်ရေးလို့ရတယ်။ React က state (packets / marks) ကို render လုပ်ရုံပဲ သုံးတယ်။
