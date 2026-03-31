# Run Scripts

These scripts start/stop the 3 project components.

## Start everything (background + logs)

```bash
./scripts/start-all.sh
```

## Watch logs

```bash
./scripts/logs.sh
./scripts/logs.sh backend
./scripts/logs.sh frontend
```

## Check status

```bash
./scripts/status.sh
```

## Stop everything

```bash
./scripts/stop-all.sh
```

## Manual run in 3 Cursor terminals

Terminal 1 (project root):

```bash
docker compose up -d
```

Terminal 2 (backend):

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
# alternative:
# python main.py
```

Terminal 3 (frontend):

```bash
cd frontend
npm run dev
```

## Notes

- Scripts assume they are run from this repository, but you can override root:

```bash
PROJECT_DIR=~/project ./scripts/start-all.sh
```

- On Linux/WSL/Git Bash, make executable once:

```bash
chmod +x scripts/*.sh
```
