FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

COPY packages/python /app/packages/python
COPY apps/api /app/apps/api

RUN pip install --no-cache-dir -e /app/packages/python/cliparr_core \
    && pip install --no-cache-dir -r /app/apps/api/requirements.txt

RUN useradd -m -u 10001 cliparr
USER cliparr

WORKDIR /app/apps/api

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
