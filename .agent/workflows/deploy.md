---
description: Deploy MeetingManager to production server
---

# Deploy to Production

// turbo-all

## Prerequisites
- SSH access to mm.sharetrack.org as `meetingmanager` user
- GitHub repo is public: https://github.com/ajandersen2/MeetingManager

## Steps

1. Commit and push your changes to GitHub:
```bash
git add -A && git commit -m "Your commit message" && git push
```

2. Deploy to production server:
```bash
ssh meetingmanager@mm.sharetrack.org "cd ~/MeetingManager && git pull && npm install && npm run build && pm2 restart meeting-manager"
```

## Quick Deploy (One Command)
Run this from the project directory:
```bash
git add -A && git commit -m "Update" && git push && ssh meetingmanager@mm.sharetrack.org "cd ~/MeetingManager && git pull && npm install && npm run build && pm2 restart meeting-manager"
```
