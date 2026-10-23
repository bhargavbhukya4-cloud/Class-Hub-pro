# CLASS HUB (Supabase + Vercel)

Files: `index.html` (the app), `shim.js` (connects it to Supabase), `config.js` (your keys), `schema.sql` (database + privacy rules).

## 1. Supabase
1. supabase.com -> New project (set a database password).
2. SQL Editor -> New query -> paste all of `schema.sql` -> Run. (If it says the realtime table is already added, ignore that line.)
3. Project Settings -> API: copy the **Project URL** and the **anon public key**.
4. Authentication -> Providers: Email is on by default. For a 6-digit code instead of a link, open Authentication -> Email Templates -> Magic Link and add `{{ .Token }}` to the text. For Google: turn on Google and paste a Client ID/Secret from Google Cloud Console (OAuth client, Web). Its redirect URL is shown on that Supabase page.

## 2. Keys
Open `config.js`, replace the two placeholder values with the values from step 1.3, save.

## 3. GitHub
New repository `class-hub` -> Add file -> Upload files -> drag in all 5 files -> Commit.

## 4. Vercel
Add New -> Project -> import `class-hub` -> Framework: Other -> Deploy. You get a link like `class-hub.vercel.app`.

## 5. Connect login to your link
Supabase -> Authentication -> URL Configuration: set **Site URL** to your Vercel link and add it under **Redirect URLs**. Open the link, sign in, and create your first class.
