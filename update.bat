@echo off
echo ===================================
echo Abu Updater
echo ===================================
echo.

REM Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Git is not installed or not in PATH.
    echo Please install Git from https://git-scm.com/downloads
    echo.
    pause
    exit /b 1
)

echo Checking for updates from https://github.com/safder2000/abu_05.git
echo.

REM Check if .git directory exists
if not exist .git (
    echo Initializing git repository...
    git init
    git remote add origin https://github.com/safder2000/abu_05.git
    echo.
)

REM Save current branch name
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set CURRENT_BRANCH=%%a

REM Check if we're on main/master branch, if not switch to it
if not "%CURRENT_BRANCH%"=="main" (
    if not "%CURRENT_BRANCH%"=="master" (
        echo Switching to main branch...
        git checkout main 2>nul || git checkout master
        echo.
    )
)

REM Stash any local changes
echo Saving your local changes...
git stash

REM Pull the latest changes
echo Pulling latest updates...
git pull origin main || git pull origin master

REM Pop the stashed changes
echo Restoring your local changes...
git stash pop

REM Install any new dependencies
echo Checking for new dependencies...
call npm install

echo.
echo Update completed!
echo.
pause
