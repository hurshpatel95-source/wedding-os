# Acquired Planner — Master Spec

**Owner:** Hursh
**Last updated:** May 8, 2026
**Status:** Pre-launch, pre-pitch
**Purpose:** Single source of truth for product, partnership, and launch. Hand this to Claude Code for build, to attorney for term sheet review, and use as personal reference doc.

---

## TABLE OF CONTENTS

1. [The Thesis](#1-the-thesis)
2. [The HoldCo Vision](#2-the-holdco-vision)
3. [Product Spec — Acquired Planner v1](#3-product-spec--acquired-planner-v1)
4. [The Image Generation Engine (Core Differentiator)](#4-the-image-generation-engine)
5. [Pricing & Credit Economy](#5-pricing--credit-economy)
6. [Why Zola Cannot Compete](#6-why-zola-cannot-compete)
7. [The Brigette Partnership Deal](#7-the-brigette-partnership-deal)
8. [Launch Plan & 14-Day Sprint](#8-launch-plan--14-day-sprint)
9. [Threshold Logic — What Happens After Launch](#9-threshold-logic)
10. [Open Questions & Risks](#10-open-questions--risks)
11. [Appendix: Full Feature Backlog](#11-appendix-full-feature-backlog)

---

## 1. THE THESIS

Zola is a 2010s-era SaaS company that bolted "AI" onto a registry/website business. They cannot rebuild around AI without cannibalizing their existing $130M+ registry GMV. They are structurally incapable of being a marketplace AND building agents that negotiate against vendors.

**The opportunity:** AI is going to transform wedding planning the way it's transforming everything else, but specifically here it can do the actual work that currently requires either (a) a $5-15K planner or (b) the bride spending 400 hours of nights and weekends in spreadsheet hell.

**Acquired Planner is the AI-first wedding platform.** Built by an operator (Hursh) with proven AI agent deployment experience (FlowPilot cannabis wholesale dashboards, Red Oak retail dashboards, hotel rate automation), launched through an aspirational consumer brand (Acquired Style / Brigette Pheloung).

**Two distinct businesses sharing one platform:**

- **B2C:** Brides plan their own weddings. Replaces Zola. Mass-market consumer SaaS. Brigette/Danielle are the launch faces.
- **B2B (white-label planner portal):** Wedding planners onboard their clients. High-margin recurring revenue. Each planner brings 10-30 weddings. Real money lives here long-term.

The B2C is the marketing engine. Every consumer wedding website built on the platform has "Acquired Planner" in the footer, every RSVP email, every guest who attends sees the brand. Each wedding has 100-200 guests, a chunk of whom are also engaged or about to be. Built-in viral loop.

---

## 2. THE HOLDCO VISION

Don't pitch a wedding app. Pitch an **AI-powered lifestyle platform** where Brigette is the face and Hursh is the operator. The "Acquired" brand becomes an umbrella for AI lifestyle products that share the same core stack.

### Roadmap

| # | Vertical | Description | Target Launch |
|---|---|---|---|
| 1 | **Acquired Planner** | AI wedding planning (this doc) | Q3-Q4 2026 |
| 2 | **Acquired Honeymoon** | AI travel planning, hotel curation, itinerary builder | Q1 2027 |
| 3 | **Acquired Home** | Post-wedding registry + interior design AI (upload space, visualize) | Q2 2027 |
| 4 | **Acquired Style** | AI personal stylist using her existing brand aesthetic | Q3 2027 |
| 5 | **Acquired Mama** | AI for new moms, registry, sleep schedules, etc. | TBD |

### Why this works

- Each vertical reuses the same AI agent layer + Higgsfield visual gen + workflow automation + recurring sub
- Not 5 products — 1 platform, 5 skins
- Brigette's career graduates from "influencer" to "AI lifestyle entrepreneur" — narrative her PR team will love
- Each vertical is a SKU; platform shares users across SKUs

### What this changes about the pitch

This isn't a sponsorship. This is a **co-founder-of-a-HoldCo** conversation. Different deal, different size, different commitment.

---

## 3. PRODUCT SPEC — ACQUIRED PLANNER V1

### What's already built ✅

- AI vendor sourcing + outreach (find, score, email, follow up, track responses)
- Wedding website + RSVP system

### What needs to ship for launch 🔨

- **Aesthetic Profile system** (the unlock — see below)
- **Image generation engine** (the differentiator — full spec in §4)
- **Vendor Brief PDF generator** (turns visualization into execution)
- **Mood board generator** (builds into image engine)
- **Save-the-date / invitation suite generator** (builds into image engine)

### What ships in v1.1 (post-launch)

- Tablescape, cake, signage, dress, bridesmaids, hair/makeup flows (all variations of the same image engine)
- Negotiation agent
- Contract review agent
- Day-of timeline agent
- Budget reallocation agent
- Seating arrangement agent
- Vendor portal
- Document vault
- Speech writer / vow writer

### What ships in v2 (Acquired Honeymoon territory)

- Honeymoon planning
- Thank you note generator
- Photo album AI curation
- Anniversary content / retention loop

---

## 4. THE IMAGE GENERATION ENGINE

This is the core differentiator. Build ONE engine with use-case-specific flows on top — NOT 8 separate features.

### Core architecture

**Inputs:**
- Photos (venue, couple, inspiration pins)
- Text prompt
- Structured aesthetic data (palette, mood, density)
- 1-N reference images with role tags (venue, couple, inspiration, style)

**Aesthetic Memory:**
- Once the bride sets her wedding aesthetic, every generation pulls from that DNA automatically
- She doesn't re-prompt the vibe each time
- This is the moat — once she's spent 30 min building it, she won't switch platforms

**Outputs:**
- Image(s) with metadata (model used, references, prompt) so she can iterate
- One-tap export to Vendor Brief PDF

### Aesthetic Profile flow (Day 1 onboarding)

Bride uploads:
- 8-15 inspiration pins (Pinterest, Instagram saves)
- Her venue photos
- Short questionnaire (formal/relaxed, modern/traditional, garden/coastal/urban, palette preferences)

System distills into structured Aesthetic Profile:

```
Palette: cream, sage, dusty rose, antique gold
Florals: garden roses, ranunculus, eucalyptus, asymmetric arrangements
Mood: romantic, lived-in, European garden party
Lighting: warm, candlelit, golden hour
Density: lush but not overwhelming
Type: serif (Cormorant), accent (Italianno)
Avoid: neon, modern minimalist, rustic farmhouse
```

This profile travels with every generation. **This is the stickiness layer.**

### Flows on top of the engine

| Flow | Inputs | Output | Suggested Model |
|---|---|---|---|
| Venue rehearsal | Venue photo + aesthetic | Venue dressed for ceremony/reception | Nano Banana 2 |
| Mood board | 5-15 inspiration pins | Aesthetic doc + 4 unifying images | Soul 2 |
| Save-the-date / invite | Couple photo + aesthetic | Print-ready invite suite | Nano Banana 2 (text rendering) |
| Floral mockup | Venue + aesthetic + bouquet style | Florals on actual venue | Nano Banana 2 |
| Tablescape | Reception venue + aesthetic | Table setup variations | Nano Banana 2 |
| Cake visualizer | Aesthetic + cake style | Cake design options | Soul 2 |
| Signage suite | Aesthetic | Welcome sign, seating chart, menu, programs | Nano Banana 2 (text-heavy) |
| Bridesmaids dresses | Bridesmaid photos + palette | Each in coordinated dress | Soul 2 with reference faces |
| Hair + makeup | Bride photo + style refs | Bride in 12 H&MU combinations | Soul 2 with reference face |
| Dress visualization | Bride body photo + dress style | Bride in dress | Soul 2 with reference face |

Same engine, different flows, same credit economy. Bride feels like she's getting 10 features. Hursh maintains 1 system.

### Generation interaction (the slot-machine UX)

- **One press = 4 variations** (always 4)
- 4 variations = **1 credit** (regardless of model used; absorb variance backend)
- Tap any variation to **"refine"** → spawns 4 new variations in that direction (1 more credit)
- Tap **"lock + use"** → saves to wedding lookbook, exports Vendor Brief PDF

**Why 4:** 1 result feels like roulette (high anxiety). 9 feels overwhelming. 4 is the sweet spot.

**Why bundle the credit cost:** simplifies pricing for the bride, lets backend optimize model selection without her caring.

### Vendor Brief PDF (do not skip)

Every locked image gets a one-tap **"Generate Vendor Brief"** button producing a PDF with:
- The locked image (her venue, her aesthetic)
- Aesthetic profile summary
- Item list (e.g., florals: "12 garden rose centerpieces, eucalyptus garlands on head table, ceremony arch with ranunculus")
- Estimated dimensions / counts
- Reference inspiration pins
- Couple contact info + venue address

**This is what turns visualization into actual wedding execution.** Without it, the platform is a Pinterest replacement. With it, it's indispensable to the actual planning workflow.

### Decision: NO video generation in v1

- Expensive
- Slow
- Often janky
- Not actually useful for decision-making
- Brides need to decide, not be entertained

Image only.

---

## 5. PRICING & CREDIT ECONOMY

### Subscription tiers

| Tier | Price | Includes |
|---|---|---|
| **Starter** | $29/mo | Website, RSVP, guest list, basic AI sourcing (limited), 25 image gens/mo |
| **Plan** | $79/mo | Full AI agents, unlimited sourcing, 150 image gens/mo, contract review, negotiation agent |
| **Visualize** | $149/mo | Everything above + 500 image gens + dress visualization + bridesmaids coordination |
| **Wedding Pass** | $499 one-time | 6 months Plan tier + 200 bonus credits (prepay option) |
| **Concierge** | $1,499 one-time | Visualize tier for 12 months + human (offshore team) handles setup, vendor outreach, document vault |

### Credit refill packs (the upsell engine)

| Pack | Price | Credits | Effective $/gen | Margin |
|---|---|---|---|---|
| Mini | $19 | 30 | $0.63 | ~80% |
| Standard | $49 | 100 | $0.49 | ~80%+ |
| Power | $129 | 300 | $0.43 | ~85% |
| Season Pass | $399 | 1,200 + premium models | $0.33 | ~85%+ |

### Why credits work here

1. **Variable reward loop** — same as slot machines / TikTok. Each gen might be "the one." Built-in retention.
2. **Sunk-cost commitment** — once she's spent $129 on credits, she's invested. Daily usage for 8 months. Tells engaged friends.
3. **Decision anxiety relief** — wedding planning is paralyzing. Generating 40 versions of a tablescape *reduces anxiety* by making her feel she's seen all options. Real emotional product.
4. **Shareability** — every generation is a screenshot. Bride sends to mom, sister, fiancé, group chat. Each share = free ad.

### Critical TODO: Higgsfield TOS review

**Before finalizing pricing, confirm:**
- Does Higgsfield's commercial reseller TOS allow wrapping their gen in a paid product?
- Co-branded output (UI watermark) allowed?
- Volume pricing as it scales?
- Acceptable use for wedding/lifestyle content (no IP issues if bride uploads copyrighted Pinterest pin)?

If consumer Higgsfield TOS doesn't allow this:
- Email Higgsfield partnerships team about white-label / API reseller terms
- Backup: Fal.ai or Replicate with similar models
- Worst case: direct partnerships with Black Forest Labs / Stability

---

## 6. WHY ZOLA CANNOT COMPETE

The 3 features that structurally kill Zola:

### 1. Venue dress rehearsal + Vendor Briefing
Zola can't build this. Would require ground-up rearchitecting around generative AI. Their existing $130M+ registry GMV revenue won't let them prioritize.

### 2. Real pricing intelligence + vendor reputation graph
Compounds with every wedding on the platform. Anonymized real pricing data ("Florists in Bergen County average $7,200 for 150 guests. Your quote is $9,800 — here's why and how to push back.") Zola has data but doesn't expose this way and probably can't legally without restructuring vendor agreements.

### 3. AI vendor sourcing + negotiation agent (the kill shot)
Zola is a marketplace; they make money from vendor listings. They literally CANNOT build an agent that negotiates against their own vendors. Direct conflict of interest. Acquired Planner has no marketplace, so no conflict.

**Zola's business model prevents them from building the most valuable feature for the bride. We can.**

---

## 7. THE BRIGETTE PARTNERSHIP DEAL

### Context

- Brigette Pheloung (@acquired.style on IG, @acquiredstyle on TikTok)
- Hit 1M followers in April 2026 during viral St. Barts bachelorette
- Twin sister Danielle (@daniellephe) is co-creator
- Rachel (Hursh's friend) is the warm intro path
- Hursh knew the twins back in college

### Constraints

- **Hursh has zero burn** — Supabase + Railway + offshore labor only ($1-2K/month total)
- **Hursh cannot pay upfront cash** to Brigette
- **Hursh does not want to raise VC** (this is a cash-flowing micro-SaaS, not a startup)

### Why structure matters

Without VC dilution to plan around, every equity point is real cash forever. So **rev share > equity** for both sides. Cash-heavy, equity-light.

### Recommended deal structure

**At HoldCo level (parent owning all Acquired-branded AI products):**

- **5-7% equity** in HoldCo, 3-year vest, 6-month cliff
- Milestone-based vesting acceleration tied to content deliverables
- **First $100K of net profit goes 100% to Brigette** (works because near-zero burn = profit is real and trackable)
- After $100K threshold: **25% net profit ongoing** for 36 months OR **20% rev share on Acquired Edit pack perpetually** (her choice)
- **5% rev share on her promo code subs** for 24 months (stacks on top)
- **Comped everything** for her wedding
- **First right of refusal** on future verticals (Honeymoon, Home, Style, Mama)
- **Brand IP licensing** — "Acquired" name licensed from her at 2% royalty (symbolic but legally clean, tax-advantageous)

### Danielle's slice

- 1-2% equity (co-creator, lower commitment than Brigette)
- 5% rev share on Acquired Edit pack
- 2% rev share on her promo code

### Rachel's slice (finder + ongoing advocate)

- 0.25-0.5% equity OR
- One-time finder's fee paid from first $100K of revenue (e.g., $10-25K)
- Comped Visualize tier for her own wedding
- Make it real or it's not real

### Why NOT 25-30% equity to Brigette

- It's not "buying her labor" — it's buying launch velocity. Different price tags.
- Co-founder equity (25%+) is for someone bringing the concept (Skims, Fenty). Brigette is a launch partner, not a co-founder.
- Item Beauty (Addison Rae) is the cautionary tale. Massive equity → attention drifted → brand died → equity didn't save it.
- Cash + rev share is liquid and certain. 25% of a startup that fails is $0.

### Smart counter-offer if Brigette pushes for 10%+ equity

> "I'll go to 6% but I'll bump rev share on the pack from 20% to 25% and extend sub rev share to 36 months. That makes you more money over 3 years than 10% equity in a company that hasn't proven distribution yet."

### Non-negotiable: get a startup attorney

- Cooley, Gunderson, Wilson Sonsini, or a boutique
- One billable hour ($400-600) to review term sheet language before pitch
- IP/likeness rights for content using her wedding need proper papering
- Don't sign anything without this

---

## 8. LAUNCH PLAN & 14-DAY SPRINT

### Days 1-3: Lock the foundation

1. **Confirm Brigette's wedding date** — every timeline reverses from here
2. **Higgsfield TOS read** — non-negotiable. If commercial wrap isn't allowed, switch to Fal/Replicate NOW
3. **One-page product spec** for the venue rehearsal feature (forces vapor out)

### Days 4-7: Build the demo that closes her

4. **The St. Barts demo** — pull 3-5 public images of Brigette's bachelorette villa or wedding venue. Generate 8-12 photoreal wedding setups on the actual location across different aesthetics (garden party, modern minimalist, coastal romantic, Mediterranean villa, etc.). **This artifact must exist before pitch.**
5. **Pilot with Rachel** — get her on the platform this week. Real bride, real venue, real generations. Capture screenshots, quotes, time-saved metrics.
6. **Measurement infrastructure** — promo code attribution, MRR dashboard, funnel analytics. So launch day measures from minute one.

### Days 8-11: The deal package

7. **10-slide HoldCo deck** — vision first, product second, partnership third
8. **Term sheet drafted** — specific equity %, vesting schedule, rev share %s, milestone triggers, threshold logic
9. **Startup attorney reviews term sheet** — one billable hour

### Days 12-14: Make the ask

10. **Brief Rachel** — 2-min phone call. What was built, why Brigette is perfect launch partner, what to forward
11. **One-pager for Rachel to forward** — 2 paragraphs + 4 generated images of Brigette's actual venue. Goal is curiosity, not close.
12. **Take the meeting** — walk in with demo, deck, term sheet, Rachel's Day-5 testimonial

### Pitch deck flow (10 slides)

1. The thesis (1 slide)
2. The opportunity — Acquired as AI lifestyle platform (1 slide)
3. The roadmap — 5 verticals, 1 platform, 24 months (1 slide)
4. Why now / why us (1 slide)
5-7. Vertical 1: Acquired Planner — what's built + launch playbook tied to her wedding + LIVE Higgsfield demo of her actual venue (3 slides)
8. The partnership — HoldCo structure, equity, rev share, role (1 slide)
9. Asymmetric commitment + threshold logic (1 slide)
10. The ask — let's launch with your wedding (1 slide)

### Demo sequencing in the meeting

1. Open: "Brigette, let me show you something." (no preamble)
2. Pull up her actual St. Barts venue from public photos
3. Generate 4 ceremony setups in 60 seconds while she watches
4. Then say: "This is what brides will do on our platform. You're the first."
5. *Then* go into the rest of the pitch

**You close her in the first 3 minutes if the demo nails. Everything after is paperwork.**

---

## 9. THRESHOLD LOGIC

What happens after 30 days of launch. **Pre-commit to this in writing. Sign and date. Tell one accountability partner (Raj, fiancée, peer founder).**

| 30-day outcome | Decision |
|---|---|
| **<300 subs** | Launch failed. Keep platform alive at low cost. Refund Brigette's equity vest. Don't invest more time. Lesson learned. |
| **300-600 subs** | Real signal but not breakout. Iterate on product/positioning. Add 1-2 more influencer partners. Re-evaluate at 90 days. Don't change life. |
| **600-1,000 subs** | Working. Acquired Planner above HonesTree in priority. Hire 1 FT engineer. Start Vertical 2 (Honeymoon) for Q1 2027. Keep FlowPilot, scale back hospitality. |
| **1,000+ subs** | Breakout. Execute HoldCo plan. Drop everything except FlowPilot + Acquired. Raise small seed if needed for hires. Hand off Red Oak/Coastal/Mount Laurel. |
| **2,000+ subs** | Unicorn-shaped opportunity. Stop everything else immediately. Get real CEO advisor. Raise capital aggressively. |

### Math sanity check on 1,000 subs

- Brigette ~1M IG followers
- Engaged audience typically 5-15% of total = ~50-150K
- Influencer paid product launch conversion: 0.1-0.5% of engaged audience
- 0.3% of 100K = 300 subs
- 0.5% of 150K = 750 subs
- **1,000 subs in 30 days requires either strong conversion (1%+) OR sustained multi-post campaign across Brigette + Danielle + bachelorette friend group**

This is the upper end of realistic — appropriately ambitious threshold.

### The line for the pitch

> "My commitment to you is asymmetric. If we hit 1,000 subs in 30 days, I drop my other businesses and run Acquired full-time as our HoldCo. If we don't, I keep building it but at smaller scale — your equity still vests on agreed milestones. Either way, you win. But if it works, you have a fully-committed operator building 4 more products with you over the next 24 months."

---

## 10. OPEN QUESTIONS & RISKS

### Open questions Hursh needs to answer

- [ ] Brigette's wedding date?
- [ ] Current state of Higgsfield integration — wired, demo, or stubbed?
- [ ] Higgsfield commercial TOS — confirmed?
- [ ] Real unit economics at 500 / 2K / 5K subs (build the spreadsheet)?
- [ ] Lifestyle business or growth business? (determines deal structure)
- [ ] Backup influencer list (10 names) — to remove single-point-of-failure leverage problem?

### Risks

1. **Higgsfield TOS blocks commercial wrap** → switch to Fal/Replicate, may impact model quality and pricing
2. **Brigette's team negotiates harder than expected** → walk away rather than overpay; this is why backup influencers matter
3. **Launch hits 600 subs not 1,000** → don't move threshold; honor the pre-commit; re-evaluate at 90 days
4. **Hursh overcommits to HoldCo and can't deliver** → milestone-based vesting protects against this; build offshore team capacity NOW
5. **Wedding date is too soon (e.g., June 2026)** → pitch this week with what's built; longer date = more prep time
6. **IP/likeness rights for wedding content** → attorney must paper this properly

### Hursh's pattern to watch for

You are an opportunistic founder. Failure mode: starting new things every time current thing hits a hard problem. The Brigette pitch is hard. Cap table negotiation is hard. If a shiny new idea appears mid-build, name it as avoidance and go back to the harder problem. Write the new idea in a "Q3 2026 evaluate" doc. Don't pivot.

---

## 11. APPENDIX: FULL FEATURE BACKLOG

Categorized by impact. Use for v1.1 / v2 prioritization after launch.

### Generative visual layer (one engine, many flows)

- ✅ Venue dress rehearsal *(launch)*
- ✅ Mood board generator *(launch)*
- ✅ Save-the-date / invitation suite *(launch)*
- 🔨 Tablescape generator
- 🔨 Floral mockup with vendor brief
- 🔨 Cake visualizer
- 🔨 Signage suite (welcome sign, seating chart, menu, programs)
- 🔨 Wedding dress visualization
- 🔨 Bridesmaids dress coordination
- 🔨 Hair + makeup trials

### AI agents doing real work

- ✅ Vendor sourcing agent *(built)*
- 🔨 Negotiation agent (counter-offer drafting, market comparison)
- 🔨 Contract review agent (flags concerning clauses)
- 🔨 Day-of timeline agent (run-of-show + auto-emails vendors)
- 🔨 Budget reallocation agent
- 🔨 Guest communication agent (chatbot trained on wedding details)
- 🔨 RSVP follow-up agent (chases non-responders)
- 🔨 Seating arrangement agent (with social context awareness)

### Data + intelligence layer (the long-term moat)

- 🔨 Real wedding pricing intelligence (anonymized cross-platform data)
- 🔨 Vendor reputation graph (real performance from real weddings)
- 🔨 Timeline benchmarking ("most brides 6mo out have booked X")
- 🔨 Guest list intelligence (realistic RSVP yes-rate prediction)

### Couple-as-creator features (Brigette audience will love)

- 🔨 Wedding mood board generator (Pinterest consolidation)
- 🔨 Engagement announcement reel (acquisition feature)
- 🔨 Vow writer (interview-driven AI)
- 🔨 Speech writer (best man/MoH/parents)
- 🔨 Hashtag generator

### Couple workflow (Monday.com but for weddings)

- ✅ Wedding website + RSVP *(built)*
- 🔨 Shared decision queue (Tinder-style daily decisions)
- 🔨 Family input controls (give MoB opinion access without control)
- 🔨 Vendor portal (each vendor logs in, sees only their slice)
- 🔨 Document vault (OCR'd, searchable)
- 🔨 Day-of command center

### Post-wedding (sets up Acquired Honeymoon / Home)

- 🔨 Thank you note generator (gift list → personalized notes)
- 🔨 Photo album AI curation
- 🔨 Anniversary content / retention loop

---

## NOTES FOR CLAUDE CODE

When building, prioritize in this order:

1. **Aesthetic Profile system** (no image gen yet — just the structured profile + storage)
2. **Image generation engine** (one engine, venue rehearsal flow first)
3. **Vendor Brief PDF generator**
4. **Mood board flow** (variation of image engine)
5. **Save-the-date flow** (variation of image engine)

The 4-variations-per-press UX is critical. So is the credit bundling (1 press = 1 credit = 4 outputs regardless of model). Aesthetic Profile must persist across all generation calls automatically — bride should never re-enter her aesthetic.

For Higgsfield integration: confirm TOS first. Architecture should be model-agnostic (abstract the gen layer so we can swap providers without rewriting flows).

Database: Supabase. Hosting: Railway. Same stack as FlowPilot wholesale dashboard. Reuse infra patterns from `SKILL_cannabis_wholesale_sales_intel.md`.

Promo code attribution and MRR dashboard MUST be wired before launch — non-negotiable for threshold measurement.

---

## END OF SPEC

*This document captures everything from the May 8, 2026 product/deal/launch conversation. Update in place as decisions evolve. Hand to: Claude Code (build), startup attorney (term sheet review), Rachel (when ready, redacted version), Brigette (when ready, pitch deck version).*
