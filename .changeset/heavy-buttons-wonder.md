---
'@toolpath/ui': patch
---

Draw a sortable `Table.HeaderCell`'s sort control instead of taking the table
library's, which wrapped the whole header cell in a `<button>` — so a control
in the heading, such as the filter funnel a `Table.HeaderCellContent`
`accessory` carries, was a button inside a button: invalid HTML, and a
hydration error in React 19. The heading is the button now, the accessory is
its sibling, and the button's `::after` still covers the cell so a press
anywhere in it sorts.
