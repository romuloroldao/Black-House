npm warn exec The following package was not found and will be installed: supabase@2.72.0
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'bin-links@6.0.0',
npm warn EBADENGINE   required: { node: '^20.17.0 || >=22.9.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'cmd-shim@8.0.0',
npm warn EBADENGINE   required: { node: '^20.17.0 || >=22.9.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'npm-normalize-package-bin@5.0.0',
npm warn EBADENGINE   required: { node: '^20.17.0 || >=22.9.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'proc-log@6.1.0',
npm warn EBADENGINE   required: { node: '^20.17.0 || >=22.9.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'read-cmd-shim@6.0.0',
npm warn EBADENGINE   required: { node: '^20.17.0 || >=22.9.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'write-file-atomic@7.0.0',
npm warn EBADENGINE   required: { node: '^20.17.0 || >=22.9.0' },
npm warn EBADENGINE   current: { node: 'v18.20.8', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
Usage:
  supabase db dump [flags]

Flags:
      --data-only         Dumps only data records.
      --db-url string     Dumps from the database specified by the connection string (must be percent-encoded).
      --dry-run           Prints the pg_dump script that would be executed.
  -x, --exclude strings   List of schema.tables to exclude from data-only dump.
  -f, --file string       File path to save the dumped contents.
  -h, --help              help for dump
      --keep-comments     Keeps commented lines from pg_dump output.
      --linked            Dumps from the linked project. (default true)
      --local             Dumps from the local database.
  -p, --password string   Password to your remote Postgres database.
      --role-only         Dumps only cluster roles.
  -s, --schema strings    Comma separated list of schema to include.
      --use-copy          Use copy statements in place of inserts.

Global Flags:
      --create-ticket                                  create a support ticket for any CLI error
      --debug                                          output debug logs to stderr
      --dns-resolver [ native | https ]                lookup domain names using the specified resolver (default native)
      --experimental                                   enable experimental features
      --network-id string                              use the specified docker network instead of a generated one
  -o, --output [ env | pretty | json | toml | yaml ]   output format of status variables (default pretty)
      --profile string                                 use a specific profile for connecting to Supabase API (default "supabase")
      --workdir string                                 path to a Supabase project directory
      --yes                                            answer yes to all prompts

unknown flag: --project-ref
Try rerunning the command with --debug to troubleshoot the error.
