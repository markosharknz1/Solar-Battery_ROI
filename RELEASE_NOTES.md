## What's new

First release built and published by GitHub Actions. The app is unchanged
from 1.5.0 (the no-installer ZIP edition) - what's new is how the download
is produced and what you can verify about it:

- The ZIP is built on GitHub's own servers straight from the tagged source,
  with the workflow run, commit, and SHA-256 checksums linked in every
  release.
- Every release ZIP is automatically scanned by VirusTotal, with the scan
  report linked below.
