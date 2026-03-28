# Golf Charity Subscription Platform

This repo is scaffolded from the PRD in `PRD Full Stack Training.pdf` as a deployable split app:

- `frontend/`: `HTML + CSS + JavaScript`
- `backend/`: `Node.js + Express`

## Implemented scope

- Public homepage with featured charities, plans, draw explanation, and CTA flows
- Subscriber auth, profile, subscription settings, score management, winnings, and proof upload
- Admin dashboard for summary stats, user/subscription management, charity creation, draw simulation/publish, and winner verification
- Rolling 5-score logic with Stableford validation
- Prize pool logic for 5/4/3-match tiers plus jackpot rollover handling
- Razorpay subscription activation with backend payment verification
- Separate Vercel deployment configuration for frontend and backend

## Demo credentials

- Subscriber: `player@golfcharity.app` / `player123`
- Admin: `admin@golfcharity.app` / `admin123`

## Local run

### Backend

1. Copy [backend/.env.example](/c:/Users/romit/Desktop/Desktop/golf%20dh/backend/.env.example) to `backend/.env`
2. Set `MONGODB_URI` to your MongoDB connection string
3. In `backend/`, install packages with `npm install`
4. Run `npm run dev`

### Frontend

1. Open [frontend/js/config.js](/c:/Users/romit/Desktop/Desktop/golf%20dh/frontend/js/config.js) and confirm the backend URL
2. Serve `frontend/` with any static server, or deploy it directly on Vercel

## Vercel deployment

Deploy as two separate Vercel projects:

1. Backend project root: `backend/`
2. Frontend project root: `frontend/`

### Backend environment variables

- `JWT_SECRET`
- `FRONTEND_URL`
- `MONGODB_URI`
- `ADMIN_SETUP_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

### Frontend configuration

- Update `apiBaseUrl` in [frontend/js/config.js](/c:/Users/romit/Desktop/Desktop/golf%20dh/frontend/js/config.js) to your deployed backend URL, for example `https://your-backend-project.vercel.app/api`

## MongoDB notes

- The backend now uses MongoDB through Mongoose.
- On first startup, the backend seeds demo charities, users, and one published draw if the database is empty.
- Demo credentials remain:
  - `player@golfcharity.app` / `player123`
  - `admin@golfcharity.app` / `admin123`

## Notes and assumptions

- The PRD does not define exact pricing, so the scaffold uses `$29 monthly` and `$299 yearly`.
- Passwords are still plain-text in this training build. Before production, add hashing with `bcrypt`.
- Subscriber accounts start in `pending` status and become active after successful Razorpay verification.
- If secrets were ever committed or pasted publicly, rotate them in the provider dashboards before production use.
