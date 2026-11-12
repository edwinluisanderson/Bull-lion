# The Bullion Bandit

A steampunk one-armed bandit that prices a stack of bullion. Three reels pick a metal, a weight, and a piece count. When they settle, the glass shows the melt value: spot price times troy weight times the number of pieces.

## Decisions

**Prices.** Live quotes come from [Gold API](https://gold-api.com) (`https://api.gold-api.com/price/{symbol}`). Real-time prices for gold (XAU), silver (XAG), platinum (XPT), palladium (XPD), and copper (HG) are free and need no key. Bitcoin and Ethereum are on the same feed and are left off the reels. No environment variable is required.

Gold, silver, platinum, and palladium are USD per troy ounce (31.1034768 g). Copper is the COMEX HG quote, USD per avoirdupois pound. The server converts copper to USD per troy ounce before the reels multiply (1 lb = 14.5833 troy oz). The readout shows both figures.

If the feed fails, or a single metal fails, the cabinet keeps a labeled sample card stamped 12 Nov 2026. Sample chips are marked. The machine still spins.

**Reel 3 is a piece count**, not purity. People stack whole coins and bars (“ten 1 oz coins”, “one kilo bar”). The stops are 1, 2, 5, 10, 20, 25, 50, and 100. Purity stays at fine metal (.999 and better), which is what spot times weight means. A karat reel would hide that answer under jewelry math.

**Styling.** Tailwind handles layout utilities and the shadcn dialog. The cabinet itself is custom CSS: wood grain, brushed brass, rivets, glass, gauges, and a side lever. The page is always the dark workshop palette. There is no light theme, because the machine is the page.

**Motion.** Reel position is a floating slot index driven by `requestAnimationFrame`. A drag follows the pointer. A flick keeps velocity, exponential decay slows it, and a short ease snaps to the nearest symbol. The lever scripts an ease-out spin on all three reels and stops them in sequence. `prefers-reduced-motion: reduce` skips the coast and the scripted spin, jumps to the result, and stops the gear and bulb animations.

## Project structure

```
app/
  api/prices/route.ts   GET /api/prices, cached with the price book
  page.tsx              server page, loads the book and renders the machine
  layout.tsx            fonts and metadata
  globals.css           workshop materials
  error.tsx             cabinet failure state
components/
  slot-machine.tsx      reels, lever, readout, refresh
  reel.tsx              drag, flick, snap, keyboard
  lever.tsx             pull handle
  readout.tsx           melt value
  spot-strip.tsx        live quotes, click to set the metal reel
  assay-dialog.tsx      shadcn dialog with the formula
  gauge.tsx gear.tsx
  ui/                   shadcn button and dialog
lib/
  prices.ts             Gold API fetch, cache, sample fallback
  price-book.ts         quote types and payload parsing
  metals.ts             catalog, weights, piece counts
  value.ts              troy-ounce math
  format.ts             currency and stamps
```

## Requirements

- Node.js 20 or newer
- npm

No API key and no database.

## Local development

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm test` checks troy-ounce conversion, copper’s pound quote, and currency formatting.

`npm run lint` runs ESLint. `npm run build` is the production build.

## Environment variables

None. Gold API’s real-time price endpoint does not use a key, so there is no `.env` file. Do not add a client-side key later. Historical Gold API routes are a different product and are not used here.

## Deploying to Vercel

The app is a standard Next.js App Router project. Vercel detects it. No `vercel.json` and no environment variables.

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. In Vercel, choose **Add New… → Project** and import the repo.
3. Leave the framework preset on Next.js. Build command `npm run build`, output left as the Next.js default.
4. Deploy.

The price helper uses `use cache` with a 30 second server revalidate, a 5 minute client stale time, and a 1 hour expiry. That matches Gold API’s request to cache live prices for about 30 seconds. `/api/prices` returns the same cached book and sends `Cache-Control: public, s-maxage=30, stale-while-revalidate=300`.

The open page also refreshes from `/api/prices` about once a minute, and again when the tab becomes visible.

## How a quote is read

Melt value = spot per troy ounce × weight in troy ounces × pieces.

Weight stops: 1 g, 5 g, 10 g, 1/10 oz t, 1/4 oz t, 1/2 oz t, 1 oz t, 5 oz t, 10 oz t, 100 g, 1 kg.

Drag a reel, flick it, tap the brass arrows, or focus a reel and use the arrow keys. The spot chips under the readout set the metal reel. The lever spins all three.

The figure is spot only. It is not a dealer bid or ask.
