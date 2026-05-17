# content — agent notes

## YAML data authoring

Numeric-looking decoy/real strings (e.g. `'99'`, `'4242'`) must be quoted in YAML — bare `99` parses as a number and fails the Zod schema with "Expected string, received number".
