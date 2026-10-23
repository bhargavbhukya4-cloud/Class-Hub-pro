# CLASS HUB (Supabase + Vercel)

Files: `index.html` (the app), `shim.js` (connects it to Supabase), `config.js` (your keys), `schema.sql` (database + privacy rules).

## 1. Supabase
1. supabase.com -> New project (set a database password).
2. SQL Editor -> New query -> paste all of `schema.sql` -> Run. (If it only complains that the realtime table is already added, everything else already ran; ignore it.)
3. Project Settings -> API: copy the **Project URL** and the **anon public key**.
4. Authentication -> Sign In / Providers: turn ON **Allow anonymous sign-ins**. There is no login screen; each browser gets a private anonymous account automatically.

## 2. Keys
Open `config.js`, replace the two placeholder values with the values from step 1.3, save.

## 3. GitHub
New repository `class-hub` -> Add file -> Upload files -> drag in all the files -> Commit.

## 4. Vercel
Add New -> Project -> import `class-hub` -> Framework: Other -> Deploy. You get a link like `class-hub.vercel.app`.

## 5. Connect login to your link
Supabase -> Authentication -> URL Configuration: set **Site URL** to your Vercel link and add it under **Redirect URLs**. Open the link, sign in, and create your first class.
