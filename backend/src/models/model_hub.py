import os
import threading
import torch
from sentence_transformers import SentenceTransformer, CrossEncoder


class ModelHub:
    _lock = threading.Lock()

    _biencoder = None
    _cross_encoder = None
    _device = None
    _matcher_encoder = None

    # ------------------------
    # Paths
    # ------------------------
    @classmethod
    def _backend_root(cls):
        return os.getenv(
            "BACKEND_ROOT",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
        )

    @classmethod
    def _local_st_path(cls):
        return os.path.join(
            cls._backend_root(),
            "models",
            "sentence-transformers",
            "msmarco-distilbert-base-v4",
        )

    @classmethod
    def _local_ce_path(cls):
        return os.path.join(
            cls._backend_root(),
            "models",
            "cross-encoder",
            "ms-marco-MiniLM-L-6-v2",
        )
    @classmethod
    def _local_matcher_path(cls):
        return os.path.join(
            cls._backend_root(),
            "models",
            "sentence-transformers",
            "all-MiniLM-L6-v2",
        )

    # ------------------------
    # Device (decided once)
    # ------------------------
    @classmethod
    def _get_device(cls):
        if cls._device is None:
            forced = os.getenv("MODEL_DEVICE")
            if forced in ("cpu", "cuda"):
                cls._device = forced
            else:
                cls._device = "cpu"
        try:
            n = int(os.getenv("TORCH_NUM_THREADS", "2"))
            if n > 0:
                torch.set_num_threads(n)
        except Exception:
            pass
        return cls._device

    # ------------------------
    # Public API
    # ------------------------
    @classmethod
    def get_biencoder(cls):
        if cls._biencoder is not None:
            return cls._biencoder

        with cls._lock:
            if cls._biencoder is not None:
                return cls._biencoder

            local_path = cls._local_st_path()
            src = local_path if os.path.isdir(local_path) else \
                "sentence-transformers/msmarco-distilbert-base-v4"

            cls._biencoder = SentenceTransformer(
                src,
                device=cls._get_device()
            )
            try:
                cls._biencoder.eval()
            except Exception:
                pass
            return cls._biencoder

    @classmethod
    def get_cross_encoder(cls, device: str | None = None):
        if cls._cross_encoder is not None:
            return cls._cross_encoder
        with cls._lock:
            if cls._cross_encoder is not None:
                return cls._cross_encoder
            local_path = cls._local_ce_path()
            src = local_path if os.path.isdir(local_path) else \
                "cross-encoder/ms-marco-MiniLM-L-6-v2"
            dev = device if device in ("cpu", "cuda") else cls._get_device()
            cls._cross_encoder = CrossEncoder(src, device=dev)
            try:
                cls._cross_encoder.model.eval()
            except Exception:
                pass
            return cls._cross_encoder

    @classmethod
    def get_matcher_encoder(cls):
        if cls._matcher_encoder is not None:
            return cls._matcher_encoder

        with cls._lock:
            if cls._matcher_encoder is not None:
                return cls._matcher_encoder

            local_path = cls._local_matcher_path()
            src = local_path if os.path.isdir(local_path) else \
                "sentence-transformers/all-MiniLM-L6-v2"

            cls._matcher_encoder = SentenceTransformer(
                src,
                device="cpu"
            )
            try:
                cls._matcher_encoder.eval()
            except Exception:
                pass
            return cls._matcher_encoder
