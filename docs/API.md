# PennyWise API reference

Base URL (local): `http://127.0.0.1:8000/api`

All endpoints return JSON. Generated from the Laravel routes and controllers (OpenAPI, version 0.0.1) and checked against `routes/api.php`.

## Contents

- [Authentication](#authentication)
- [Google sign-in](#google-sign-in)
- [Password reset](#password-reset)
- [Users](#users)
- [Student profiles](#student-profiles)
- [M-Pesa statements and recommendations](#m-pesa-statements-and-recommendations)
- [Investment simulator](#investment-simulator)
- [Badges (admin and catalogue)](#badges-admin-and-catalogue)
- [Student badges, XP and leaderboard](#student-badges-xp-and-leaderboard)
- [Recommendations (stored cards)](#recommendations-stored-cards)
- [Older simulation endpoints](#older-simulation-endpoints)
- [Other endpoints](#other-endpoints)

## How to call the API

**Authentication.** Sign in with `POST /login` (then `POST /verify-otp` when two-factor is on) or with Google. You receive a Sanctum token. Send it on every protected request:

```http
Authorization: Bearer <token>
Accept: application/json
```

**Access levels used below**

| Level | Meaning |
|---|---|
| Public | No token needed |
| Logged in | Any valid token |
| Student | Valid token with the student role |
| Student or admin | Valid token; the controller then limits what each role can see or change (students only their own data) |
| Admin | Valid token with the admin role |

**Common errors**

| Code | Meaning |
|---|---|
| 401 | Missing or invalid token |
| 403 | Your role is not allowed to do this |
| 404 | Not found, or not yours |
| 422 | Validation failed. The body lists the fields that were wrong |
| 500 / 503 | Server error, or the Flask service is not running |

**Statement errors** use the shape `{ "status": "error", "code": "...", "message": "..." }`. For example `NO_STATEMENT` (404) means the student has not uploaded a statement yet.

---

## Authentication

| Method | Path | Access | What it does |
|---|---|---|---|
| POST | `/login` | Public | Authenticate an existing user and trigger two-factor authentication |
| POST | `/logout` | Logged in | Log out the authenticated user and revoke their tokens |
| POST | `/register` | Public | Register a new user and issue an authentication token |
| POST | `/resend-otp` | Public | Resend OTP for users with 2FA enabled |
| POST | `/verify-otp` | Public | Verify the OTP for users and issue a login token |

### POST `/login`

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| email | string | yes |  |
| password | string | yes |  |

Responses: 200, 401, 422 Validation

### POST `/register`

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| name | string | yes |  |
| email | string | yes |  |
| password | string | yes |  |
| password_confirmation | string | yes |  |

Responses: 201, 422 Validation

### POST `/resend-otp`

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| user_id | integer | yes |  |

Responses: 200, 400, 422 Validation

### POST `/verify-otp`

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| user_id | integer | yes |  |
| otp | string (max length 6, min length 6) | yes |  |

Responses: 200, 401, 422 Validation

## Google sign-in

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/auth/google` | Public | Redirect the user to Google's OAuth authorization page |
| GET | `/auth/google/callback` | Public | Handle Google callback |

### GET `/auth/google/callback`

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| code | query | string | no |  |

Responses: 200

## Password reset

| Method | Path | Access | What it does |
|---|---|---|---|
| POST | `/forgot-password` | Public | Send password reset link to email |
| POST | `/reset-password` | Public | Reset password |

### POST `/forgot-password`

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| email | string (email) | yes |  |

Responses: 200, 422 Validation

### POST `/reset-password`

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| token | string | yes |  |
| email | string (email) | yes |  |
| password | string (min length 8) | yes |  |
| password_confirmation | string (min length 8) | yes |  |

Responses: 200, 422 Validation

## Users

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/users` | Admin | Display a listing of users |
| POST | `/users` | Admin | Store a newly created user |
| GET | `/users/{id}` | Student or admin | Display the specified user |
| PUT | `/users/{id}` | Student or admin | Update the specified user |
| PATCH | `/users/{id}` | Student or admin | Update the specified user |
| DELETE | `/users/{id}` | Admin | Remove the specified user |

### GET `/users`

Accessible by: Admin only.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| per_page | query | string | no |  |

Responses: 200, 403, 401 Authentication

### POST `/users`

Accessible by: Admin only.

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| name | string (max length 255) | yes |  |
| email | string (email) | yes |  |
| password | string (min length 8) | yes |  |
| role | `admin` / `student` | yes |  |
| password_confirmation | string (min length 8) | yes |  |

Responses: 201, 403, 422 Validation, 401 Authentication

### GET `/users/{id}`

Accessible by: Admin (any user) and Student (only themselves).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 403, 404, 401 Authentication

### PUT `/users/{id}`

Accessible by: Admin (all users) and Student (only themselves).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| name | string (max length 255) | no |  |
| email | string (email) | no |  |
| password | string (min length 8) | no |  |
| role | `admin` / `student` | no |  |
| two_factor_enabled | boolean | no |  |
| password_confirmation | string (min length 8) | no |  |

Responses: 200, 403, 404, 422 Validation, 401 Authentication

### PATCH `/users/{id}`

Accessible by: Admin (all users) and Student (only themselves).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| name | string (max length 255) | no |  |
| email | string (email) | no |  |
| password | string (min length 8) | no |  |
| role | `admin` / `student` | no |  |
| two_factor_enabled | boolean | no |  |
| password_confirmation | string (min length 8) | no |  |

Responses: 200, 403, 404, 422 Validation, 401 Authentication

### DELETE `/users/{id}`

Accessible by: Admin only.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 403, 404, 401 Authentication

## Student profiles

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/student-profiles` | Admin | Display a listing of student profiles |
| POST | `/student-profiles` | Student or admin | Store a newly created student profile |
| GET | `/student-profiles/active` | Admin | Get active students: those who uploaded a statement or saved a simulation recently |
| GET | `/student-profiles/me` | Student | Get the authenticated student's profile |
| GET | `/student-profiles/metadata` | Logged in | Get profile metadata (allowance ranges, genders, years of study, living situations) |
| GET | `/student-profiles/new-students` | Admin | Get new students (recently registered) |
| GET | `/student-profiles/total-students` | Admin | Get total number of students |
| GET | `/student-profiles/{id}` | Student or admin | Display the specified student profile |
| PUT | `/student-profiles/{id}` | Student or admin | Update the specified student profile |
| PATCH | `/student-profiles/{id}` | Student or admin | Update the specified student profile |
| DELETE | `/student-profiles/{id}` | Student or admin | Remove the specified student profile |

### GET `/student-profiles`

Accessible by: Admin only.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| per_page | query | string | no |  |

Responses: 200, 403, 401 Authentication

### POST `/student-profiles`

Accessible by: Students (only for themselves).

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| year_of_study | `one` / `two` / `three` / `four` / `five` / `six` | yes |  |
| living_situation | `Home` / `Hostel` / `Shared Apartment` / `Solo Apartment` / `Other` | yes |  |
| monthly_allowance_range | `0 – 5` / `000` / `5` / `001 – 10` / `000` / `10` / `001 – 20` / `000` / `20` / `001 – 35` / `000` / `35` / `001 – 50` / `000+` | yes |  |
| course | string (max length 255) | yes |  |
| birth_date | string or null (date-time) | no |  |
| gender | `male` / `female` / `other` / `prefer_not_to_say` | no |  |

Responses: 201, 422 Validation, 409, 403, 401 Authentication

### GET `/student-profiles/active`

Accessible by: Admin only.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| days | query | string | no | Get days parameter (default 30) |

Responses: 200, 403, 401 Authentication

### GET `/student-profiles/me`

Accessible by: Students only.

Responses: 200, 404, 403, 401 Authentication

### GET `/student-profiles/metadata`

Accessible by: All authenticated users.

Responses: 200, 401 Authentication

### GET `/student-profiles/new-students`

Accessible by: Admin only.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| days | query | string | no | Get days parameter (default 30) |
| per_page | query | string | no |  |

Responses: 200, 403, 401 Authentication

### GET `/student-profiles/total-students`

Accessible by: Admin only.

Responses: 200, 403, 401 Authentication

### GET `/student-profiles/{id}`

Accessible by: Admin (any profile) and Student (only their own).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 403, 404, 401 Authentication

### PUT `/student-profiles/{id}`

Accessible by: Admin (any profile) and Student (only their own).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| year_of_study | `one` / `two` / `three` / `four` / `five` / `six` | no |  |
| living_situation | `Home` / `Hostel` / `Shared Apartment` / `Solo Apartment` / `Other` | no |  |
| monthly_allowance_range | `0 – 5` / `000` / `5` / `001 – 10` / `000` / `10` / `001 – 20` / `000` / `20` / `001 – 35` / `000` / `35` / `001 – 50` / `000+` | no |  |
| course | string (max length 255) | no |  |
| birth_date | string or null (date-time) | no |  |
| gender | `male` / `female` / `other` / `prefer_not_to_say` | no |  |

Responses: 200, 422 Validation, 403, 404, 401 Authentication

### PATCH `/student-profiles/{id}`

Accessible by: Admin (any profile) and Student (only their own).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| year_of_study | `one` / `two` / `three` / `four` / `five` / `six` | no |  |
| living_situation | `Home` / `Hostel` / `Shared Apartment` / `Solo Apartment` / `Other` | no |  |
| monthly_allowance_range | `0 – 5` / `000` / `5` / `001 – 10` / `000` / `10` / `001 – 20` / `000` / `20` / `001 – 35` / `000` / `35` / `001 – 50` / `000+` | no |  |
| course | string (max length 255) | no |  |
| birth_date | string or null (date-time) | no |  |
| gender | `male` / `female` / `other` / `prefer_not_to_say` | no |  |

Responses: 200, 422 Validation, 403, 404, 401 Authentication

### DELETE `/student-profiles/{id}`

Accessible by: Admin (any profile) and Student (only their own).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 403, 404, 401 Authentication

## M-Pesa statements and recommendations

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/statements` | Logged in | Statements this student has uploaded, newest first |
| POST | `/statements` | Student | Upload an M-Pesa statement PDF: parse it, store the cleaned rows, return fresh insights |
| DELETE | `/statements/data` | Logged in | Delete every statement record and transaction stored for this student |
| GET | `/statements/insights` | Logged in | Metrics, stage and next step from everything stored for this student |
| GET | `/statements/recommendations` | Student | What the Recommendations page shows: the stage, the current cards and the statement coverage |
| GET | `/statements/savings-balance` | Student | The savings the student says they hold outside their wallet |
| PUT | `/statements/savings-balance` | Student | Save (or clear, with null) the student's savings balance, then refresh their cards so the new number is used straight away |

### POST `/statements`

Accessible by: students only. The PDF and its password are never stored or logged.

Body (`multipart/form-data`):

| Field | Type | Required | Notes |
|---|---|---|---|
| file | file (PDF) | yes | The M-Pesa statement PDF. Max 10 MB |
| password | string (max length 128) | yes | The PDF's password. Used once to open the file, never stored or logged |
| consent | string | no | Optional |

Responses: 201, 200, 403, 422 Validation, 401 Authentication

### GET `/statements/insights`

Savings held outside the wallet (M-Shwari, Ziidi) come from the student's profile; an explicit ?extra_savings=N overrides it for that request.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| extra_savings | query | number (min 0, max 1e+08) | no |  |

Responses: 200, 404, 403, 422 Validation, 401 Authentication

### GET `/statements/recommendations`

Recomputes from stored transactions, so a card that depends on time (a stale statement) appears on its own, and keeps each card's status and feedback. Accessible by: students only.

Responses: 200, 404, 403, 401 Authentication

### GET `/statements/savings-balance`

Accessible by: students only.

Responses: 200, 403, 401 Authentication

### PUT `/statements/savings-balance`

The balance is saved even if the refresh fails. Accessible by: students only.

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| savings_balance | number or null (min 0, max 1e+08) | yes |  |

Responses: 200, 422 Validation, 403, 401 Authentication

## Investment simulator

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/investments` | Student or admin | Display a listing of investment simulations |
| POST | `/investments` | Student | Store a newly created investment simulation |
| POST | `/investments/compare` | Logged in | Compare multiple investment scenarios |
| GET | `/investments/my-statistics` | Student | Get investment statistics for the authenticated student |
| POST | `/investments/preview` | Logged in | Preview an investment simulation without saving it |
| GET | `/investments/types` | Logged in | Get available investment types with their statistics |
| GET | `/investments/{id}` | Student or admin | Display the specified investment simulation |
| DELETE | `/investments/{id}` | Logged in | Remove the specified investment simulation |

### GET `/investments`

Admin: View all simulations (READ only) Student: View only their own simulations.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| per_page | query | string | no |  |

Responses: 200, 401 Authentication

### POST `/investments`

Accessible by: Students only.

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| amount_invested | number (min 1, max 1e+09) | yes |  |
| duration_value | integer (min 1, max 600) | yes |  |
| duration_unit | `months` / `years` | yes |  |
| investment_type | `mmf` / `tbill` / `stock` / `bond` | yes |  |
| monthly_topup | number (min 0, max 1e+09) | no |  |
| target_amount | number or null (min 1, max 1e+09) | no |  |
| reinvestment_frequency | `monthly` / `quarterly` / `annually` | no |  |

Responses: 500, 201, 403, 422 Validation, 401 Authentication

### POST `/investments/compare`

Accessible by: All authenticated users.

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| scenarios | array | yes |  |

Responses: 500, 200, 422 Validation, 401 Authentication

### GET `/investments/my-statistics`

Accessible by: Students only.

Responses: 200, 403, 401 Authentication

### POST `/investments/preview`

Accessible by: All authenticated users.

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| amount_invested | number (min 1, max 1e+09) | yes |  |
| duration_value | integer (min 1, max 600) | yes |  |
| duration_unit | `months` / `years` | yes |  |
| investment_type | `mmf` / `tbill` / `stock` / `bond` | yes |  |
| monthly_topup | number (min 0, max 1e+09) | no |  |
| target_amount | number or null (min 1, max 1e+09) | no |  |
| reinvestment_frequency | `monthly` / `quarterly` / `annually` | no |  |

Responses: 500, 200, 422 Validation, 401 Authentication

### GET `/investments/types`

Accessible by: All authenticated users.

Responses: 500, 200, 401 Authentication

### GET `/investments/{id}`

Admin: View any simulation (READ only) Student: View only their own simulation.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 403, 404, 401 Authentication

### DELETE `/investments/{id}`

Admin: Can delete any simulation Student: Can delete only their own simulation.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 403, 404, 401 Authentication

## Badges (admin and catalogue)

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/badges` | Student or admin | Display a listing of badges |
| POST | `/badges` | Admin | Store a newly created badge |
| GET | `/badges/criteria-types` | Logged in | Get available badge criteria types |
| GET | `/badges/statistics` | Admin | Get badge statistics |
| GET | `/badges/{id}` | Student or admin | Display the specified badge |
| PUT | `/badges/{id}` | Admin | Update the specified badge |
| PATCH | `/badges/{id}` | Admin | Update the specified badge |
| DELETE | `/badges/{id}` | Admin | Remove the specified badge |

### GET `/badges`

Accessible by: All authenticated users (READ only for students).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| sort_by | query | string | no | Sort by XP reward or created_at |
| sort_order | query | string | no |  |
| per_page | query | string | no |  |

Responses: 200, 401 Authentication

### POST `/badges`

Accessible by: Admin only.

Body (`multipart/form-data`):

| Field | Type | Required | Notes |
|---|---|---|---|
| badge_name | string (max length 255) | yes |  |
| description | string | yes |  |
| criteria_type | `statement_count` / `simulation_count` / `simulation_types` | yes |  |
| criteria_value | integer (min 1) | yes |  |
| xp_reward | integer (min 0) | yes |  |
| image | file (PDF) | no |  |

Responses: 201, 403, 422 Validation, 401 Authentication

### GET `/badges/criteria-types`

Accessible by: All authenticated users.

Responses: 200, 401 Authentication

### GET `/badges/statistics`

Accessible by: Admin only.

Responses: 200, 403, 401 Authentication

### GET `/badges/{id}`

Accessible by: All authenticated users.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 404, 401 Authentication

### PUT `/badges/{id}`

Accessible by: Admin only.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`multipart/form-data`):

| Field | Type | Required | Notes |
|---|---|---|---|
| badge_name | string (max length 255) | no |  |
| description | string | no |  |
| criteria_type | `statement_count` / `simulation_count` / `simulation_types` | no |  |
| criteria_value | integer (min 1) | no |  |
| xp_reward | integer (min 0) | no |  |
| image | file (PDF) | no |  |

Responses: 200, 404, 403, 422 Validation, 401 Authentication

### PATCH `/badges/{id}`

Accessible by: Admin only.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`multipart/form-data`):

| Field | Type | Required | Notes |
|---|---|---|---|
| badge_name | string (max length 255) | no |  |
| description | string | no |  |
| criteria_type | `statement_count` / `simulation_count` / `simulation_types` | no |  |
| criteria_value | integer (min 1) | no |  |
| xp_reward | integer (min 0) | no |  |
| image | file (PDF) | no |  |

Responses: 200, 404, 403, 422 Validation, 401 Authentication

### DELETE `/badges/{id}`

Accessible by: Admin only.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 404, 403, 401 Authentication

## Student badges, XP and leaderboard

| Method | Path | Access | What it does |
|---|---|---|---|
| POST | `/badges/award` | Admin | Award a badge to a student (Manual award by admin) |
| POST | `/badges/check-my-badges` | Student | Check and award eligible badges for authenticated student |
| GET | `/badges/leaderboard` | Logged in | Get leaderboard based on XP |
| GET | `/badges/my-badges` | Student | Get my badges (authenticated student) |
| GET | `/badges/my-progress` | Student | Get badge progress for authenticated student |
| POST | `/badges/remove` | Admin | Remove a badge from a student |
| GET | `/badges/{badgeId}/students` | Admin | Get all students who earned a specific badge |
| GET | `/students/{studentId}/badges` | Student or admin | Get badges for a specific student |

### POST `/badges/award`

Accessible by: Admin only.

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| student_id | integer | yes |  |
| badge_id | integer | yes |  |

Responses: 201, 409, 422 Validation, 403, 401 Authentication

### POST `/badges/check-my-badges`

This endpoint manually triggers badge checking. Accessible by: Students only.

Responses: 200, 403, 401 Authentication

### GET `/badges/leaderboard`

Accessible by: All authenticated users.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| limit | query | string | no |  |

Responses: 200, 401 Authentication

### GET `/badges/my-badges`

Accessible by: Students only.

Responses: 200, 403, 401 Authentication

### GET `/badges/my-progress`

Shows progress towards earning each badge. Accessible by: Students only.

Responses: 200, 403, 401 Authentication

### POST `/badges/remove`

Accessible by: Admin only.

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| student_id | integer | yes |  |
| badge_id | integer | yes |  |

Responses: 200, 404, 403, 422 Validation, 401 Authentication

### GET `/badges/{badgeId}/students`

Accessible by: Admin only.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| badgeId | path | string | yes |  |

Responses: 200, 404, 403, 401 Authentication

### GET `/students/{studentId}/badges`

Admin: Can view any student's badges Student: Can only view their own badges.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| studentId | path | string | yes |  |

Responses: 200, 404, 403, 401 Authentication

## Recommendations (stored cards)

These manage stored recommendation cards (for example a student marking a card done). The cards themselves are built from the statement, see `GET /statements/recommendations`.

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/recommendations` | Student or admin | Display a listing of recommendations |
| POST | `/recommendations` | Admin | Store a newly created recommendation |
| GET | `/recommendations/metadata` | Logged in | Get metadata (categories, statuses, source types) |
| GET | `/recommendations/statistics` | Logged in | Get recommendation statistics |
| GET | `/recommendations/{id}` | Student or admin | Display the specified recommendation |
| PUT | `/recommendations/{id}` | Student or admin | Update the specified recommendation |
| PATCH | `/recommendations/{id}` | Student or admin | Update the specified recommendation |
| DELETE | `/recommendations/{id}` | Admin | Remove the specified recommendation |
| PATCH | `/recommendations/{id}/status` | Student | Update recommendation status (for students) |

### GET `/recommendations`

Admin: View all recommendations Student: View only their own recommendations.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| per_page | query | string | no |  |

Responses: 200, 401 Authentication

### POST `/recommendations`

Accessible by: Admin only.

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| student_id | integer | yes |  |
| title | string (max length 255) | yes |  |
| recomm_text | string | yes |  |
| category | string (max length 255) | yes |  |
| confidence_score | number or null (min 0, max 100) | no |  |
| reasoning | string or null | no |  |
| impact_estimate | number or null | no |  |
| source_type | `AI_Model` / `Admin` / `System_Rule` | yes |  |
| model_version | string or null (max length 255) | no |  |
| status | `pending` / `viewed` / `accepted` / `rejected` / `ignored` | no |  |

Responses: 201, 403, 422 Validation, 401 Authentication

### GET `/recommendations/metadata`

Accessible by: All authenticated users.

Responses: 200, 401 Authentication

### GET `/recommendations/statistics`

Admin: Statistics for all recommendations Student: Statistics for their own recommendations.

Responses: 200, 401 Authentication

### GET `/recommendations/{id}`

Admin: View any recommendation Student: View only their own recommendation.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 403, 404, 401 Authentication

### PUT `/recommendations/{id}`

Admin: Full update control Student: Can only update status and feedback.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| student_id | integer | no |  |
| title | string (max length 255) | no |  |
| recomm_text | string | no |  |
| category | string (max length 255) | no |  |
| confidence_score | number or null (min 0, max 100) | no |  |
| reasoning | string or null | no |  |
| impact_estimate | number or null | no |  |
| source_type | `AI_Model` / `Admin` / `System_Rule` | no |  |
| model_version | string or null (max length 255) | no |  |
| status | `pending` / `viewed` / `accepted` / `rejected` / `ignored` | no |  |
| feedback | string or null | no |  |

Responses: 200, 403, 404, 422 Validation, 401 Authentication

### PATCH `/recommendations/{id}`

Admin: Full update control Student: Can only update status and feedback.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| student_id | integer | no |  |
| title | string (max length 255) | no |  |
| recomm_text | string | no |  |
| category | string (max length 255) | no |  |
| confidence_score | number or null (min 0, max 100) | no |  |
| reasoning | string or null | no |  |
| impact_estimate | number or null | no |  |
| source_type | `AI_Model` / `Admin` / `System_Rule` | no |  |
| model_version | string or null (max length 255) | no |  |
| status | `pending` / `viewed` / `accepted` / `rejected` / `ignored` | no |  |
| feedback | string or null | no |  |

Responses: 200, 403, 404, 422 Validation, 401 Authentication

### DELETE `/recommendations/{id}`

Accessible by: Admin only.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 404, 403, 401 Authentication

### PATCH `/recommendations/{id}/status`

Accessible by: Students only (for their own recommendations).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| status | `viewed` / `accepted` / `rejected` / `ignored` | yes |  |
| feedback | string or null | no |  |

Responses: 200, 403, 404, 422 Validation, 401 Authentication

## Older simulation endpoints

These come from the earlier simulator. The current Simulations page uses the [Investment simulator](#investment-simulator) endpoints (`/investments/...`).

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/simulations` | Student or admin | Display a listing of simulations |
| POST | `/simulations` | Student | Store a newly created simulation |
| GET | `/simulations/my-statistics` | Student | Get simulation statistics for the authenticated student |
| POST | `/simulations/preview` | Logged in | Preview a simulation without saving it |
| GET | `/simulations/{id}` | Student or admin | Display the specified simulation |
| PUT | `/simulations/{id}` | Student | Update the specified simulation |
| PATCH | `/simulations/{id}` | Student | Update the specified simulation |
| DELETE | `/simulations/{id}` | Logged in | Remove the specified simulation |

### GET `/simulations`

Admin: View all simulations (READ only) Student: View only their own simulations.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| per_page | query | string | no |  |

Responses: 200, 401 Authentication

### POST `/simulations`

Accessible by: Students only (only for themselves).

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| principal | number (min 0.01, max 1e+09) | yes |  |
| interest_rate | number (min 0, max 100) | yes |  |
| time_period | integer (min 1, max 600) | yes |  |
| calculation_type | `simple` / `compound` | no | Max 50 years (600 months) |

Responses: 201, 403, 422 Validation, 401 Authentication

### GET `/simulations/my-statistics`

Accessible by: Students only.

Responses: 200, 403, 401 Authentication

### POST `/simulations/preview`

Accessible by: All authenticated users.

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| principal | number (min 0.01, max 1e+09) | yes |  |
| interest_rate | number (min 0, max 100) | yes |  |
| time_period | integer (min 1, max 600) | yes |  |
| calculation_type | `simple` / `compound` | no |  |

Responses: 200, 422 Validation, 401 Authentication

### GET `/simulations/{id}`

Admin: View any simulation (READ only) Student: View only their own simulation.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 403, 404, 401 Authentication

### PUT `/simulations/{id}`

Accessible by: Students only (only their own simulations).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| principal | number (min 0.01, max 1e+09) | no |  |
| interest_rate | number (min 0, max 100) | no |  |
| time_period | integer (min 1, max 600) | no |  |
| calculation_type | `simple` / `compound` | no |  |

Responses: 200, 403, 404, 422 Validation, 401 Authentication

### PATCH `/simulations/{id}`

Accessible by: Students only (only their own simulations).

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Body (`application/json`):

| Field | Type | Required | Notes |
|---|---|---|---|
| principal | number (min 0.01, max 1e+09) | no |  |
| interest_rate | number (min 0, max 100) | no |  |
| time_period | integer (min 1, max 600) | no |  |
| calculation_type | `simple` / `compound` | no |  |

Responses: 200, 403, 404, 422 Validation, 401 Authentication

### DELETE `/simulations/{id}`

Admin: Can delete any simulation Student: Can delete only their own simulation.

| Parameter | In | Type | Required | Notes |
|---|---|---|---|---|
| id | path | string | yes |  |

Responses: 200, 403, 404, 401 Authentication

