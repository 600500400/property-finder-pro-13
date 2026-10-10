# AI analysis dialog regression fixture

Run from the repository root:

```sh
bun x vite --config tests/browser/vite.config.mts --host 127.0.0.1 --port 4180 --strictPort
```

Open http://127.0.0.1:4180/ and click **AI analýza**.

The fixture renders the real `AIAnalysisButton` and application stylesheet inside
an overflow-hidden listing link with the production hover transform. A new
listing object is passed every second to reproduce list refreshes. AI, account
and router services are mocked; no credit is consumed and no account is changed.
The delayed error message is deliberate and allows checking both loading and
finished states.

Verify that the dialog remains centered outside the listing, fits a narrow
viewport, and closes using the cross, Escape or the backdrop. Closing while
loading must not reopen it when the response arrives. Keyboard focus returns to
the original AI button.

Automated coverage: `bun run test -- tests/ai-dialog.test.ts` also checks that
refreshes do not repeat the request and consuming a free sample does not unmount
the open result. This fixture is development-only, not a production route.
