from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet


def derive_fernet_key(raw_key: str) -> bytes:
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_secret(raw_key: str, plaintext: str) -> str:
    return Fernet(derive_fernet_key(raw_key)).encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(raw_key: str, ciphertext: str) -> str:
    return Fernet(derive_fernet_key(raw_key)).decrypt(ciphertext.encode("utf-8")).decode("utf-8")
