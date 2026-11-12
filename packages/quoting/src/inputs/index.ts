/**
 * `@toolpath/quoting/inputs` — the inputs a part is planned from beside its constraints: the stock
 * it is cut from (`stock`) and the tool libraries it draws its tools from (`tool-crib`). How the
 * stock is sent to Toolpath (`stockRequest`) and how it sits on the model (`stockPlacement`) are
 * here too, so the estimate, profile and plan pages read one set of rules, and why Toolpath could
 * not plan a part from a body of its file, in words (`plan-failure`).
 */
export * from './plan-failure'
export * from './stock'
export * from './tool-crib'
