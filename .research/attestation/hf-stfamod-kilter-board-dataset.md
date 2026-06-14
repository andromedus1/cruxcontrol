---
source_handle: hf-stfamod-kilter-board-dataset
fetched: 2026-06-13
source_url: https://huggingface.co/datasets/stfamod/Kilter-Board-Dataset/blob/main/README.md
provenance: source-direct
---

# stfamod/Kilter-Board-Dataset (HuggingFace dataset)

## Summary
A Kilter Board dataset built for sequence-to-sequence route *generation* (genclimb project),
not grade prediction. Each sample is a source-target pair where the source encodes
[Board, Difficulty] and the target is the [Frames] (hold sequence). Ships tokenizer
vocabulary mappings (token_to_id / id_to_token). MIT licensed. README does not state total
sample count.

## Verbatim key passages
- Format: "Source: [Board, Difficulty], Target: [Frames]"
- Example: source "[1270, 1239]" -> target hold IDs "[42, 1194, 156, 1194...]"
- Filters: "Minimum Ascensionists: 5", "Board Layouts: Kilter Board Original and Kilter Board
  Homewall", "Quality Rating: Greater than 2.6", "Frames Count: 1"
- Tokenization: "token_to_id" and "id_to_token" for "efficient encoding and decoding of the
  climbing sequences"
- Purpose: "designed for training machine learning models, particularly those focused on
  generating or analyzing climbing routes", "suitable for sequence-to-sequence models"
- License: MIT
- Demo: https://genclimb.pages.dev/

## Notes for downstream use
- Conditioning direction is generation-oriented: difficulty -> holds. For grade *prediction*
  (holds -> difficulty) the pairs would need to be inverted/repurposed.
- Stricter quality/ascensionist filters than Vilin97 (>=5 ascensionists, quality >2.6) yield a
  cleaner but smaller corpus.
- The tokenized frame representation is a ready-made sequence encoding reusable by sequence
  models — overlaps deep-representation-models sibling facet.
