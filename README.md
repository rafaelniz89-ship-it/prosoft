# ProSoft - SaaS Platform

A software licensing and distribution platform where you control user accounts, run limits, and software updates.

## Features

- **User Authentication** - Customers login to access your software
- **Run Tracking** - Each software use deducts from their run balance
- **Admin Panel** - Manage users, set runs, cancel accounts, upload new software
- **Software Hosting** - Host HTML/JS web apps for customers to use in browser

## Admin Login

- **Username:** admin
- **Password:** admin123

## Deploy to Railway

### Step 1: Push to GitHub

1. Go to: https://github.com/new
2. Repository name: `prosoft`
3. Click "Create repository"
4. In terminal, run these commands:

```bash
cd /Users/rt/Documents/SoftwarePlatform
git init
git add .
git commit -m "ProSoft platform"
git branch -M main
git remote add origin https://github.com/rafaelniz89-ship-it/prosoft.git
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to: https://railway.app
2. Login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `prosoft` repository
5. Click "Add Plugin" → "PostgreSQL"
6. In Variables, add:
   - `DATABASE_URL` = (from PostgreSQL plugin)
   - `SESSION_SECRET` = any-random-string-12345

7. Click "Deploy"

### Step 3: Access Your Platform

Once deployed, Railway gives you a URL like:
`https://prosoft.up.railway.app`

Your admin panel: `/admin.html`

## Adding New Software

1. Login to admin panel
2. Go to "Upload / Update Software" section
3. Select your .html file
4. File appears in customer dashboard

## Default Credentials

- **Admin:** admin / admin123
- **Customer accounts:** Created by admin in admin panel

## Structure

```
prosoft/
├── server.js          # Node.js server (Express)
├── package.json       # Dependencies
├── public/
│   ├── css/
│   │   └── style.css  # Styling
│   ├── software/      # Your software files
│   │   ├── Bank_File_Builder.html
│   │   └── Insurance_Reconciliation.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   └── admin.html
```

## Notes

- The platform uses PostgreSQL database (free on Railway)
- Sessions stored server-side
- Run tracking is per-user
- Users with 0 runs cannot use software
- Admin can add/edit/delete users and runs
