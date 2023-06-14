import { v4 as uuidv4 } from 'uuid';

import { ForgeTriggerContext, WebTriggerRequest, WebTriggerResponse } from './types/types';
import { extractCloudIdFromContext } from './utils/contextUtils';
import { resolveEventType } from './utils/payloadUtils';
import { verifyAuth, verifyBody } from './utils/requestVerification';
import { buildErrorResponse, buildResponse } from './utils/responseBuilder';

export async function handleOrbRequest(
  request: WebTriggerRequest,
  context: ForgeTriggerContext,
): Promise<WebTriggerResponse> {
  const requestId = uuidv4();

  try {
    await verifyAuth(request);
    verifyBody(request);

    const cloudId = extractCloudIdFromContext(context);
    const payload: unknown = JSON.parse(request.body);
    const eventType = resolveEventType(payload);
    const endpoint = `/jira/${eventType}/0.1/cloud/${cloudId}/bulk`;
    const isDebug = request.queryParameters.debug?.[0] === 'true';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: required so that Typescript doesn't complain about the missing "api" property
    const response = await global.api.asApp().__requestAtlassian(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return buildResponse(
      {
        ...(await response.json()),
        ...(isDebug ? { cloudId } : {}),
        ...(isDebug ? { eventType } : {}),
        ...(isDebug ? { jiraRequestBody: payload } : {}),
        ...(isDebug ? { jiraRequestEndpoint: endpoint } : {}),
        ...(isDebug ? { jiraResponseMetadata: response } : {}),
        ...(isDebug ? { orbRequestMetadata: request } : {}),
        ...(isDebug ? { requestId } : {}),
      },
      response.status,
    );
  } catch (error) {
    console.error(requestId, error);
    return buildErrorResponse(error as Error, requestId);
  }
}
