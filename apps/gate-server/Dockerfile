FROM python:3.12-slim

WORKDIR /app

# Install git, curl, and download wireproxy (bypasses the need for /dev/net/tun which Railway blocks)
RUN apt-get update && apt-get install -y git curl && \
    curl -L https://github.com/windtf/wireproxy/releases/download/v1.1.2/wireproxy_linux_amd64.tar.gz | tar xz && \
    mv wireproxy /usr/local/bin/ && \
    chmod +x /usr/local/bin/wireproxy && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway will execute start.sh based on railway.json
CMD ["bash", "start.sh"]
