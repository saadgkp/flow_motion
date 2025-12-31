# 🚀 GitHub Pages Deployment Guide

## Quick Setup (5 minutes)

### Step 1: Create a New GitHub Repository

1. Go to https://github.com/new
2. Repository name: `flowmotion` (or `flowmotion-app`)
3. Description: "FlowMotion - Create mathematical animations without code"
4. **Make it PUBLIC** (required for free GitHub Pages)
5. **DO NOT** initialize with README (we already have one)
6. Click "Create repository"

### Step 2: Push Your Frontend Folder

Open Command Prompt or Git Bash in the `frontend` folder and run:

```bash
cd C:\Users\moham\Claude_Ecosystem\flow_motion\frontend

git init
git add .
git commit -m "Initial commit - FlowMotion frontend"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/flowmotion.git
git push -u origin main
```

**Replace `YOUR-USERNAME` with your actual GitHub username!**

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top right)
3. Scroll to **Pages** section (left sidebar)
4. Under "Source":
   - Select **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
5. Click **Save**

### Step 4: Wait & Access

- GitHub will build your site (takes 1-2 minutes)
- Your site will be live at: `https://YOUR-USERNAME.github.io/flowmotion/`
- Visit the URL and test your app!

---

## 🔒 Security Features

✅ **Users Can Only**:
- Interact with the UI
- Create scenes and export JSON
- Use the frontend interface

❌ **Users CANNOT**:
- Access your source code directly (only minified/compiled versions)
- See your backend
- Modify the application

**Note**: HTML/CSS/JS is always visible in browser DevTools, but users need technical knowledge to understand it.

---

## 🎨 Custom Domain (Optional)

Want `flowmotion.yourdomain.com` instead of `username.github.io`?

1. Buy a domain (Namecheap, Google Domains, etc.)
2. Add a `CNAME` file in your frontend folder:
   ```
   flowmotion.yourdomain.com
   ```
3. In your domain provider, add DNS records:
   - Type: CNAME
   - Name: flowmotion
   - Value: YOUR-USERNAME.github.io
4. In GitHub Settings > Pages, enter your custom domain

---

## 📝 Update Your Site

Whenever you make changes:

```bash
cd C:\Users\moham\Claude_Ecosystem\flow_motion\frontend
git add .
git commit -m "Update: [describe your changes]"
git push
```

GitHub Pages auto-updates in 1-2 minutes!

---

## ⚡ Alternative: Vercel Deployment

Vercel is faster and easier than GitHub Pages:

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   cd C:\Users\moham\Claude_Ecosystem\flow_motion\frontend
   vercel
   ```

3. Follow prompts, get instant live URL!

**Vercel Advantages**:
- Instant deployments (no waiting)
- Better performance
- Free SSL certificate
- Custom domain setup is easier

---

## 🐛 Troubleshooting

**Issue**: Site shows 404 error
- **Fix**: Wait 2-3 minutes, GitHub needs time to build

**Issue**: CSS/JS not loading
- **Fix**: Check file paths in `index.html` are relative (`style.css`, NOT `/style.css`)

**Issue**: Fonts not loading
- **Fix**: Check internet connection, Google Fonts CDN must be accessible

**Issue**: Changes not reflecting
- **Fix**: Hard refresh (Ctrl + Shift + R) or wait 2 minutes

---

## 📊 Current File Structure

```
frontend/
├── index.html      ✅ Main app
├── style.css       ✅ Styling
├── app.js          ✅ Logic
├── README.md       ✅ Documentation
└── .gitignore      ✅ Ignore rules
```

All set for deployment! 🎉

---

**Need help?** Open an issue on GitHub or contact support.
