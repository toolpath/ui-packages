import { RuleTester, type Rule } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'
import { noDirectEngineHttp } from '../../src/engine/eslint/no-direct-engine-http.js'

RuleTester.describe = describe
RuleTester.it = it

// The rule is typed with typescript-eslint's RuleModule; ESLint's tester takes
// its own declaration of the same runtime shape.
const rule: Rule.RuleModule = noDirectEngineHttp as unknown as Rule.RuleModule

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' },
})

const options = [{ origins: ['https://api.toolpath.com', 'https://api.staging.toolpath.com'] }]
const error = (
  origin = 'https://api.toolpath.com',
): Array<{ messageId: string; data: { origin: string } }> => [
  { messageId: 'directEngineHttp', data: { origin } },
]

tester.run('toolpath-engine/no-direct-engine-http', rule, {
  valid: [
    // Relative routes go to the application's own server or proxy.
    { code: "await fetch('/v1/parts')", options },
    // A URL computed at run time is a review concern, not a static fact.
    { code: 'export const send = (url: string) => fetch(url)', options },
    { code: 'export const send = (base: string) => fetch(`${base}/v1/parts`)', options },
    // `https://api.toolpath.com${suffix}` could continue the host name.
    {
      code: 'export const send = (suffix: string) => fetch(`https://api.toolpath.com${suffix}`)',
      options,
    },
    // Presigned storage hosts and application endpoints are not Engine origins.
    {
      code: "await fetch('https://uploads.example.test/bucket/key?signature=abc', { method: 'PUT' })",
      options,
    },
    { code: "await fetch('https://app.example.test/api/engine/parts')", options },
    // A shadowed or injected fetch is not the global one.
    {
      code: "const fetch = (url: string) => url; fetch('https://api.toolpath.com/v1/parts')",
      options,
    },
    {
      code: "export const call = (fetch: typeof globalThis.fetch) => fetch('https://api.toolpath.com/v1/parts')",
      options,
    },
    {
      code: "declare const client: { fetch: (url: string) => void }; client.fetch('https://api.toolpath.com/v1/parts')",
      options,
    },
    // A reassignable binding is not a constant.
    {
      code: "let base = 'https://api.toolpath.com'; base = location.origin; await fetch(base + '/v1/parts')",
      options,
    },
    // Strings in comments and non-fetch calls are not requests.
    {
      code: "// fetch('https://api.toolpath.com/v1/parts')\nconsole.log('https://api.toolpath.com/v1/parts')",
      options,
    },
    { code: "await fetch(new URL('/v1/parts', location.origin))", options },
    // With no configured origins the rule has nothing to recognize.
    {
      code: "await fetch('https://api.toolpath.com/v1/parts')",
      options: [{ origins: ['https://api.example.test'] }],
    },
  ],
  invalid: [
    {
      code: "await fetch('https://api.toolpath.com/v1/parts', { method: 'POST' })",
      options,
      errors: error(),
    },
    {
      code: "await globalThis.fetch('https://api.staging.toolpath.com/v1/jobs')",
      options,
      errors: error('https://api.staging.toolpath.com'),
    },
    { code: "await window.fetch('https://api.toolpath.com/v1/jobs')", options, errors: error() },
    {
      code: "const ENGINE = 'https://api.toolpath.com'; await fetch(ENGINE + '/v1/parts')",
      options,
      errors: error(),
    },
    {
      code: "const ENGINE = 'https://api.toolpath.com'; export const get = (id: string) => fetch(`${ENGINE}/v1/parts/${id}`)",
      options,
      errors: error(),
    },
    {
      code: "const ENGINE = 'https://api.toolpath.com'; export const get = (id: string) => fetch(new URL(`/v1/jobs/${id}`, ENGINE))",
      options,
      errors: error(),
    },
    {
      code: "const url = new URL('/v1/parts', 'https://api.toolpath.com'); await fetch(url.href)",
      options,
      errors: error(),
    },
    {
      code: "await fetch(new Request('https://api.toolpath.com/v1/parts'))",
      options,
      errors: error(),
    },
    {
      code: "await fetch('https://api.toolpath.com/v1/parts' as string)",
      options,
      errors: error(),
    },
    {
      code: "const send = fetch; await send('https://api.toolpath.com/v1/parts')",
      options,
      errors: error(),
    },
    {
      code: "const { fetch: send } = globalThis; await send('https://api.toolpath.com/v1/parts')",
      options,
      errors: error(),
    },
    {
      code: "const send = fetch.bind(globalThis); await send('https://api.toolpath.com/v1/parts')",
      options,
      errors: error(),
    },
    {
      code: "const fetch = globalThis.fetch; await fetch('https://api.toolpath.com/v1/parts')",
      options,
      errors: error(),
    },
    {
      code: "await fetch('https://API.Toolpath.com/v1/parts')",
      options,
      errors: error(),
    },
  ],
})
