# Naming conventions

## Git and delivery workflow

- **Branches**
  - User stories:
    - `feature/<ID>-<short-representative-slug>`
    - The slug must be concise and describe the purpose of the user story.
  - Technical non-user-facing work (refactors, chores, CI, docs, fixes):
    - `refactor/<short-slug>`
    - `chore/<short-slug>`
    - `ci/<short-slug>`
    - `docs/<short-slug>`
    - `fix/<short-slug>`
  - Branches must be short-lived and focused on a single user story or a single technical concern.

- **Commits**
  - User stories:
    - `Story <ID>: <short imperative description>`
  - Technical work:
    - `<type>: <short imperative description>`
    - Allowed types:
      - `refactor`
      - `chore`
      - `ci`
      - `docs`
      - `test`
      - `build`
      - `fix`
  - Commit messages must be clear, specific, and written in imperative form.
  - Each commit should represent a coherent logical step.

- **Pull Requests**
  - User stories:
    - `Story <ID> — <Full User Story Title>`
  - Technical work:
    - `<type>: <short description>`
  - Each Pull Request must relate to:
    - exactly one user story, or
    - exactly one technical concern.
  - Pull Requests must remain small enough to be reviewed comfortably in isolation.

## API and endpoints

- Use clear, predictable REST conventions, for example:
  - `POST /documents/upload`
  - `GET /documents/{id}`
  - `GET /documents/{id}/download`
  - `GET /documents/{id}/text`
  - `PUT /documents/{id}/structured-data`

## Domain concepts and models

- Use explicit, domain-oriented names for core concepts, such as:
  - `Document`
  - `ProcessingStatus`
  - `ExtractedText`
  - `StructuredMedicalRecord`
  - `FieldEvidence`
  - `RecordRevision`

## Lifecycle states

- Lifecycle states must be enums using **UPPERCASE_SNAKE_CASE**, for example:
  - `UPLOADED`
  - `TEXT_EXTRACTED`
  - `STRUCTURED`
  - `READY_FOR_REVIEW`

## Persistence artifacts

- Use consistent, descriptive table names, such as:
  - `documents`
  - `document_status_history`
  - `document_text_artifacts`
  - `document_structured_artifacts`
  - `field_evidence`

# Way of Working 

You are implementing work for this initiative and must strictly follow the Way of Working described below.

If an implementation conflicts with any of these rules, stop and explain the conflict instead of proceeding.
