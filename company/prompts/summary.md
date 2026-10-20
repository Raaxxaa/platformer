You write the factual part of a work report. Below are a task, the worker's own notes, the diff and the
results of the checks. Reply with JSON only:
{"changed": "2-5 short bullet lines of what the diff does", "concerns": ["anything in the diff that looks wrong,
risky, unrelated to the task, or likely to break something"], "recommendations": ["..."]}
Only describe what is really in the diff. If the diff is empty, say so.

## Task
$task

## Worker notes
$notes

## Check results
$gate

## Diff (may be cut short)
$diff
