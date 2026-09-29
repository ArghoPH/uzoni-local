# Uzoni (local edition)

A personal finance manager that runs entirely on your own computer. No cloud,
no account, no internet. Three pieces:

```
browser  →  Express API (localhost:5174)  →  PostgreSQL (localhost:5432)
```

A browser cannot talk to PostgreSQL directly, which is why the small API in
`server/` sits in between. All three run on this machine, and the database is an
ordinary PostgreSQL database — open it in pgAdmin, DBeaver or Azure Data Studio
whenever you want to read or edit the rows by hand.

---

## What is in the box

| Area | What it does |
| --- | --- |
| Accounts | Cash, bank, mobile wallet, credit card and more, each in its own currency, with live balances computed from the ledger |
| Transactions | Income, expense and transfers (including cross-currency), search, filters, bulk recategorize and delete, CSV export |
| Categories | Two-level tree, seeded with a full set on first run, fully editable |
| Budgets | Weekly to yearly or one-off, scoped to chosen categories and accounts |
| Goals | Target amount and date, contributions and withdrawals, required monthly pace |
| Debts | Money lent and borrowed, part payments, due dates |
| Planned payments | Recurring rules that post themselves when due |
| Reports | Money in and out over time, net per period, breakdown by category |
| Import | CSV with column matching and a preview before anything is written |

Money is stored everywhere as an integer count of minor units (paisa, cents).
No amount ever touches a floating point number.

---

## Setup

### 1. Install PostgreSQL 14 or newer

- **Windows** — download the installer from
  [postgresql.org/download/windows](https://www.postgresql.org/download/windows/).
  During setup you choose a password for the `postgres` user: **write it down**,
  you need it in step 3. Keep the default port 5432. The installer also gives
  you pgAdmin, which is the GUI for managing the database.
- **macOS** — `brew install postgresql@16` then `brew services start postgresql@16`.
- **Linux** — `sudo apt install postgresql` then `sudo systemctl start postgresql`.

Check it is running:

```bash
psql --version
```

### 2. Install Node.js 20 or newer

[nodejs.org](https://nodejs.org) — the LTS build.

### 3. Point Uzoni at your database

```bash
cd uzoni-local
npm install
cp .env.example .env        # Windows: Copy-Item .env.example .env
```

Open `.env` and set the password you chose during the PostgreSQL install:

```env
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/uzoni
PORT=5174
```

The `uzoni` database at the end does not have to exist yet.

### 4. Create the database

```bash
npm run db:setup
```

This creates the database if it is missing and applies everything in `db/`.
It ends with `Ready — 39 currencies, 76 categories.` Running it again is safe;
it never duplicates anything.

### 5. Run it

```bash
npm run dev
```

One command starts both the API and the web app. Open
**http://localhost:5173**. The first screen asks for your main currency and
first account, and then you are in.

---

## Everyday use

```bash
npm run dev       # develop: API on 5174, app on 5173 with hot reload
npm run build     # bundle the app into dist/
npm start         # production: one process on 5174 serving the app and the API
```

After `npm run build`, `npm start` serves everything from
**http://localhost:5174** — a single process you can leave running.

---

## Managing the database by hand

The database is plain PostgreSQL, so any client works.

- **pgAdmin** (ships with the Windows installer) — connect to `localhost:5432`,
  open the `uzoni` database, then Schemas → public → Tables.
- **DBeaver** — free, cross-platform, handles PostgreSQL well.
- **Azure Data Studio** — if you prefer the Microsoft tooling, install its
  PostgreSQL extension and add a connection to `localhost:5432`.
- **psql** — `psql postgres://postgres:YOUR_PASSWORD@localhost:5432/uzoni`

Note that SQL Server Management Studio cannot connect to PostgreSQL; it only
speaks the SQL Server protocol.

Two things to know before editing rows by hand:

- **Amounts are in minor units.** ৳1,250.50 is stored as `125050`. Type the
  paisa, not the taka.
- **Balances are not stored.** `account_balances` is a view over
  `account_ledger`, which expands every transaction into signed legs. Edit the
  transaction and the balance follows; there is no balance column to correct.

### Backup and restore

```bash
pg_dump postgres://postgres:YOUR_PASSWORD@localhost:5432/uzoni > uzoni-backup.sql
psql postgres://postgres:YOUR_PASSWORD@localhost:5432/uzoni < uzoni-backup.sql
```

Put that first line in Task Scheduler or a cron job and you have automatic
backups. Uzoni holds the only copy of this data, so do set one up.

---

## Tests

```bash
npm test          # amount parsing/formatting and the CSV reader
npm run test:api  # the whole API end to end against a throwaway database
npm run typecheck
```

`npm run test:api` creates a scratch database, applies the schema, starts the
server and then asserts on real behaviour: balances after cross-currency
transfers, rejected bad writes, budget windows, category rollups and idempotent
generation of recurring payments. It drops the scratch database afterwards and
never touches your real one.

---

## How the data model works

**Balances are never stored.** A transfer becomes two legs in `account_ledger`:
money leaving the source and money arriving at the destination, which may be a
different amount when the currencies differ. A balance cannot fall out of step
with the transactions behind it.

**The database refuses bad data rather than trusting the app.** A trigger on
`transactions` checks that the currency matches the account, that an expense is
not filed under an income category, and that a cross-currency transfer says how
much actually arrived. Those rules hold even when you edit rows in pgAdmin.

**Exchange rates are yours, and never invented.** `fx_rate` reads the rates you
saved, most recent first, and falls back to the inverse pair. When no rate
exists the conversion returns null, and the reports say so instead of quietly
showing a wrong total.

**Repeating things are anchored, not incremented.** Budget windows and recurring
payments are computed as `start + n × interval` rather than by adding to the
previous date, so a rule that starts on the 31st gives 31 Jan → 28 Feb → 31 Mar
instead of collapsing to the 28th forever.

---

## Security

There is no login, because there is nothing to log in to: the API binds to
`127.0.0.1` and is reachable only from this computer.

That assumption is the whole security model. **Do not expose this server to a
network or the internet** — not by changing the bind address, not through a
tunnel, not by port-forwarding. Anyone who can reach it has full access to every
row. If you ever need it on more than one machine, authentication has to be
added first.

---

## Project layout

```
db/           schema, views, reporting functions — applied by npm run db:setup
server/       Express API: db.js (pool), routes.js, index.js, migrate.js
src/
  lib/        api client, money maths, dates, CSV, types
  hooks/      one file per area, TanStack Query on top of the API
  components/ UI primitives, the transaction dialog, the ledger list
  pages/      one file per route
scripts/      test runners
```

## Notes

- Uzoni does not connect to banks. Transactions are entered by hand or imported
  from CSV.
- `attachment_path` exists on transactions for receipt photos, but the upload
  UI is not built yet.
