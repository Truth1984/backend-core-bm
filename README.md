utils, baremetal

## config

env -> overwrite -> secret file -> overwrite -> initial config -> overwrite -> default config

## procedure

-> require

`const { Framework } = require("backend-core-bm");`

-> configure settings

`let fw = new Framework(settings);`

-> further manual setup

`fw.listen();`

-> assign tasks for each section

`fw.perform("process" | "post-process" | "pre-terminate",()=>{})`

-> start

`fw.run()`

## running sequence

-> sys - initialization

-> user -> perform["process"]

-> sys - configure middleware

-> user -> perform["post-process"]

-> sys - listenOnPort

-> user -> perform["pre-terminate"] (only run once before app terminates)
