# ScholarAI

## Project info

Vite + React + TypeScript app with a Supabase backend (database, auth, and edge functions in `supabase/`).

## How can I edit this code?

Clone the repo and work locally with your own IDE.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository.
git clone https://github.com/posologiatech/Scholarai.git

# Step 2: Navigate to the project directory.
cd Scholarai

# Step 3: Install the necessary dependencies.
npm install

# Step 4: Copy the env template and fill in your Supabase credentials.
cp .env.example .env

# Step 5: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase

## How can I deploy this project?

This project is deployed on [Cloudflare Pages](https://pages.cloudflare.com/), connected directly to this GitHub repository. Every push to `main` triggers an automatic build and deploy.

Build settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables (Production and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`

To deploy manually via CLI instead:

```sh
npm run build
npx wrangler pages deploy dist
```
