# Financial Literacy Platform

---

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation & Setup](#installation--setup)
  - [Clone the Repository](#1-clone-the-repository)
  - [Backend (Laravel API) Setup](#2-backend-laravel-api-setup)
  - [Frontend (React) Setup](#3-frontend-react-setup)
  - [Model (Python) Setup](#4-model-python-recommendation-engine)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Contribution Guidelines](#contribution-guidelines)
- [License](#license)

---

## Overview
This is a **web-based financial literacy platform** designed for university students in Kenya. It helps students **track income and expenses, set budgets, simulate investments, and receive personalized financial recommendations**. The system integrates **gamification elements** such as goals and badges to encourage consistent usage and sustainable financial habits.

---

## Features
- **Authentication** (Student & Admin) — Secure login & registration with role-based access (bcrypt hashing, Laravel Sanctum tokens)
- **Budgeting Module** — Add income/expenses, categorize spending, and set monthly budgets
- **Recommendations** — Personalized advice based on spending patterns, allowance range, and living situation
- **Simulation Module** — Try out micro-investment growth projections with interactive graphs
- **Gamification** — Track goals, unlock badges, and build streaks to encourage saving
- **Notifications** — Alerts and reminders for overspending, progress, or upcoming financial goals

---

## Tech Stack
- **Frontend:** React.js
- **Backend:** Laravel (Sanctum API)
- **Database:** MySQL
- **Model:** Python (scikit-learn, Random Forest Classifier, trained on synthetic student financial data)
- **Authentication:** Laravel Sanctum, bcrypt for password hashing
- **Visualization:** Chart.js / Recharts for graphs

---

## Installation and Seup

### 1. Clone the Repository
```bash
git clone https://github.com/KimberlyWangui/Student-Financial-Literacy-Platform.git
```

### 2. Backend (Laravel API) Setup
```bash
cd backend\PennyWise
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

### 3. Frontend (React) Setup
```bash
cd frontend\PennyWise
npm install
npm start
```

### 4. Model (Python Recommendation Engine)
```bash
cd model
python -m venv venv
source venv/bin/activate   # (Linux/macOS)
venv\Scripts\activate      # (Windows)
pip install -r requirements.txt
python train_model.py
```

---

## Project Structure
```bash
/backend   → Laravel API (Auth, Budgets, Recommendations, Admin Panel)
/frontend       → React.js client (Student & Admin Dashboards)
/model          → Python scripts (data preprocessing, training, recommendation engine)
```

---

## Testing
- Unit Testing: PHPUnit (Laravel), Jest (React)
- Integration Testing: Postman API tests

---

## Contribution Guidelines
1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Submit a pull request for review

## License
This project is licensed under the MIT License – free to use, modify, and distribute.