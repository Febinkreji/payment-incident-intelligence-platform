# Deploying the Frontend to Vercel

The frontend (`frontend/`) is a static Vite build — no server-side rendering, so a standard Vercel static/SPA deployment works.

## 1. Create the project

1. Push this repository to GitHub (see the root [README](../README.md) for the local Git steps).
2. In the [Vercel dashboard](https://vercel.com/new), click **Add New → Project** and import the repository.
3. When prompted for the project settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
   - **Install Command:** `npm install` (default)

## 2. Environment variables

Add these under **Project Settings → Environment Variables** (Production, and Preview if you want preview deploys to work too):

| Variable | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | from Firebase web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | from Firebase web app config |
| `VITE_FIREBASE_PROJECT_ID` | from Firebase web app config |
| `VITE_FIREBASE_STORAGE_BUCKET` | from Firebase web app config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | from Firebase web app config |
| `VITE_FIREBASE_APP_ID` | from Firebase web app config |
| `VITE_API_BASE_URL` | your deployed Render backend URL, e.g. `https://pip-backend.onrender.com` |

Vite only exposes variables prefixed `VITE_` to the client bundle — this matches the existing `frontend/.env.example`.

## 3. Client-side routing

This app uses `react-router-dom` with browser history routing (`/incidents/:id`, `/analytics`, etc.). `frontend/vercel.json` includes an explicit catch-all rewrite to `/index.html`, so deep links and refreshes on non-root routes work regardless of framework auto-detection.

## 4. Firebase Authentication — authorized domains

In the Firebase console: **Authentication → Settings → Authorized domains**, add your Vercel domain (e.g. `pip-app.vercel.app` and any custom domain). Without this, `signInWithEmailAndPassword` — and Google Sign-In's `signInWithPopup` — will fail on the deployed site even though it works locally. Google Sign-In additionally requires the **Google** provider to be enabled once under **Authentication → Sign-in method**.

## 5. Deploy

Click **Deploy**. Subsequent pushes to the connected branch redeploy automatically.

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| Blank page / 404 on `/incidents/INC-000001` after a hard refresh | SPA rewrite not applied | Confirm the Vite framework preset is selected, or add a rewrite to `index.html` |
| Requests to the backend fail with a network error | `VITE_API_BASE_URL` unset or wrong | Set it to the exact Render URL, no trailing slash |
| Requests blocked by CORS | Backend `CORS_ORIGINS` doesn't include the Vercel URL | Set `CORS_ORIGINS` on Render to include your Vercel domain(s), see [deploy-render.md](deploy-render.md) |
| "Firebase Authentication is not configured" banner on the login page | One or more `VITE_FIREBASE_*` vars missing | Re-check all six Firebase env vars are set in Vercel and redeploy |
| `auth/unauthorized-domain` error on sign-in | Vercel domain not authorized in Firebase | Add the domain under Authentication → Settings → Authorized domains |
