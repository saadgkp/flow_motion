@echo off
echo ========================================
echo FlowMotion - GitHub Pages Deployment
echo ========================================
echo.

REM Check if Git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed!
    echo Please install Git from: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo [1/4] Checking for existing Git repository...
if not exist .git (
    echo [!] Initializing new Git repository...
    git init
    git branch -M main
)

echo.
echo [2/4] Enter your GitHub username:
set /p GITHUB_USER="> "

echo.
echo [3/4] Enter your repository name (e.g., flowmotion):
set /p REPO_NAME="> "

echo.
echo [4/4] Adding and committing files...
git add .
git commit -m "Deploy FlowMotion frontend"

echo.
echo Setting remote repository...
git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git

echo.
echo Pushing to GitHub...
git push -u origin main --force

echo.
echo ========================================
echo ✅ Deployment Complete!
echo ========================================
echo.
echo Your site will be live in 1-2 minutes at:
echo https://%GITHUB_USER%.github.io/%REPO_NAME%/
echo.
echo Next steps:
echo 1. Go to: https://github.com/%GITHUB_USER%/%REPO_NAME%/settings/pages
echo 2. Under "Source", select "main" branch and "/" folder
echo 3. Click Save
echo.
pause
