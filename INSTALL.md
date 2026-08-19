# How to install Solar & Battery Advisor

This guide assumes you have **never installed anything from GitHub before**.
Follow it top to bottom and you'll have the app running in about 5 minutes.

**What you need:**
- A Windows computer (Windows 10 or 11 - any normal PC or laptop from the last ~10 years)
- An internet connection
- A GitHub sign-in that has access to this project (see Step 2 - or skip
  internet entirely and use [the USB method](#installing-on-a-computer-without-internet))

You do **not** need to install anything else first. No technical tools, no
"Node.js", nothing. The installer file contains the entire app.

---

## Step 1 - Open the download page

On the computer where you want the app, open any web browser (Edge, Chrome,
Firefox) and go to this address:

```
https://github.com/markosharknz1/Solar-Battery_ROI/releases/latest
```

## Step 2 - Sign in to GitHub if it asks

Because this project is private, GitHub may show a **Sign in** page, or a
page saying **404 - not found** (that's GitHub's way of hiding private
projects from people who aren't signed in).

- Click **Sign in** (top-right corner of the page) and log in with the GitHub
  account that owns or has access to this project.
- After signing in, go to the address from Step 1 again.

> Installing for a friend or family member who has no GitHub account? Don't
> create one for them - use the [USB method](#installing-on-a-computer-without-internet)
> below instead.

## Step 3 - Download the installer

You are now on a page titled **Solar & Battery Advisor** with a version number
(for example 1.0.1).

1. Scroll down to the heading **Assets**. If you see a small arrow next to
   "Assets", click it to expand the list.
2. Click the file whose name ends in **`.exe`** - it looks like:
   **`Solar.Battery.Advisor.Setup.1.0.1.exe`**
3. The download starts (it's about 100 MB, so give it a minute).
   - Ignore the other files listed there ("Source code (zip)" etc.) - those
     are for programmers, not for installing.

Your browser saves the file in your **Downloads** folder. Some browsers show
the download at the top-right of the window; you can click it from there too.

> If your browser itself shows a message like "this file isn't commonly
> downloaded" or "make sure you trust it", choose **Keep** (in Edge you may
> need to click **⋯ → Keep → Show more → Keep anyway**). This warning appears
> simply because the file is new and not from a big software company.

## Step 4 - Run the installer

1. Open your **Downloads** folder (press the Windows key, type `Downloads`,
   press Enter - or click the download in your browser).
2. Double-click **`Solar.Battery.Advisor.Setup.1.0.1.exe`**.
3. A blue box appears saying **"Windows protected your PC"**. This is
   expected - Windows shows it for any program that isn't from a registered
   big company. To continue:
   - Click the small **More info** link in that blue box.
   - A **Run anyway** button appears at the bottom - click it.
4. If Windows asks **"Do you want to allow this app to make changes to your
   device?"**, click **Yes**.
5. The setup wizard opens:
   - Choose **"Only for me"** or **"Anyone who uses this computer"** if asked -
     either is fine.
   - Accept the suggested install folder (or pick another - it doesn't matter,
     the app works from anywhere).
   - Click **Install**, wait for the bar to finish, then click **Finish**.

## Step 5 - Open the app

You'll find **Solar & Battery Advisor**:
- as an icon on your **desktop**, and
- in the **Start Menu** (press the Windows key and type `Solar`).

That's it. The app runs entirely on your computer - it doesn't send your data
anywhere.

---

## Installing on a computer without internet

The installer is one single file, so you can carry it across on a USB stick:

1. On any computer that *can* reach the download page, do Steps 1-3 above.
2. Copy the downloaded `.exe` file from the **Downloads** folder onto a USB
   stick.
3. Plug the USB stick into the other computer, copy the file onto it (e.g.
   onto the Desktop), and continue from **Step 4**.

Nothing else needs to be copied - just that one file.

---

## Updating to a newer version

Exactly the same as installing: download the newer `.exe` from the same page
and run it. It installs over the top. Your saved settings (tariff plans,
bills, and any data you chose to keep on the device) are kept.

## Uninstalling

1. Press the Windows key and type `add or remove programs`, press Enter.
2. Find **Solar & Battery Advisor** in the list.
3. Click it (Windows 10) or the **⋯** next to it (Windows 11) and choose
   **Uninstall**.

---

## If something goes wrong

**The download page says 404 or "not found"**
You aren't signed in to GitHub, or the account you used doesn't have access to
this project. Sign in with the right account (Step 2) and try again.

**"Windows protected your PC" and I can't see a Run anyway button**
Click the **More info** link first - the button only appears after that.

**I downloaded a file called `Solar-Battery_ROI-main.zip` and there's no app in it**
That's the project's *source code*, not the app - it's what programmers use to
build the app, and the scripts inside need developer tools to work. Go back to
Step 1 and download the file ending in **`.exe`** from the **Assets** list
instead.

**An error mentions `tsc`, `npm`, or `node` "is not recognized"**
Same cause as above - you're running the programmer build scripts from the
source code ZIP. You don't need them. Use the `.exe` from Step 3.

**The installer won't start at all**
The app needs a 64-bit version of Windows (virtually every PC since ~2010).
Very old 32-bit machines can't run it.

---

## For developers only - building from source

Everything below this line requires [Node.js](https://nodejs.org) 18+ and is
**not needed to install or use the app**.

```
git clone https://github.com/markosharknz1/Solar-Battery_ROI.git
cd Solar-Battery_ROI
```

Then run **`build-and-install.bat`** - on first run it installs dependencies
automatically (a few minutes; the `npm warn deprecated` messages are harmless),
builds the web app, packages the Windows installer to
`release\Solar & Battery Advisor Setup <version>.exe`, and installs it silently
on this machine.

To publish a new version to the download page used in Step 1: bump `"version"`
in `package.json`, build, then:

```
gh release create v<version> "release/Solar & Battery Advisor Setup <version>.exe" --title "Solar & Battery Advisor <version>"
```

Other scripts: `install.vbs` silently installs whatever is already in
`release\` with no window at all (double-click it - a small popup confirms
when done); `install.bat` does the same but in a console window; `npm run dev`
starts the hot-reload dev server; `npm run preview` serves the built app in
a browser.

If the build fails with `EPERM ... rename win-unpacked`: antivirus or indexing
briefly locked freshly extracted files - the script already builds via a temp
folder to dodge this; re-run, and if it persists add an antivirus exclusion for
the project folder.
