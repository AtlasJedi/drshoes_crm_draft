---
task_id: <e.g. 0b-3>
plan: docs/superpowers/plans/<plan-file>.md
milestone: <e.g. 0B>
agent: sonnet
start_utc: <ISO-8601>
end_utc: <ISO-8601>
status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
commit_sha: <git short sha>
---

# Task <id> — <short title>

## Files changed
- `path/one.java` (new, X LOC)
- `path/two.yaml` (modified)

## Commands run
```
mvn -B -pl app -am test -Dtest=Foo  # exit 0
```

## Test summary
- Tests run: N, Failures: 0, Errors: 0, Skipped: 0
- Coverage: <only if measured>

## Decisions / deviations from plan
- (none) OR
- Spec said X. Used Y because Z.

## Logging / metadata wired
- Service `FooService` logs at INFO: `op=fooBar actor={} entityId={} outcome={}`
- Module `lib/foo.ts` exports `log = createLogger("foo")`

## Concerns
- (none) OR
- ...

## Next action
- Move to task `<next-id>` per plan.
