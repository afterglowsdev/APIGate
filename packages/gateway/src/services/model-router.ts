/**
 * Model routing middleware / 模型路由中间件
 *
 * Responsibilities / 职责：
 * 1. Extract profile/model from request body, resolve target profile
 *    → 从请求体提取 profile 或 model 字段，确定目标档位
 * 2. Weighted random selection from the profile's model pool
 *    → 按权重从模型池中随机选择一个真实模型
 * 3. Enforce parameter limits (max_tokens, temperature, n forced to 1)
 *    → 应用参数限制
 * 4. Clean up profile field from body, inject real model name
 *    → 清理请求体中的 profile 字段，注入真实 model
 * 5. Store selected model and profile in context
 *    → 将选中的模型和档位注入上下文
 */

import type { MiddlewareHandler } from 'hono'
import type { IConfigStore } from '../interfaces/config-store.js'
import { weightedRandomSelect } from '../utils/weighted-random.js'
import { parseRequestBody } from '../utils/request.js'
import type { Logger } from './logger.js'
import {
  ProfileNotFoundError,
  ProfileDisabledError,
  ModelNotAllowedError,
  InternalError,
  InvalidRequestError,
} from '../types/errors.js'
import type { WeightedModel } from '../types/config.js'

export function createModelSelectMiddleware(configStore: IConfigStore, logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const app = c.get('app')
    if (!app) { await next(); return }

    const config = await configStore.getConfig()
    const parsedBody = await parseRequestBody(c.req.raw.clone(), config.requestBodyLimitBytes || 1024 * 1024)
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      throw new InvalidRequestError('Request body must be a JSON object')
    }
    const body = parsedBody as Record<string, unknown>

    // 1. Determine profile: explicit profile/model > app.defaultProfile > global defaultProfile
    //    确定档位：请求指定 > 应用默认 > 全局默认
    const profileName = (body.profile || body.model || app.defaultProfile || config.defaultProfile) as string
    const profile = config.profiles[profileName]

    if (!profile) {
      throw new ProfileNotFoundError(`Profile "${profileName}" not found`)
    }

    if (!profile.enabled) {
      throw new ProfileDisabledError(`Profile "${profileName}" is disabled`)
    }

    // 2. Check app permission / 检查应用是否有权限使用该档位
    if (app.allowedProfiles.length > 0 && !app.allowedProfiles.includes(profileName)) {
      throw new ModelNotAllowedError(`App "${app.appId}" is not allowed to use profile "${profileName}"`)
    }

    // 3. Check profile has available models / 检查档位是否有可用模型
    if (!profile.models || profile.models.length === 0) {
      throw new InternalError(`Profile "${profileName}" has no models configured`)
    }

    // 4. Weighted random model selection / 按权重随机选择模型
    const selectedModel = weightedRandomSelect<WeightedModel>(
      profile.models,
      (m) => m.weight,
    )

    // 5. Clean request body: remove profile field, inject real model name / 清理请求体
    delete body.profile
    body.model = selectedModel.name

    // 6. Apply parameter limits (request values win, but capped at profile max) / 应用档位参数限制
    if (body.max_tokens === undefined || (body.max_tokens as number) > profile.max_tokens) {
      body.max_tokens = profile.max_tokens
    }
    if (body.temperature === undefined) {
      body.temperature = profile.temperature
    }

    // 7. Safety enforcement / 安全限制
    body.n = 1 // force n=1 to prevent cost explosion / 强制 n=1，防止批量生成导致成本暴涨
    if (typeof body.temperature === 'number') {
      body.temperature = Math.max(0, Math.min(2, body.temperature as number))
    }

    // 8. Store in context for the proxy handler / 注入上下文供代理层使用
    c.set('selectedModel', selectedModel.name)
    c.set('selectedProfile', profile)
    c.set('selectedProfileName', profileName)
    c.set('requestBody', body)

    logger.info('Model selected', {
      appId: app.appId,
      profile: profileName,
      model: selectedModel.name,
    })

    await next()
  }
}
