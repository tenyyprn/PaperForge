"""Database utilities for PaperForge"""

from api.db.firestore import get_firestore_client, FirestoreClient
from api.db.vectors import get_vector_client, VectorSearchClient

__all__ = [
    "get_firestore_client",
    "FirestoreClient",
    "get_vector_client",
    "VectorSearchClient",
]
