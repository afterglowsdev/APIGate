import type { MiddlewareHandler } from 'hono'
import type { IConfigStore } from '../interfaces/config-store.js'
import { weightedRandomSelect } from '../utils/weighted-random.js'
import type { Logger } from './logger.js'
import { ProfileNotFoundError, ProfileDisabledError, ModelNotAllowedError, InternalError } from '../types/errors.js'
import type { WeightedModel } from '../types/config.js'

export function createModelSelectMiddleware(configStore: IConfigStore, logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const client = c.get('client')
    if (!client) { await next(); return }

    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      // Body will be re-parsed in the proxy handler
      await next()
      return
    }

    const config = await configStore.getConfig()

    // Determine profile from request
    const profileName = (body.profile || body.model || config.defaultProfile) as string
    const profile = config.profiles[profileName]

    if (!profile) {
      throw new ProfileNotFoundError(`Profile "${profileName}" not found`)
    }

    if (!profile.enabled) {
      throw new ProfileDisabledError(`Profile "${profileName}" is disabled`)
    }

    // Check client is allowed to use this profile
    if (client.allowedProfiles.length > 0 && !client.allowedProfiles.includes(profileName)) {
      throw new ModelNotAllowedError(`Client "${client.id}" is not allowed to use profile "${profileName}"`)
    }

    // Check profile has models
    if (!profile.models || profile.models.length === 0) {
      throw new InternalError(`Profile "${profileName}" has no models configured`)
    }

    // Select model from profile's weighted pool
    const selectedModel = weightedRandomSelect<WeightedModel>(
      profile.models,
      (m) => m.weight,
    )

    // Clean up body: remove profile, set real model
    delete body.profile
    body.model = selectedModel.name

    // Apply profile parameter limits
    if (body.max_tokens === undefined || (body.max_tokens as number) > profile.max_tokens) {
      body.max_tokens = profile.max_tokens
    }
    if (body.temperature === undefined) {
      body.temperature = profile.temperature
    }

    // Enforce parameter limits
    body.n = 1 // Force n=1 to prevent cost explosion
    if (typeof body.temperature === 'number') {
      body.temperature = Math.max(0, Math.min(2, body.temperature as number))
    }

    // Store for proxy handler
    c.set('selectedModel', selectedModel.name)
    c.set('selectedProfile', profile)

    // Store modified body
    c.set('requestBody', body)

    logger.info('Model selected', {
      clientId: client.id,
      profile: profileName,
      model: selectedModel.name,
    })

    await next()
  }
}
