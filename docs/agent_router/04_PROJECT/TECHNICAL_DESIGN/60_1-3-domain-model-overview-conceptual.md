# 1.3 Domain Model Overview (Conceptual)

The system is built around a small set of explicit, persistent domain concepts.  
All relevant domain concepts must be persisted to support auditability, traceability, and human-in-the-loop workflows.

Core concepts (conceptual overview):
- **Document**: submitted medical document with identity, metadata, lifecycle state, and raw file reference.
- **ProcessingRun / ProcessingStatus**: explicit lifecycle states representing progress through the pipeline.
- **ExtractedText**: extracted text with provenance and diagnostics.
- **StructuredMedicalRecord / InterpretationVersion**: schema-validated structured medical data.
- **FieldEvidence**: lightweight links between structured fields and their source (page/snippet).
- **RecordRevisions / FieldChangeLog**: append-only records of human edits.

This section provides conceptual orientation only.  
Authoritative contracts and invariants are defined in **Appendix A and Appendix B**.

---
