# Restormel Integration: Keys Catalog Sync

## Overview
This document outlines the synchronization of keys catalog between Restormel and the Sophia project model index API.

## Index vs Global Catalog
- **Index Catalog:** The index catalog is accessed via `GET …/projects/{id}/models`. It utilizes the `restormelListProjectModels()` function for ingestion pickers and recommendations. The parsing now supports `data.bindings` and top-level `bindings`, in addition to the legacy `models` arrays.
- **Global Catalog:** The global catalog can be accessed using `GET …/models` via the `restormelListGlobalDashboardModels()` function. This does not require a project ID and provides the full tenant catalog.

## Key Changes
- Bindings with `enabled: false` are excluded from merged picker entries, ensuring that soft-disabled models do not appear in the admin UX.
- New mutations have been added for project model management: `restormelAddProjectModelBindings`, `restormelReplaceProjectModelAllowlist`, `restormelPatchProjectModelBinding`, and `restormelDeleteProjectModelBinding`. These are designed for server-side operations and future automation without requiring a new browser dashboard.

## Recommendations
- Update the integrator and OpenAPI description to reflect that the stable JSON shape for the index is `data.bindings`, which will help clients transition away from using the legacy `?source=catalog` parameter.
- Include error handling for `project_models_validation_failed` in the public integrator guide to assist automated callers.

## Conclusion
This document serves as a guide for understanding the synchronization process and the changes made during the Sophia handover. For further details, please refer to the respective API documentation.