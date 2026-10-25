import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { LoadedContract, OpenApiOperation } from '../contracts.js'

/**
 * Validates JSON wire values against one pinned contract. OpenAPI 3.1 schemas
 * are JSON Schema 2020-12, so Ajv's 2020 build reads them directly; the
 * contract's `#/components/...` references resolve against the document itself.
 */
export class ContractValidator {
  readonly #ajv: Ajv2020
  readonly #base: string
  readonly #cache = new Map<string, ValidateFunction>()

  constructor(contract: LoadedContract) {
    this.#base = `urn:toolpath:engine:${contract.id}`
    this.#ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: true })
    addFormats.default(this.#ajv)
    // `binary` describes raw bytes (images), which are never validated as JSON.
    this.#ajv.addFormat('binary', true)
    this.#ajv.addSchema({ $id: this.#base, components: contract.document.components })
  }

  /** A copy of `schema` whose document-relative references point into the contract. */
  readonly #anchor = (schema: unknown): unknown => {
    if (Array.isArray(schema)) {
      return schema.map(this.#anchor)
    }
    if (schema !== null && typeof schema === 'object') {
      return Object.fromEntries(
        Object.entries(schema).map(([key, value]) => [
          key,
          key === '$ref' && typeof value === 'string' && value.startsWith('#/')
            ? `${this.#base}${value}`
            : this.#anchor(value),
        ]),
      )
    }
    return schema
  }

  readonly #compile = (key: string, schema: unknown): ValidateFunction => {
    const cached = this.#cache.get(key)
    if (cached) {
      return cached
    }
    const compiled = this.#ajv.compile(this.#anchor(schema) as object)
    this.#cache.set(key, compiled)
    return compiled
  }

  /** Errors (empty when valid) of `value` against component schema `name`. */
  readonly component = (name: string, value: unknown): Array<string> => {
    const validate = this.#compile(`component:${name}`, { $ref: `#/components/schemas/${name}` })
    return validate(value) ? [] : describe(validate.errors)
  }

  /** Errors of `value` against an arbitrary schema from the contract (a parameter or body schema). */
  readonly schema = (key: string, schema: unknown, value: unknown): Array<string> => {
    const validate = this.#compile(`schema:${key}`, schema)
    return validate(value) ? [] : describe(validate.errors)
  }

  /**
   * Errors of a response body against the schema the operation declares for
   * `status` and `contentType`; an undeclared status or content type is itself
   * an error.
   */
  readonly response = (
    operation: OpenApiOperation,
    status: number,
    contentType: string,
    value: unknown,
  ): Array<string> => {
    const response = operation.responses?.[String(status)]
    if (!response) {
      return [`${operation.operationId ?? 'operation'} declares no ${status} response`]
    }
    const media = response.content?.[contentType]
    if (!media) {
      return [
        `${operation.operationId ?? 'operation'} ${status} declares ${Object.keys(response.content ?? {}).join(', ') || 'no body'}, not ${contentType}`,
      ]
    }
    if (
      media.schema === undefined ||
      contentType === 'text/event-stream' ||
      contentType.startsWith('image/')
    ) {
      return []
    }
    return this.schema(
      `response:${operation.operationId ?? ''}:${status}:${contentType}`,
      media.schema,
      value,
    )
  }
}

const describe = (errors: Array<ErrorObject> | null | undefined): Array<string> =>
  (errors ?? [])
    .slice(0, 8)
    .map((error) => `${error.instancePath || '(root)'} ${error.message ?? 'is invalid'}`)

const validators = new Map<string, ContractValidator>()

/** One validator per contract, shared by every scenario in the process: compiling is the slow part. */
export const validatorFor = (contract: LoadedContract): ContractValidator => {
  const existing = validators.get(contract.id)
  if (existing) {
    return existing
  }
  const created = new ContractValidator(contract)
  validators.set(contract.id, created)
  return created
}
