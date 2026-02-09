# 3. Structural Signals & Pending Review

Some human actions carry **system-level meaning** beyond a single document.

These actions generate **structural signals**.

## 3.1 Definition

A structural signal represents a **repeated, semantically similar correction**
observed across multiple documents under comparable conditions.

Structural signals:
- are accumulated over time,
- are evaluated in aggregate,
- never trigger automatic system changes.

They exist to support **deliberate, informed human governance**.

---

## 3.2 Pending Review State

Structural signals may enter a `pending_review` state when they indicate a
potential need for system-level intervention.

Rules:
- `pending_review` is an **internal system state**.
- It never blocks or alters veterinary workflows.
- It never affects previously processed documents.
- It never triggers implicit reprocessing.

Pending review exists solely to surface **candidates for human review**.

---

## 3.3 Scope of Impact

Any decision derived from structural signals:
- applies **prospectively only**,
- never modifies past interpretations,
- never silently alters system behavior.

The system must remain explainable at all times.

---
