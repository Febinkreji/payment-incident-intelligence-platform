// The contract every LLM provider must satisfy: a single async function
// `generate(prompt, options) -> Promise<string>` returning the model's raw
// text response for the given prompt. Plugging in OpenAI, Claude, Gemini, or
// a local model later means writing one new file matching this shape and
// registering it below — nothing in promptBuilder.js, responseParser.js, or
// investigationEngine.js needs to change.
const providers = {}

function registerProvider(name, provider) {
  if (typeof provider.generate !== 'function') {
    throw new Error(`Provider "${name}" must implement generate(prompt, options)`)
  }
  providers[name] = provider
}

function getProvider(name) {
  const provider = providers[name]
  if (!provider) {
    throw new Error(`Unknown LLM provider: "${name}". Registered providers: ${Object.keys(providers).join(', ') || '(none)'}`)
  }
  return provider
}

module.exports = { registerProvider, getProvider }
