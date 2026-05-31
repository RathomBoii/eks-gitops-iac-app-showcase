import os

from fastapi import FastAPI, Request

app = FastAPI()

# Injected by Kubernetes via secretKeyRef (synced from AWS Secrets Manager
# by the CSI Secrets Store driver). Falls back to None if not set.
API_KEY = os.environ.get("API_KEY")


@app.get("/")
def read_root():
    return {"message": "Hello from Kubernetes"}


@app.get("/health")
def read_health():
    return {"message": "Service is healthy"}


@app.get("/secret-check")
def secret_check():
    """Returns whether the API key is loaded — never expose the actual value."""
    return {"api_key_loaded": API_KEY is not None}

@app.get("/secret-value")
def secret_value(request: Request):
    """Returns the actual API key value — for testing only, not for production."""
    # In a real app, you'd want more robust access control than just IP allowlisting.
    secret_key = request.query_params.get("secret_key")
    secret_value = os.environ.get(secret_key)
    client_ip = request.client.host

    if secret_key:
        return {"client_ip": client_ip, "secret_key": secret_key, "secret_value": secret_value }
    else:
        return {"client_ip": client_ip, "error": f"secret key: {secret_key} not found in environment variables"}

    



