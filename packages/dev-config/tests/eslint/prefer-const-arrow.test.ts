import { preferConstArrow } from '../../src/eslint/plugin/rules/prefer-const-arrow.js'
import { runRule } from '../helpers/rule-tester.js'

runRule('prefer-const-arrow (ts)', preferConstArrow, {
  valid: [
    'const add = (a: number, b: number) => a + b',
    // Dynamic receiver, arguments, construction and generators keep function syntax.
    'function readThis(this: Window) { return this.location }',
    'function usesThis() { return this.value }',
    'function variadic() { return arguments.length }',
    'function Point(x) { this.x = x }\nconst p = new Point(1)',
    'function Base() {}\nBase.prototype.read = () => 1',
    'function* ids() { yield 1 }',
    'function target() { return new.target }',
    // Overloads and ambient declarations.
    'export function pick(value: string): string\nexport function pick(value: number): number\nexport function pick(value: string | number) { return value }',
    'declare function external(value: string): void',
    // A required framework shape: a default-exported named component or route module.
    'export default function Page() { return null }',
    // Methods and accessors are not function values.
    'const api = { load() { return 1 }, get size() { return 2 } }',
    'class Store { read() { return 1 } }',
    // A named expression that calls itself.
    'const walk = function visit(depth: number): number { return depth === 0 ? 0 : visit(depth - 1) }',
    // `this` inside an arrow still belongs to the enclosing function.
    'function outer() { return () => this }',
    // Function-shaped text in strings and comments is not code.
    "const text = 'function notReal() {}' // function alsoNotReal() {}",
  ],
  invalid: [
    {
      code: 'function add(a: number, b: number): number {\n  return a + b\n}',
      output: 'const add = (a: number, b: number): number => {\n  return a + b\n}',
      errors: [{ messageId: 'preferConstArrow' }],
    },
    {
      code: 'export async function load<T>(value: T): Promise<T> {\n  // keeps this comment\n  return value\n}',
      output:
        'export const load = async <T>(value: T): Promise<T> => {\n  // keeps this comment\n  return value\n}',
      errors: [{ messageId: 'preferConstArrow' }],
    },
    {
      code: 'const handler = function (event: Event) {\n  return event.type\n}',
      output: 'const handler = (event: Event) => {\n  return event.type\n}',
      errors: [{ messageId: 'preferArrowExpression' }],
    },
    {
      code: '[1, 2].map(function (value) { return value * 2 })',
      output: '[1, 2].map((value) => { return value * 2 })',
      errors: [{ messageId: 'preferArrowExpression' }],
    },
    {
      code: 'const run = function () { return 1 }.call(undefined)',
      output: 'const run = (() => { return 1 }).call(undefined)',
      errors: [{ messageId: 'preferArrowExpression' }],
    },
    {
      // Used before its declaration: report without rewriting, since TDZ could change behaviour.
      code: 'start()\nfunction start() { return 1 }',
      output: null,
      errors: [
        {
          messageId: 'preferConstArrow',
          suggestions: [
            { messageId: 'convert', output: 'start()\nconst start = () => { return 1 }' },
          ],
        },
      ],
    },
    {
      // Reassigned: a const would throw, so neither a fix nor a suggestion.
      code: 'function swap() { return 1 }\nswap = () => 2',
      output: null,
      errors: [{ messageId: 'preferConstArrow', suggestions: [] }],
    },
    {
      // A comment before the parameter list would be lost by a rewrite.
      code: 'function /* why */ named() { return 1 }',
      output: null,
      errors: [{ messageId: 'preferConstArrow' }],
    },
  ],
})

runRule(
  'prefer-const-arrow (tsx)',
  preferConstArrow,
  {
    valid: [],
    invalid: [
      {
        // A lone type parameter needs a trailing comma so TSX does not read it as a tag.
        code: 'function identity<T>(value: T): T { return value }',
        output: 'const identity = <T,>(value: T): T => { return value }',
        errors: [{ messageId: 'preferConstArrow' }],
      },
      {
        code: 'function Label({ text }: { text: string }) { return <span>{text}</span> }',
        output: 'const Label = ({ text }: { text: string }) => { return <span>{text}</span> }',
        errors: [{ messageId: 'preferConstArrow' }],
      },
    ],
  },
  { filename: 'component.tsx' },
)
