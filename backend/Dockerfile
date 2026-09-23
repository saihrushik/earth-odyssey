# Earth Odyssey — Python RAG backend
#
# Build from the REPO ROOT (the corpus lives in knowledge-base/, outside backend/):
#   docker build -f backend/Dockerfile -t earth-odyssey-backend .
#   docker run -p 8000:8000 --env-file backend/.env earth-odyssey-backend
#
# The image bakes the vector index at build time, so the container starts ready
# to answer instead of downloading the embedding model on the first request.

FROM python:3.12-slim

WORKDIR /app

# Dependencies first: this layer stays cached until requirements.txt changes.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/data ./data
COPY knowledge-base ./knowledge-base

# Build the index now: downloads the ONNX embedding model and writes ChromaDB.
ENV KNOWLEDGE_BASE_DIR=/app/knowledge-base
RUN python -m app.rag.ingest

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
