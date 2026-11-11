# pi-permission-system

Permissions management for the `pi` coding agent.

Roughly based on [MasuRii/pi-permission-system](https://github.com/MasuRii/pi-permission-system).


## Permissions Overview

A permission can be one of the following:

```jsonc
"allow"  // allows the action
"auto"   // uses an AI classifier to choose between allow and ask
"ask"    // asks the user for permission
"deny"   // automatically denies the action
```

Ask states the purpose of the request and gives the following options:

```
Allow Once
Allow Always
Reject
```

"Reject" stops the current agent task and asks the user what to do next.

"Allow always" is persisted for the session only. It uses an AI-generated command wildcard for `bash` and an exact match for other tools.

## Configuration

The supported top-level keys are: `default`, `tools`, `bash`, `external_directory`, and `settings`.

`bash` body matching supports wildcard:
- `*` matches any sequence and `?` matches one character
- `\*` and `\?` are match literal `*` and `?`

`tools` matches exact tool names.

The builtin path tools in pi are: `read`, `write`, `edit`, `find`, `grep`, `ls`. `external_directory` overrides the settings for these path tools. The primary use is to override `write` and `edit` to a stronger policy for external directories.

`settings` holds optional non-permission settings.

### Rule Precedence

More specific rules override less specific rules:

- `tools.*` overrides `default`
- `bash.*` overrides `tools.bash`
- Within `bash`, the last match wins

### Global Configuration

Located in `~/.pi/agent/pi-permissions.jsonc`.

Example:

```jsonc
{
    "default": "ask",
    "tools": {
        "read": "allow",
        "write": "allow",
        "edit": "allow",
        "find": "allow",
        "grep": "allow",
        "ls": "allow",
        "bash": "ask",

        // add any non builtin tools
        "mcp": "ask"
    },
    "bash": {
        "git status*": "allow",
        "git log*": "allow",
        "git diff*": "allow",
        "git branch*": "allow",
        "git show*": "allow",

        "ls*": "allow",
        "pwd": "allow",
        "find*": "allow",
        "tree*": "allow",
        "cat*": "allow",
        "head*": "allow",
        "tail*": "allow",
        "wc*": "allow",
        "echo*": "allow",
        "sed*": "allow",

        "grep*": "allow",
        "rg*": "allow"
    },
    "external_directory": {
        "write": "ask",
        "edit": "ask"
    }
}
```

### Local Configuration

Located in the local Pi config folder:

`<project-root>/.pi/pi-permissions.jsonc`

Local configuration overrides global configuration, including `deny` rules.

### Optional Settings

```jsonc
{
    "settings": {
        "ai_model": "provider/model-id",
        "auto_allow_criteria": "read-only or easily reversible"  // (default criteria)
    }
}
```

## "Allow Always" Matching

Matching is done as `(tool, body)`.

Body content:

- For built-in path tools, it is the path
- For bash, it is the command
- For other tools, it is a stable JSON serialization of the full input

Body matching rules:

- For non-bash, it is exact match
- Bash supports wildcard matching

## Bash Matching Safeguards

Bash matching safeguards against unsafe shell syntax.

Sequences separated by `;`, `&&`, `||`, or newlines are split and each segment is matched against `bash` rules. The strictest result wins (`deny` > `ask` > `auto` > `allow`).

If a command contains other chaining (`|`, `&`, command/process substitution, or parentheses), `bash` pattern rules for `allow` are skipped, allowing other segments to take priority and successively falling back to `tools.bash` and `default`.

"Allow always" for complex sequences saves the exact command, not a wildcard.
