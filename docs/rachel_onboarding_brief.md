# Rachel onboarding brief — ready to send

**Drafted:** May 8-11, 2026
**Status:** Account provisioned (see `supabase/seed/seed_rachel.ts`), brief ready to send
**Send when:** Hursh has bandwidth to monitor first questions (suggested: Saturday morning)

---

## Pre-send verification (60 seconds)

Before sending, sign in incognito as `raachmc@aol.com` / `Wedding2027!` and confirm:

- [ ] Login works (toggle "Use password instead" if defaulted to magic-link)
- [ ] Dashboard renders without errors
- [ ] /venues shows Switch House as the lead-pick venue with address + phone
- [ ] /plan shows ~37 starter tasks with deadlines around Sept 12, 2026
- [ ] /budget shows empty state with "Generate baseline" CTA
- [ ] /estimator shows empty state pointing to /budget
- [ ] /settings/preferences shows wedding date Sept 12, 2026 + USD currency + Rachel's name

If any of those fail, fix before sending.

---

## The message (copy-paste ready)

**Subject (if email):** Wedding planner thing for you & Jay 🤍
**Or if iMessage:** skip the subject, just send.

---

> Hey Rach — random one. I've been building an AI wedding planner over the last few months. It started for my own wedding (you saw bits of it), then I gave a couple friends access to test, and now since you and Jay are deep in planning mode I want you to have it. **Free, forever, no strings.** I'd just love your honest reactions while you actually use it.
>
> **🔑 Login**
> URL: https://wedding-os-production.up.railway.app/login
> Email: raachmc@aol.com
> Password: `Wedding2027!`
>
> **Important:** click "Use password instead" on the login page (the default is magic-link which can be flaky on AOL). The toggle is right there.
>
> **What's already set up for you**
> - **Sept 12, 2026** locked as your wedding date
> - **The Switch House** pre-added as your venue (marked decided + lead pick — Cescaphe Group at 1325 N Beach St, Philadelphia, address + phone pulled in automatically)
> - **37 starter tasks** in `/plan`, each with a deadline computed backwards from Sept 12 (e.g. "Send save-the-dates" lands ~6 months out, "Final headcount to caterer" lands ~1 month out)
> - **USD currency** as your default
>
> **What I'd try first (~15 min total)**
>
> **1. `/onboarding`** — chat with the AI. It'll ask about you, Jay, your style, guest count, budget target, what's already booked, what's stressing you, and whether you're doing rehearsal dinner / welcome drinks / after-party / brunch. Ramble — the more you tell it, the more it pre-populates the rest.
>
> **2. `/budget`** — hit "Generate my baseline." Wait ~30 sec. It spins up a personalized 70-line budget tree from your guest count + Philadelphia. You can drag the sliders, OR click any number to type an exact amount. Couple-thousand-dollar-precision is doable.
>
> **3. `/plan`** — pencil icon on any task. There's now a "Cost link" section at the bottom — type an amount (e.g. "Book photographer → $4,500") and it'll auto-create a budget line for you. Watch how the price bubble appears next to the task name. This loop closes Plan ↔ Budget ↔ Estimator.
>
> **4. `/estimator`** — drill into any category (e.g. Catering), swap vendors, edit estimates inline. Live-recalc.
>
> **5. `/vendors/find`** — search "Philadelphia photographer" or "Philadelphia florist." Real Google Places results, real contact info. Add a few — when you click into one, you'll see an AI-drafted intro email pre-written based on your wedding details. You don't have to send the drafts; they're local. But it's a sense of the vibe.
>
> **6. `/guests/import`** — drop an Excel file. Even 10 rough names — AI maps the columns automatically. Then `/guests/seating` lets you build floor plans.
>
> **7. `/settings/public-site`** — publish a wedding website at `/w/your-slug`. 5 themes. RSVPs roll back to the dashboard.
>
> **What's broken / known limits — being honest**
> - **Gmail autopilot won't work for you** because raachmc is AOL. That integration only works for Gmail accounts. Everything else works fine; just no auto-drafting of vendor replies into your inbox.
> - You might see a one-off red "connection blip" toast on the first onboarding message — first request to a sleeping server. It auto-retries silently. Just send your message again if anything looks weird.
> - The "Astia" branding you'll see in a couple of admin-only corners is a different planner customer of mine. Ignore it. You're on Acquired Planner.
> - Some tasks (especially the venue-related ones) are still pretty generic — the system doesn't know Switch House-specific quirks yet. Edit any task freely (pencil icon).
>
> **What I'd love back from you**
> 1. What did you click first that felt confusing or didn't do what you expected?
> 2. What's a feature you want that doesn't exist?
> 3. Would you actually tell another newly-engaged friend about this? If yes, what would you say it does?
>
> No pressure on timeline. Use it as much or as little as you want over the next few weeks. I'll fix anything you flag and check in when you've poked around. Thank you for being the guinea pig 🤍
>
> — Hursh

---

## Notes on tone

- Written for the "Rach" register — close-friend casual. Adjust if your relationship style is different.
- The 🤍 emoji is the only flourish. Strip if not your vibe.
- "Free, forever, no strings" is intentional — don't soft-pedal it. She'll be more honest about feedback if she knows it's not a transactional ask.
- The 3 ask-back questions at the bottom are deliberately weighted toward signal that informs Brigette pitch:
  - Q1 = onboarding friction
  - Q2 = the gap you didn't see
  - Q3 = whether she'd refer = the core "word-of-mouth flowing toward Brigette through real product experience" mechanism in `PRODUCT_ROADMAP.md`

## After sending — what to monitor

- First 24h: did she log in? (check `users.last_sign_in_at` in Supabase or just ask)
- First 72h: did she generate a budget baseline? (check `budget_lines` count in her workspace)
- First week: did she add any custom vendors via /vendors/find?
- First 2 weeks: did she edit her Switch House venue card or generate a public site?

These are the proxies for "is she actually using this." If yes, write her real questions down — they become the launch insights for Brigette / paying-planner outbound.

## Variant for shorter formats

**iMessage shortform (if email feels too formal):**

> Yo Rach — random ask. I built this AI wedding planner over the last few months. Started for me + a couple test friends, but since you're in planning mode I want you to have it. Free, forever, no catch.
>
> Login → https://wedding-os-production.up.railway.app/login
> raachmc@aol.com / Wedding2027! (click "Use password instead" on the login page)
>
> Switch House is pre-loaded, 37 tasks queued, Sept 12 locked. Try /onboarding first then /budget → "Generate baseline." Roast me — I want to know what breaks first 🤍

---

## End of brief
