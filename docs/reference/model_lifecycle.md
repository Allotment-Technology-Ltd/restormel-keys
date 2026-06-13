# Model Lifecycle in Restormel Keys

## Overview
Restormel Keys aims to provide a clear understanding of the lifecycle of models used within its ecosystem. This document outlines the different states a model can be in and how they are represented in the catalog and APIs.

## Lifecycle States
Models can exist in the following states:
- **Active**: The model is currently supported and operational.
- **Deprecated**: The model is no longer recommended for use but may still function. A deprecation date will be provided.
- **Retired**: The model is no longer operational and should not be used. A retirement date will be provided.

## API Representation
To facilitate the understanding of model lifecycles, the following fields will be included in the model entries:
- `lifecycle_state`: Indicates the current state of the model (active, deprecated, retired).
- `deprecated_at`: The date when the model was deprecated.
- `retirement_at`: The date when the model was retired.
- `recommended_replacement_model_id`: An optional field that suggests a replacement model if applicable.

## Documentation and Updates
The lifecycle information will be updated regularly to reflect the current status of models. Users can expect this information to be accurate and timely, ensuring that they can make informed decisions when selecting models for use.

## Conclusion
By implementing these changes, Restormel Keys will provide a more robust and user-friendly experience for operators and integrators, reducing the risk of runtime failures due to outdated model references.