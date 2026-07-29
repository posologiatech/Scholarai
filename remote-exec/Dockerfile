FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

RUN useradd --create-home --uid 1000 runner
USER runner

EXPOSE 8500

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8500"]
