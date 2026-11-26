## What's new

Reliability release - fixes the "could not start" / blank "can't reach this
page" errors some launches hit:

- The app window now keeps the local server alive itself (a tiny heartbeat
  from the page), instead of the launcher guessing from browser process
  behaviour. Edge sometimes hands the window between its own processes -
  especially the very first launch on a new computer - and that guesswork
  could shut the server down while the window was still open, leaving
  "127.0.0.1 refused to connect". The server now stops about a minute after
  the last app window actually closes, no matter which browser process owns
  it.
- If the app genuinely can't start, it now opens a plain-English explanation
  in Notepad instead of writing a silent file nobody sees.
- Running "Solar & Battery Advisor.cmd" from inside the ZIP (without
  extracting) or as a copied-out file now explains exactly what to do,
  instead of failing confusingly.
- Launching the app while it's still starting up can no longer land on a
  second port, which made saved plans look like they'd vanished.
- The legacy Electron desktop build gained a single-instance guard and a
  readable error dialog (double-clicking it repeatedly used to crash with a
  raw "JavaScript error" once its ports ran out).
