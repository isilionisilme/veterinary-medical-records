# PR Commenting (Required)

After a code review, publish the review output as a PR comment (or update an existing "AI Code Review" comment).
The comment must use the mandatory structure from `docs/agent_router/01_WORKFLOW/CODE_REVIEW/00_entry.md` without reordering headings.

## Blocking execution sequence
1) Resolve PR reference.
	- Use explicit PR id when provided.
	- If only branch context exists, resolve PR from branch.
2) Publish review comment to PR.
3) Return the published PR comment URL in the assistant response.

Review completion rule:
- The review is not complete until the PR comment is posted and the URL is returned.

For `frontend/**` or user-visible changes, the PR comment must include the explicit `UX/Brand Compliance` section with both subsections:
- `Compliant`
- `Non-compliant / risk`

If one or more review findings are addressed in subsequent commits, publish a brief follow-up PR comment describing which points were addressed.
- This follow-up must be published automatically as part of the remediation workflow (do not wait for a separate user prompt).
- Return the follow-up PR comment URL in the assistant response.

If you cannot post a PR comment (missing PR reference, missing auth, etc.), STOP and ask.
