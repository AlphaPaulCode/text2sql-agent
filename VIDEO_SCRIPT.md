# Solution video script (target: under 5 minutes)

0:00-0:40 - The problem
- "Every small company has a human query bottleneck: the analyst."
- Show the question "Who is our best customer?" going unanswered in a chat.
- One slide: non-technical staff can't self-serve; raw DB access is dangerous;
  naive LLM SQL fails invisibly.

0:40-1:20 - The baseline
- Show `npm run eval:baseline` output (pre-recorded is fine).
- Point at one failure: a query that RAN but answered the wrong question.
- "It executed" is the new "it compiles."

1:20-3:00 - One realistic execution, start to finish
- Run: npm run ask -- "Who is our best customer?"
- Walk the printed trajectory line by line:
  writer draft -> executor result -> critic verdict (-> repair if it happens).
- Show the final output: SQL displayed for verification, result table, cost.
- Call out safety: read-only handle + SELECT-only guard; a write is impossible.

3:00-4:00 - The comparison and the changelog
- Show the metric table: baseline vs agent execution accuracy, valid-SQL rate,
  cost per task.
- Walk the changelog: which iteration moved the number and which didn't.
- Highlight the biggest contributor (expected: the semantic critic) and one
  experiment you removed (fill in from your actual iteration - the brief asks
  for this explicitly).

4:00-4:40 - Hot take
- Dominant failure mode: valid SQL, wrong answer.
- Lesson: split verification by failure class - mechanical (does it run) vs
  semantic (does it answer the question) - and make the semantic check an
  independent role, not a line in the writer's prompt.

4:40-5:00 - Close
- Reproduce in 3 commands: npm install / npm test / npm run eval:agent.
- "A real person can use this today; a skeptical judge can re-run every number."
