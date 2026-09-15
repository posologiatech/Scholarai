FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# datamind_scan.py is sent in with the code the browser generates, so the server does
# not strictly need it on disk — it is copied so an operator debugging on the box has
# the same module the browser is running.
COPY server.py datamind_stats.py datamind_scan.py ./

RUN useradd --create-home --uid 1000 runner
USER runner

EXPOSE 8500

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8500"]
