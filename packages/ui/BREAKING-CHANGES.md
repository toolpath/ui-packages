# @toolpath/ui — deferred breaking changes

Changes we have decided to make to `@toolpath/ui` but have deliberately **not** made yet, because
each one breaks it and we would rather land them together in one major than spend a major on each.
This is a ledger of deferred work, not a changelog: it shrinks as entries are taken.

**Read this before adding a `major` Changeset for `@toolpath/ui`.** Taking one entry is the moment
to take them all. **Add an entry whenever you work around a break instead of taking it**, and name
the code that holds the workaround.

---

## Queued for 2.0.0

### `Menu.Trigger`: be the button, not a wrapper around it

Deferred 2026-11-10.

**What.** Outside a context menu, `Menu.Trigger` renders a `div`, makes it the menu's trigger, and
puts what it is given inside. It should be the button itself, as Base UI's own trigger is, with
`render` for a kit `Button` or `IconButton`.

**Why.** Given a button as its child, the `div` takes the trigger's `role="button"`,
`aria-haspopup` and `aria-expanded`, and the button inside, which is the one that takes focus, has
none of them: a screen reader announces a plain button, not a menu. The `render` form avoids this
and the README's Menus section documents it, but the wrapper is the default, so the child form keeps
being written.

**Where the workaround lives.** The non-context branch of `src/menu/trigger.tsx` (its `div` render
and `nativeButton={false}`). `ToolDock`'s group menus sidestep it with Base UI's trigger
(`src/tool-dock/group-menu.tsx`). The README's Tool dock example still shows the child form.

**Taking it.** Drop the `div` render and `nativeButton={false}` from that branch, keeping the
click's `stopPropagation`; leave the context-menu branch, which rightly wraps an area. Move the
README's Tool dock example to `render`.

**Migration.** `<Menu.Trigger><Button>…</Button></Menu.Trigger>` becomes
`<Menu.Trigger render={<Button>…</Button>} />`. Left as it is, it would be a button inside a button,
which HTML does not allow. Text or an icon as the child keeps working. Classes on `Menu.Trigger`
that style a child through the wrapper (`[&>button]:w-full`) move to the button.
