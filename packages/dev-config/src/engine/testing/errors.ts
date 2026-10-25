/**
 * A test-kit diagnostic: a request no operation in the selected contract
 * matches, an operation the scenario does not simulate, an invalid transition,
 * or a payload that would break the contract. It is never a contract response.
 */
export class EngineScenarioError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EngineScenarioError'
  }
}
