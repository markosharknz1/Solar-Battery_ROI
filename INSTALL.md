# How to install Solar & Battery Advisor

This guide assumes you have **never installed anything from GitHub before**.
Follow it top to bottom and you'll have the app running in about 3 minutes.

**What you need:**
- A Windows computer (Windows 10 or 11)
- An internet connection (only for the download - the app itself never uses one)
- A GitHub sign-in that has access to this project (see Step 2)

You do **not** need to install anything else first. There is **no installer
and no .exe of ours to run** - so no SmartScreen "unrecognized app" warnings.
The download contains the app's files plus the official Node.js runtime
(signed by the OpenJS Foundation); the app window itself is the Microsoft
Edge already on your computer, running in app mode.

---

## Step 1 - Open the download page

On the computer where you want the app, open any web browser and go to:

```
https://github.com/markosharknz1/Solar-Battery_ROI/releases/latest
```

## Step 2 - Sign in to GitHub if it asks

Because this project is private, GitHub may show a **Sign in** page, or a
page saying **404 - not found** (that's GitHub's way of hiding private
projects from people who aren't signed in). Sign in with an account that
has access to this project, then open the address again.

## Step 3 - Download the ZIP

Under the **Assets** heading, click the file named like:

```
Solar-Battery-Advisor-v1.5.0.zip
```

(Not "Source code (zip)" - that's for programmers and won't run.)

## Step 4 - Unblock the ZIP (one click, do it BEFORE extracting)

In your Downloads folder, **right-click** the ZIP file, choose
**Properties**, tick **Unblock** at the bottom, and click **OK**.

Why: Windows tags internet downloads with a hidden marker. Unblocking the
ZIP before extracting means every file inside comes out clean, so even PCs
with the strictest Windows security setting (Smart App Control) will run it.
If you don't see an Unblock box, there's nothing to do - carry on.

## Step 5 - Extract it

Right-click the ZIP and choose **Extract All...**. Extract it anywhere you
like - your Documents, `C:\Apps`, a folder on the desktop. The extracted
`Solar & Battery Advisor` folder IS the app; there is nothing more to install.

## Step 6 - Start the app

Open the extracted folder and double-click:

```
Solar & Battery Advisor.cmd
```

A small black window flashes for a moment, then the app opens in its own
window. That's it.

**Tip:** right-click the `.cmd` file → **Send to → Desktop (create shortcut)**
for a desktop icon.

---

## Where your data lives

Everything you save (tariff plans, battery quotes, VPP programs, household
settings) is stored in a folder called `.edge-app-profile` that appears next
to the app after first run. **It never leaves your computer.**

- **To upgrade:** download a newer ZIP and extract it over the same folder
  (keep `.edge-app-profile`). Your data survives.
- **To move the app:** move the whole folder. Data moves with it.
- **To uninstall:** delete the folder. That's everything - nothing else is
  written anywhere on the computer.

## Installing on a computer without internet

Download the ZIP on any computer (Steps 1-4, including Unblock), copy it to
a USB stick, and do Steps 5-6 on the target computer. Let the copy finish
completely before ejecting the stick.

## If something goes wrong

- **"needs Node.js" message:** the `node\` folder is missing - you probably
  copied the `.cmd` file out by itself. Copy the whole extracted folder.
- **Nothing happens at all:** look for a `launcher-error.txt` file next to
  the `.cmd` - it says what failed.
- Still stuck? Send a screenshot of whatever you see.

---

## For developers (building from source)

Everything below needs Node.js and is **not** required to use the app.

```
npm install
npm run dev            # hot-reload dev server
npm run build          # production build to dist\
powershell -File build-zip.ps1   # build the release ZIP (downloads + verifies the official Node runtime)
```

To publish a new version: bump `"version"` in `package.json`, update
`RELEASE_NOTES.md`, commit and push, then push a matching tag - GitHub
Actions builds the ZIP, scans it on VirusTotal, and publishes the release:

```
git tag -a v<version> -m v<version> && git push origin v<version>
```

The legacy Electron installer tooling (`electron/`, `build-installer.ps1`,
`install.bat`) still exists but releases ship the ZIP - an unsigned Setup
.exe trips SmartScreen, which is exactly what the ZIP design avoids.
