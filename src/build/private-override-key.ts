/**
 * Resolve the private backend override used only by Lingop build tooling.
 *
 * Netlify requires environment-variable names to start with a letter, so the
 * unprefixed name is canonical. Retain the original leading-underscore name
 * for existing local and deployment environments while they migrate.
 */
export function getPrivateOverrideKey(
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return (
    environment.H_PERSONAL_OVERRIDE_KEY ||
    environment._H_PERSONAL_OVERRIDE_KEY ||
    undefined
  );
}
