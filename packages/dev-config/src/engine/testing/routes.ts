import type { LoadedContract, OpenApiOperation } from '../contracts.js'

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

export interface Route {
  operationId: string
  method: string
  template: string
  operation: OpenApiOperation
  pattern: RegExp
  parameterNames: Array<string>
}

export interface RouteMatch {
  route: Route
  params: Record<string, string>
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Every operation in a contract as a method plus a path pattern. */
export const routesFor = (contract: LoadedContract): Array<Route> => {
  const routes: Array<Route> = []
  for (const [template, item] of Object.entries(contract.document.paths)) {
    for (const method of METHODS) {
      const operation = item[method]
      if (!operation?.operationId) {
        continue
      }
      const parameterNames: Array<string> = []
      const source = template
        .split(/(\{[^}]+\})/)
        .map((segment) => {
          const parameter = /^\{([^}]+)\}$/.exec(segment)
          if (parameter?.[1] !== undefined) {
            parameterNames.push(parameter[1])
            return '([^/]+)'
          }
          return escape(segment)
        })
        .join('')
      routes.push({
        operationId: operation.operationId,
        method: method.toUpperCase(),
        template,
        operation,
        pattern: new RegExp(`^${source}$`),
        parameterNames,
      })
    }
  }
  // Literal paths win over templated ones (`/v1/parts/{id}/mesh` before a broader match).
  return routes.sort((a, b) => a.parameterNames.length - b.parameterNames.length)
}

/** The operation a method and path select, or what is wrong with them. */
export const matchRoute = (
  routes: ReadonlyArray<Route>,
  method: string,
  path: string,
): RouteMatch | { route: undefined; reason: 'no-path' | 'no-method'; allowed: Array<string> } => {
  const allowed: Array<string> = []
  for (const route of routes) {
    const match = route.pattern.exec(path)
    if (!match) {
      continue
    }
    if (route.method !== method) {
      allowed.push(route.method)
      continue
    }
    const params: Record<string, string> = {}
    route.parameterNames.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1] ?? '')
    })
    return { route, params }
  }
  return { route: undefined, reason: allowed.length > 0 ? 'no-method' : 'no-path', allowed }
}
