

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check for updates if git is available
where git >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Checking for updates...
    
    REM Check if we have a git repository
    if exist .git (
        REM Get current commit hash
        for /f "tokens=*" %%a in ('git rev-parse HEAD') do set LOCAL_HASH=%%a
        
        REM Fetch from remote without merging
        git fetch origin
        
        REM Get remote commit hash
        for /f "tokens=*" %%a in ('git rev-parse origin/main 2^>nul') do set REMOTE_HASH=%%a
        if "%REMOTE_HASH%"=="" (
            for /f "tokens=*" %%a in ('git rev-parse origin/master 2^>nul') do set REMOTE_HASH=%%a
        )
        
        REM Compare hashes
        if not "%LOCAL_HASH%"=="%REMOTE_HASH%" (
            echo.
            echo Updates are available!
            echo.
            choice /C YN /M "Do you want to update now"
            if %ERRORLEVEL% EQU 1 (
                call update.bat
            ) else (
                echo Continuing without updating...
            )
        ) else (
            echo You have the latest version.
        )
    ) else (
        echo Not a git repository. Skipping update check.
    )
)

echo.
echo Starting Abu Bot...
echo.
echo Press Ctrl+C to stop the bot.
echo.

REM Run the bot
node index.js

echo.
echo Bot has stopped.
echo.
pause
