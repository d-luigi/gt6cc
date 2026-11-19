# GTA VI Cheat Directory

This local fan site uses the fork’s animated frontend and a Python server with SQLite comments. It lists 61 cheats and 19 reported codes.

## Run locally

From the project folder, run:

    python server.py

Open [the local directory](http://127.0.0.1:8787/). Comments are saved in comments.sqlite3. To use an existing comment database, pass its path with --db.

## Edit and rebuild the frontend

Run these PowerShell commands from the project folder. Node.js and npm are required to rebuild.

    Set-Location frontend
    npm.cmd ci
    npm.cmd test
    npm.cmd run build
    Copy-Item -LiteralPath 'dist/index.html','dist/app.js','dist/details.css' -Destination '..' -Force

Reload the site after rebuilding.
