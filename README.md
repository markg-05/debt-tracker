# Marker

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

The shared tab is [`data.json` on the `data` branch](https://github.com/markg-05/debt-tracker/blob/data/data.json). The app reads it on open and whenever it comes back to the foreground, and saves a few seconds after each change — every save is a commit, so the branch history is a full audit log.

- **Reading** works for anyone (the repo is public).
- **Saving** needs a token, once per phone: create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with access to only this repo and **Contents: Read and write**, then paste it into Settings → GitHub token. It's stored in that browser only.
- If both phones save at once, the app pulls the other side, merges (new entries are added, deletions win) and saves again.
- Offline changes stay on the phone and save next time it's online.

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
