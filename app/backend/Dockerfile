# Build context must be the repo root (config.py resolves BASE_DIR as
# three parents up from this file, i.e. it expects the repo layout intact).
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY app/backend/requirements.txt app/backend/requirements.txt
RUN pip install --no-cache-dir -r app/backend/requirements.txt

COPY app/backend/ app/backend/

WORKDIR /repo/app/backend

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
