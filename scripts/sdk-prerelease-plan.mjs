/**
 * What `publish-sdk-prerelease.mjs` does with the contract staging serves, decided from npm
 * alone: what `@toolpath/api@staging` and `@toolpath/api@latest` already record. The
 * repository's `main` may already be ahead of both, so nothing here reads it.
 */

export const parseVersion = (version, label) => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version ?? '')
  if (!match) {
    throw new Error(
      `${label} must be a stable semantic version, received ${JSON.stringify(version)}`,
    )
  }
  return {
    value: version,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

export const compareVersions = (left, right) => {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key]
  }
  return 0
}

/**
 * `served` is `{ sha256, apiVersion }` for the contract staging serves. `staging` and `latest`
 * are `{ version, toolpath }` as npm reports them for those dist-tags, or undefined when the
 * tag does not exist. Returns `{ skip: reason }` or `{ version }`, the version to publish
 * without its `.g<sha>` suffix.
 *
 * The version is `<latest with its patch bumped>-staging.<UTC datetime>`. Any later stable
 * release is at least that patch bump, and a prerelease sorts below its own release, so a
 * snapshot never sorts above the next stable release, whichever bump that turns out to be.
 */
export const planPrerelease = ({ served, staging, latest, now = new Date() }) => {
  if (staging?.toolpath?.openApiSha256 === served.sha256) {
    return { skip: `@toolpath/api@${staging.version} (staging) already carries this contract.` }
  }

  // The tag only ever moves forward through Engine API versions; a lower one means staging
  // was rolled back, which a consumer should not silently follow.
  if (staging?.toolpath?.openApiVersion) {
    const published = parseVersion(staging.toolpath.openApiVersion, 'The staging openApiVersion')
    if (compareVersions(parseVersion(served.apiVersion, 'The served version'), published) < 0) {
      throw new Error(
        `Staging serves Engine API ${served.apiVersion}, older than the ${published.value} ` +
          `already on @toolpath/api@staging`,
      )
    }
  }

  if (!latest) {
    throw new Error('@toolpath/api has no latest version on npm to base a prerelease on')
  }
  if (latest.toolpath?.openApiSha256 === served.sha256) {
    return { skip: `@toolpath/api@${latest.version} (latest) already carries this contract.` }
  }

  const base = parseVersion(latest.version, 'The latest @toolpath/api version')
  const datetime = now.toISOString().replace(/\D/g, '').slice(0, 14)
  return { version: `${base.major}.${base.minor}.${base.patch + 1}-staging.${datetime}` }
}
