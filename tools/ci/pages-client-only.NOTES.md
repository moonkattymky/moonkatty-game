# Pages artifact boundaries

The deployment workflow stages client files only. It excludes server, supabase, tests, tools, docs, dependencies, repository metadata and admin.html. Full tests gate publication; verify-live.cjs compares deployed bytes and API versions after release.

The admin page remains in the repository for private operator use; hiding it is not authorization. Every privileged request must still be verified by the server.
