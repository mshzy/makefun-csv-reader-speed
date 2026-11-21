# makefun-csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/mshzy/makefun-csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/mshzy/makefun-csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in for csv-reader 1.0.0: reads broken CSV files exactly as the reference does, at a fraction of its CPU time. `solve.js` answers every case with the same `{columns, rows, errors}` the reference returns — BOM, stray CRs, unterminated quotes, quote junk, short and long rows included — while scanning with `indexOf` and cutting fields out with `slice` instead of walking one character at a time.

## Run it

```sh
MAKEFUN_INPUT_DIR=<input-dir> MAKEFUN_OUTPUT_DIR=<output-dir> node main.ts
```

The harness runs `node /bot/main.ts` (node22): it reads every case from `<input-dir>/cases.json`, answers each one alone with `run()` from `solve.js`, and writes `<output-dir>/answers.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=6zyyg0qj&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
