# ReviewBox Help Center

Mintlify-powered documentation hosted at `help.tryreviewbox.com`.

## Pages

- `index.mdx` — landing page with card grid
- `getting-started.mdx` — first-run walkthrough
- `connect-google-play.mdx` — Google Play credential setup
- `ai-replies.mdx` — AI pipeline + tone + KB + templates
- `faq.mdx` — pricing, security, support questions
- `mint.json` — Mintlify config (nav, colors, analytics)

## Local preview

```bash
npm i -g mintlify
cd help
mintlify dev
```

Mintlify will open `http://localhost:3000` (use a different port if your
app is running there: `mintlify dev --port 3333`).

## Deploy

1. Push this `help/` folder to its own GitHub repo (or keep it here and
   point Mintlify at the subdirectory)
2. Connect the repo in the [Mintlify dashboard](https://dashboard.mintlify.com)
3. Add a CNAME for `help.tryreviewbox.com` pointing to
   `cname.mintlify.app`
4. Mintlify provisions the SSL cert automatically

## Editing

- All pages are MDX — you can use React-flavored components like `<Card>`,
  `<Steps>`, `<AccordionGroup>` (already used in the FAQ page)
- Internal links use leading slashes: `/connect-google-play`
- Code blocks support syntax highlighting via fenced triple-backticks with
  a language hint
- The PostHog snippet in `mint.json` mirrors the app's analytics key, so
  page views in help docs are tracked alongside app events

## Style guide

- Plain language. Aim for an 8th-grade reading level
- Short paragraphs. One idea per paragraph
- Always link to a next step at the bottom of each page
- Use `<Note>` for clarifications, `<Tip>` for shortcuts, `<Warning>` for
  permission/security callouts
