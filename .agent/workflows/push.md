---
description: Commit all changes and push to GitHub (auto-deploys via webhook)
---

# Push to GitHub

// turbo-all

1. Add and commit all changes:
```bash
cd /Users/anthonyandersen/Documents/Antigravity/MeetingManager && git add -A && git commit -m "Update"
```

2. Push to GitHub (webhook will auto-deploy):
```bash
git push
```

Note: The GitHub webhook automatically deploys to mm.sharetrack.org when you push.
