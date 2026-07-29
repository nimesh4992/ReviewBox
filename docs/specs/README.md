# Feature specs — the definition of done

**The gap this closes.** The repo has plenty of documents describing what was
*built*. It had none stating what "working" *means* for a feature, in terms
that can be checked. So "done" meant "the code exists and CI is green" — and
the Mumbai One bug was, by that definition, done for months while delivering
nothing to the customer.

A spec here is not documentation. It is **the acceptance test written in
English**, and it is the contract the tester/QA agent verifies against.

## Rules

1. **One page per feature. If it doesn't fit on a page, it's two features.**
2. Every criterion is **Given / When / Then**, observable by the founder in
   the product — not by reading code.
3. Every criterion names **how it is verified**: a unit test, the store probe,
   or a manual step in the PR test plan. A criterion nobody can check is a
   wish, not a criterion.
4. At least one criterion must use a **real fixture app** from
   `docs/PRODUCT_CONTEXT.md`, including the region-locked one. Features that
   only work for a US app are not done.
5. Include **"Done does NOT mean"** — the boundary that stops scope creep and
   stops us claiming more than we deliver.
6. When behaviour changes, the spec changes **in the same PR**. A stale spec
   is worse than none because agents trust it.

## Write a spec when

- Starting a feature that touches more than one file, **or**
- Fixing a bug that revealed we never agreed what correct was (most of ours).

Skip it for copy tweaks, styling, and dependency bumps.

## How agents use these

| Agent | Uses the spec to… |
|---|---|
| pm | decide whether an item is ready to build, and rank it |
| architect | check the approach can satisfy every criterion |
| coder | know when to stop |
| tester | write the tests — criteria map 1:1 to test names |
| reviewer | reject a PR that claims done without meeting criteria |
| triager | tell a bug from a missing feature |

Start with `review-sync.md` as the model.
