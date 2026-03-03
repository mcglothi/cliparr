FROM mcr.microsoft.com/playwright/python:v1.51.0-jammy

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY packages/python /app/packages/python
COPY apps/worker /app/apps/worker

RUN pip install --no-cache-dir -e /app/packages/python/cliparr_core \
    && pip install --no-cache-dir -r /app/apps/worker/requirements.txt

RUN useradd -m -u 10001 cliparr
USER cliparr

WORKDIR /app/apps/worker

CMD ["python", "-m", "app.main"]
