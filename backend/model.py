
# from sentence_transformers import SentenceTransformer
# import os, shutil

# model_name = "sentence-transformers/msmarco-distilbert-base-v4"
# target_dir = "models/sentence-transformers/msmarco-distilbert-base-v4"

# # Download model (HF cache)
# model = SentenceTransformer(model_name)

# # Copy from cache to models folder
# src = model._model_card_data.base_model_path if hasattr(model, "_model_card_data") else model._first_module().auto_model.base_model_prefix

# # Safer: use model.save()
# os.makedirs(target_dir, exist_ok=True)
# model.save(target_dir)

# print("Model saved to:", target_dir)



# from sentence_transformers import CrossEncoder
# import os

# model_name = "cross-encoder/ms-marco-MiniLM-L-6-v2"
# target_dir = "models/cross-encoder/ms-marco-MiniLM-L-6-v2"

# os.makedirs(target_dir, exist_ok=True)

# model = CrossEncoder(model_name)
# model.save(target_dir)

# print("CrossEncoder saved to:", target_dir)
