/**
 * The React half: the hooks and contexts a Toolpath application shares.
 *
 * Split from the root entry so a server route can import the logic without
 * importing React. `react` and `react-dom` are peers here, never dependencies:
 * a component kit and an application that each installed their own copy of
 * React would break hooks outright.
 */

export { useUnit } from './use-unit.js'
