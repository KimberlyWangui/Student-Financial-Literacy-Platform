# PennyWise: Deployment Guide

How PennyWise runs in production on free hosting, how changes get there, and what to check when something breaks.

> **No secrets live in this repo.** This guide lists setting *names* only. Values are kept in each host's dashboard.
> Exact setting names are in each part's `.env.example`.

## 1. The big picture

```
 Student's browser
        |
        v
 React app (Vercel) ------------------------------------+
        |                                               |
        |  /api/...                                     | background "wake-up" pings
        v                                               v
 Laravel API (Render, Docker) ----> Statement service (Render, Flask)
        |            |
        |            +-----------> Simulator service (Render, Flask)
        |
        +--> MySQL database (Aiven)
        +--> Email (Brevo, SMTP port 2525)
        +--> Google sign-in (OAuth)
```

| Part | What it does | Where it runs |
|---|---|---|
| Frontend | React 19 + Vite 7 website | Vercel |
| API | Laravel 12 + Sanctum, login, data, admin | Render (Docker, `php:8.2-apache`) |
| Statement service | Reads M-Pesa PDF statements, works out stage and advice | Render (Flask + gunicorn) |
| Simulator service | Investment simulations | Render (Flask + gunicorn) |
| Database | MySQL | Aiven (free plan, SSL required) |
| Email | OTP and password-reset emails | Brevo (free plan, SMTP) |
| Sign in with Google | OAuth 2.0 | Google Cloud |

## 2. Free-tier behaviour (read this first)

Everything runs on free plans. That has consequences, and the app is built around them.

| Limit | What happens | What we did about it |
|---|---|---|
| Render free services **sleep after 15 minutes** without traffic and need about 35 to 60 seconds to wake | The first request after a quiet period can fail or be slow | The website sends a quiet background request to the statement and simulator services as soon as the relevant page opens, so they are awake before the student needs them. Laravel also retries for about a minute when a service answers 502, 503 or 504 |
| Render gives one workspace **750 free hours a month**, shared by all services | One service cannot be kept awake all month without using nearly all of them | We wake services on demand instead of keeping them awake |
| Render free services **block SMTP ports 25, 465 and 587** | Normal email sending fails with a timeout | Email goes through Brevo on **port 2525** |
| Render free services have **no persistent disk** and **no private network** | Files are lost on restart; services talk over public URLs | Nothing is stored on disk. Services call each other with a secret header (`X-Internal-Token`) |
| Aiven free MySQL: **1 GB**, SSL required, can power off when unused | Large data will not fit; connections need the CA certificate | The CA certificate (public) is in `backend/PennyWise/certs/`. If the database is off, power it on in the Aiven console |
| Brevo free plan: **300 emails a day**; a Gmail address cannot be the sender | Brevo swaps the sender address, so emails can land in Spam | Fine for a student project. A custom domain fixes it |


## 3. Settings per service (names only)

### Vercel (frontend)
- `VITE_API_URL`: the Laravel API address ending in `/api`
- `VITE_STATEMENT_HEALTH_URL`: the statement service address (used only to wake it)
- `VITE_SIMULATOR_HEALTH_URL`: the simulator address plus `/health` (used only to wake it)

> Vite bakes these in at **build time**. After changing one, redeploy the frontend.

### Render: Laravel API
- App: `APP_KEY`, `APP_ENV`, `APP_DEBUG` (false in production), `APP_URL`, `LOG_LEVEL` (`info`), `QUEUE_CONNECTION` (`sync` on the free plan)
- Database (Aiven): the `DB_*` settings and the SSL certificate setting (`MYSQL_ATTR_SSL_CA`)
- Email (Brevo): `MAIL_MAILER=smtp`, `MAIL_HOST=smtp-relay.brevo.com`, `MAIL_PORT=2525`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`
- Google sign-in: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Website address: `FRONTEND_URL` (no trailing slash; also used for CORS)
- Other services: `STATEMENT_API_URL`, `STATEMENT_API_TOKEN`, `FLASK_API_URL` (no trailing slash), `SIMULATOR_API_TOKEN`

### Render: statement service and simulator service
- The shared secret each one checks on every request: see `.env.example` in `finance_model_api/`. It must match the token set on the Laravel service.

## 4. How a change reaches production

1. Work on a **branch** (the `main` branch is protected).
2. Open a **pull request**. GitHub Actions runs three jobs:
   - Frontend: lint, build, 110 Vitest tests
   - Flask: pytest (184 tests)
   - Laravel: `php artisan test`
3. When all checks are green, **merge**.
4. Vercel and Render rebuild from `main` automatically. Wait until each shows **Live**.
5. If the change needs a database change, run the migration (see below).

### Database changes in production
Migrations are run from a developer computer against the live database, using a local-only file `.env.aiven` (never committed):

```
cd backend/PennyWise
php artisan migrate --env=aiven
```

Other one-time commands, also run with `--env=aiven`:
- Badges: `php artisan db:seed --class=BadgeSeeder --env=aiven`
- Admin account: create it in `php artisan tinker --env=aiven` with a real email and a strong password. Never put an admin password in a seeder.

## 5. Security notes

- Secrets are only in host dashboards and in local files that are git-ignored.
- The API accepts browser requests only from the production website and `localhost` (`config/cors.php`).
- The statement and simulator services reject any request without the correct `X-Internal-Token`.
- Registration cannot choose a role; new accounts are always students.
- Google login links to an existing account by email without touching its password, and requires a verified Google email.
- The statement PDF and its password are never stored; only the processed transaction details are kept (see the Privacy Policy page).

**Known limitations**
- After Google sign-in, the login token travels in the page address. A short-lived code exchange would be safer.
- The services on Render are reachable from the internet; they are protected by the secret header, not by a private network.

## 6. Troubleshooting

| What you see | Likely cause | What to do |
|---|---|---|
| "The statement service had a problem" on upload | Service was asleep and did not wake in time | Open its address in a browser, wait about a minute, retry |
| Whole site shows "Network Error" | `FRONTEND_URL` on the API does not exactly match the website address | Fix it on Render (no trailing slash) |
| OTP email does not arrive | Mail settings wrong, or message in Spam | Check Brevo, then Transactional, then Logs; check `MAIL_PORT` is `2525` |
| Email error mentions `:587` and times out | `MAIL_PORT` is still 587 | Set it to `2525` |
| Google says `redirect_uri_mismatch` | Address in Google Cloud differs from `GOOGLE_REDIRECT_URI` | Make them identical, character for character |
| Google login lands on the sign-in page with an error | Look at the Laravel log line starting `Google OAuth error` | Often a missing database column, so run migrations |
| `Unknown column ...` in the logs | Live database is behind the code | Run `php artisan migrate --env=aiven` |
| Vercel changes do not appear | A `VITE_` setting changed but no redeploy | Redeploy the frontend |
| Tests fail only around midnight Nairobi time | A test compared dates in two time zones | Convert to the app timezone before comparing |

## 7. Ideas for later

- Move to an always-on paid plan if real users arrive.
- Add a custom domain for email so messages stop landing in Spam.
- Replace the token-in-address step of Google login with a short-lived code.
- Add a `/health` route to the statement service so wake-up pings do not log a 404.
