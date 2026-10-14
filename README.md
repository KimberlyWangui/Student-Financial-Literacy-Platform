# PennyWise

A web app that helps Kenyan university students understand their money. Students upload their M-Pesa statement, PennyWise explains where the money goes in plain language, gives a few clear tips with the reason behind each one, and lets them try an investment simulator to learn how saving and investing work.

PennyWise is an **education tool**. It does not tell anyone what to buy, and the simulator is not financial advice.

---

## Table of Contents
- [How it works](#how-it-works)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Installation and setup](#installation-and-setup)
- [Running the tests](#running-the-tests)
- [API documentation](#api-documentation)
- [Privacy](#privacy)
- [Contribution guidelines](#contribution-guidelines)
- [License](#license)

---

## How it works

1. **Upload.** The student uploads their M-Pesa statement PDF and its password.
2. **Parse.** Laravel passes the file to a Flask statement service, which opens it, reads every row, removes duplicates when statements overlap, and works out what each row is (received money, sent money, airtime, M-Shwari, Ziidi, Fuliza and so on).
3. **Understand.** From the cleaned rows it measures how much comes in and goes out in a typical month, how long the wallet usually lasts, and whether the student already saves or borrows. This puts the student in one of five stages:

   | Stage | Meaning |
   |---|---|
   | We need more data | Not enough history yet to say anything useful |
   | Cash is tight | The wallet often runs low before the next deposit |
   | Stable | Spending is steady; the next step is a cushion |
   | Building a saving habit | The student already saves; let it grow |
   | Ready to explore | The student has a buffer and a saving habit |

4. **Advise.** A set of fixed, readable rules turns the stage and the numbers into recommendation cards. Every card says what to do, why, and one first step. There is no black-box model, so every tip can be explained.
5. **Learn.** Cards that suggest saving can open the investment simulator with a sensible amount filled in. The simulator shows the after-tax result, the risk and the possible ups and downs for money market funds, treasury bills, bonds and shares.
6. **Stay motivated.** Students earn badges and XP for uploading statements and trying the simulator.

---

## Features

- **Accounts.** Student and admin roles, email and password sign-in with optional two-factor codes (OTP), Google sign-in, password reset. Laravel Sanctum tokens.
- **M-Pesa statement analysis.** Upload one or more statements. Overlapping statements are merged without double counting. Students can delete all their statement data at any time.
- **Dashboard.** Stage, next step, what a typical month leaves you, statement coverage and how fresh it is, savings held outside the wallet, and badge progress.
- **Recommendations.** Rule-based cards with a reason and a first step. Students can mark a card done and leave feedback.
- **Investment simulator.** Monte Carlo projections for money market funds, treasury bills, bonds and shares, using Kenyan market assumptions, with tax taken out, a possible best and worst case, and an optional target amount. Students can save and compare simulations.
- **Badges.** Earned from what the student does:

  | Badge | How to earn it | XP |
  |---|---|---|
  | First Statement | Upload 1 statement | 20 |
  | Statement Regular | Upload 3 statements | 50 |
  | Simulation Starter | Save 1 simulation | 15 |
  | Curious Learner | Save 5 simulations | 40 |
  | Simulation Pro | Save 10 simulations | 75 |
  | Option Explorer | Try 2 different investment types | 30 |
  | Tried Them All | Try all 4 investment types | 100 |

  Levels come from XP (one level per 100 XP). There is a leaderboard.
- **Admin dashboard.** Student totals, new and active students (active means they uploaded a statement or saved a simulation recently), and badge management.

---

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 18 |
| Backend API | Laravel 12 with Sanctum |
| Database | MySQL |
| Statement service | Flask (Python): PDF parsing, transaction classification, metrics, recommendation rules |
| Simulator service | Flask (Python): Monte Carlo investment engine with Kenyan assumptions in `investment/assumptions.json` |
| Tests | PHPUnit / Pest (Laravel), pytest (Flask) |

The browser only talks to Laravel. Laravel talks to the two Flask services. The Flask services are never exposed to the browser.

---

## Project structure

```text
/backend/PennyWise      Laravel API (auth, statements, recommendations, simulations, badges, admin)
/frontend               React client (student and admin pages)
/finance_model_api      Flask services
    app.py              Investment simulator API (port 5000)
    statement_api.py    Statement analysis API (port 5001)
    statement/          Parser, classifier, metrics, recommendation rules
    investment/         Simulation engine and assumptions.json
/docs/API.md            API reference
```

---

## Installation and setup

You need PHP 8.2+, Composer, Node.js, Python 3.10+ and MySQL.

### 1. Clone the repository
```bash
git clone https://github.com/KimberlyWangui/Student-Financial-Literacy-Platform.git
cd Student-Financial-Literacy-Platform
```

### 2. Flask services
```bash
cd finance_model_api
python -m venv venv
source venv/bin/activate      # Linux / macOS
venv\Scripts\activate         # Windows
pip install -r requirements.txt
```

Set these environment variables before starting the statement service (use long random values):

| Variable | Purpose |
|---|---|
| `INTERNAL_API_TOKEN` | Shared secret. Laravel must send the same value |
| `STATEMENT_HASH_KEY` | Secret key used when the service handles student identifiers |

Start both services, each in its own terminal:
```bash
python app.py                                  # simulator, port 5000
flask --app statement_api run --port 5001      # statement analysis, port 5001
```

### 3. Backend (Laravel)
```bash
cd backend/PennyWise
composer install
cp .env.example .env
php artisan key:generate
```

In `.env`, set the database settings and the links to the Flask services:
```env
FLASK_API_URL=http://127.0.0.1:5000
STATEMENT_API_URL=http://127.0.0.1:5001
STATEMENT_API_TOKEN=<same value as INTERNAL_API_TOKEN>
```

Then create the tables and the starting data (users, profiles and badges) and start the server:
```bash
php artisan migrate
php artisan db:seed
php artisan serve
```
The API is now at `http://127.0.0.1:8000/api`. The seeded accounts are for development only, so change their passwords before any real use.

### 4. Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

---

## Running the tests

```bash
cd backend/PennyWise && php artisan test
cd finance_model_api && pytest
```

The Laravel tests fake the Flask services, so they run without them. The test statements are synthetic.

---

## API documentation

The full endpoint list, with access rules, request fields and error codes, is in **[docs/API.md](docs/API.md)**.

---

## Privacy

- The uploaded PDF and its password are used once to read the statement. They are never stored or logged.
- Only the cleaned transaction rows are kept, and only for the student who uploaded them.
- A student can delete all of their statement data from the app (`DELETE /statements/data`).

---

## Contribution guidelines
1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Submit a pull request for review

## License
This project is licensed under the MIT License. You are free to use, modify and distribute it.
