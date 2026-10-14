import os

# Test-only secrets. Never use these values anywhere real.
os.environ.setdefault("STATEMENT_HASH_KEY", "test-hash-key-not-secret")
os.environ.setdefault("INTERNAL_API_TOKEN", "test-token-0123456789")
