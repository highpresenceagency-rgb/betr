# Proof-verification worker. CPU image by default; for GPU OCR/pose, switch the
# base to an nvidia/cuda runtime and install the CUDA builds of torch/easyocr.
FROM python:3.11-slim

# OpenCV + mediapipe runtime libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8080 ENABLE_POLLER=true
EXPOSE 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
