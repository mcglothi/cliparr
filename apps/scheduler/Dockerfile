FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/scheduler /app/apps/scheduler

RUN pip install --no-cache-dir -r /app/apps/scheduler/requirements.txt

RUN useradd -m -u 10001 cliparr
USER cliparr

CMD ["python", "-m", "app.main"]
