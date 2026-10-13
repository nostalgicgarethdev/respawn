import { registerHooks } from "node:module"

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && specifier.endsWith(".js")) {
      try {
        return nextResolve(specifier.replace(/\.js$/, ".ts"), context)
      } catch {
        return nextResolve(specifier, context)
      }
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.(ts|tsx|js|mjs|cjs|json)$/.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context)
      } catch {
        return nextResolve(specifier, context)
      }
    }
    return nextResolve(specifier, context)
  },
})
