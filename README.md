# The Tab

A running tab between Mark and Milo — poker nights, blackjack, food. Log who owes whom, record payments, and see at a glance who's up.

Static HTML/CSS/JS, no build step, no server. Hosted on GitHub Pages.

## Use it

- **Owes / Paid back** — pick the entry type, tap the names to flip direction, enter an amount (or tap +5 / +10 / +20…).
- Debts can be tagged (Poker, Blackjack, Food, Drinks, Ride, Tickets, Other) with an optional note.
- Payments must be marked **Cash** or **E-transfer**.
- **Settle up** — fills in a payment for the full balance; pick cash or e-transfer to record it.
- **History** — grouped by day, filterable by tag or payments; the little rail on each row shows where the balance stood after that entry. Tap a row for details or to delete it (with undo).
- Names default to Mark and Milo; change them in settings. Light/dark follows your device.
- **Add to Home Screen** on your phone for an app-like feel.

## Sync

The shared tab lives in its own Supabase project on the Free plan, in a `tab` schema the API doesn't expose ([`schema.sql`](schema.sql) recreates it). The app only reaches it through one function, `public.tab_sync(p_key, p_entries)`: it checks the passcode, merges in what the phone sends (new entries are added, deletions win, nothing is ever hard-deleted) and returns every entry. The app syncs on open, whenever it comes back to the foreground, and a few seconds after each change.

- **Set up a phone** once: open an invite link (Settings → Share invite link on a phone that's already set up), or paste the passcode into Settings → Passcode. On iPhone, a Home Screen app keeps its own storage, so paste the passcode in there too.
- Both phones saving at once is fine; the server merges atomically.
- Offline changes stay on the phone and save next time it's online.
- **If sync stops working**, check whether Supabase paused the project. Free projects can pause after a week of low activity; resume it from the dashboard within 90 days.
- **Change the passcode** in the Supabase SQL editor, then re-enter it on both phones:
  ```sql
  update tab.config set key_hash = encode(sha256(convert_to('new-passcode', 'UTF8')), 'hex');
  ```

The app's Supabase key is the publishable one; without the passcode it can't read or write anything.

**Export / Import backup** saves or merges a `.json` file.

## Deploy to GitHub Pages

```bash
gh repo create debt-tracker --public --source=. --push
gh api -X POST repos/markg-05/debt-tracker/pages -f "source[branch]=main" -f "source[path]=/"
```

Or in the repo on github.com: **Settings → Pages → Deploy from a branch → `main` / root**.

## Run locally

```bash
python3 -m http.server 8080
```
