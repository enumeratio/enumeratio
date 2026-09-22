// Shell completion scripts for `notatio completion <shell>`. Static — the
// subcommands, flags, forms, and syntaxes are finite — so the script is plain
// text the user evals into their shell rc. Browser-safe (strings only).

import { FORMS, SYNTAXES } from "./engine.ts";

export const SHELLS = ["bash", "zsh", "fish"] as const;
export type Shell = (typeof SHELLS)[number];

export const SUBCOMMANDS = ["eval", "convert", "forms", "formats", "serve", "completion"] as const;

export const FLAGS = [
  "-f",
  "--form",
  "-i",
  "--in",
  "-c",
  "-N",
  "--numeric",
  "-p",
  "--precision",
  "--env",
  "--json",
  "-h",
  "--help",
  "-V",
  "--version",
];

const words = (xs: readonly string[]) => xs.join(" ");

export function completionScript(shell: Shell): string {
  switch (shell) {
    case "bash":
      return `# bash completion for notatio -- eval "$(notatio completion bash)"
_notatio() {
  local cur prev
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  case "$prev" in
    -f|--form) COMPREPLY=( $(compgen -W "${words(FORMS)}" -- "$cur") ); return ;;
    -i|--in) COMPREPLY=( $(compgen -W "${words(SYNTAXES)}" -- "$cur") ); return ;;
    completion) COMPREPLY=( $(compgen -W "${words(SHELLS)}" -- "$cur") ); return ;;
    --port|-p|--precision|-c) return ;;
  esac
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${words(SUBCOMMANDS)} ${words(FLAGS)}" -- "$cur") )
  else
    COMPREPLY=( $(compgen -W "${words(FLAGS)}" -- "$cur") )
  fi
}
complete -F _notatio notatio
`;
    case "zsh":
      return `#compdef notatio
# zsh completion for notatio -- eval "$(notatio completion zsh)"
_notatio() {
  local -a subcommands forms syntaxes
  subcommands=(${words(SUBCOMMANDS)})
  forms=(${words(FORMS)})
  syntaxes=(${words(SYNTAXES)})
  _arguments -s \\
    '(-f --form)'{-f,--form}'[output form]:form:(\${forms})' \\
    '(-i --in)'{-i,--in}'[input syntax]:syntax:(\${syntaxes})' \\
    '-c[expression]:expr:' \\
    '(-N --numeric)'{-N,--numeric}'[numeric approximation]' \\
    '(-p --precision)'{-p,--precision}'[significant digits]:digits:' \\
    '--json[structured JSON output]' \\
    '(-h --help)'{-h,--help}'[show help]' \\
    '(-V --version)'{-V,--version}'[show version]' \\
    '1:subcommand or expression:(\${subcommands})' \\
    '*::expr:'
}
compdef _notatio notatio
`;
    case "fish":
      return `# fish completion for notatio -- notatio completion fish | source
complete -c notatio -f
complete -c notatio -n '__fish_use_subcommand' -a '${words(SUBCOMMANDS)}'
complete -c notatio -n '__fish_seen_subcommand_from completion' -a '${words(SHELLS)}'
complete -c notatio -s f -l form -x -a '${words(FORMS)}' -d 'output form'
complete -c notatio -s i -l in -x -a '${words(SYNTAXES)}' -d 'input syntax'
complete -c notatio -s c -x -d 'expression'
complete -c notatio -s N -l numeric -d 'numeric approximation'
complete -c notatio -s p -l precision -x -d 'significant digits'
complete -c notatio -l json -d 'structured JSON output'
complete -c notatio -s h -l help -d 'show help'
complete -c notatio -s V -l version -d 'show version'
`;
  }
}
