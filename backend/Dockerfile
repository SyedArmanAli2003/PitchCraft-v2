# PitchCraft backend — InsForge Compute (Fly.io) / Cloud Run compatible image.
#
# InsForge Compute deployment:
#   npx @insforge/cli compute deploy backend/ --name pitchcraft-api
#
# The app entrypoint is index.py. InsForge Compute and Cloud Run both inject
# $PORT at runtime (8080 by default). Fly.io also injects $PORT.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source (mongodb.py is intentionally removed — insforge.py replaces it).
COPY . .

# Port: InsForge Compute, Cloud Run, and Fly.io all inject $PORT (default 8080).
ENV PORT=8080
EXPOSE 8080

CMD exec uvicorn index:app --host 0.0.0.0 --port ${PORT}
