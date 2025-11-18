import fetch from 'node-fetch'
import chalk from 'chalk'

// types
interface WebhookPayload {
    event: 'update_started' | 'update_completed' | 'update_failed' | 'container_created'
    timestamp: string
    container: {
        id: string
        name: string
        image: string
    }
    details?: {
        [key: string]: any
    }
}

/**
 * Send a webhook notification
 * @param webhookUrl - The webhook URL to send to
 * @param payload - The payload to send
 */
export async function send_webhook(webhookUrl: string, payload: WebhookPayload): Promise<boolean> {
    if (!webhookUrl || webhookUrl === 'No') {
        // Webhooks not configured
        return false
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'kebele-webhook/1.0'
            },
            body: JSON.stringify(payload),
            // Timeout after 5 seconds
            signal: AbortSignal.timeout(5000)
        })

        if (!response.ok) {
            console.warn(chalk.yellow(`Webhook failed: HTTP ${response.status}`))
            return false
        }

        return true

    } catch (error: any) {
        console.warn(chalk.yellow(`Webhook error: ${error.message || 'Failed to send'}`))
        return false
    }
}

/**
 * Send a notification that an update has started
 */
export async function notify_update_started(
    webhookUrl: string,
    containerId: string,
    containerName: string,
    image: string
): Promise<void> {
    await send_webhook(webhookUrl, {
        event: 'update_started',
        timestamp: new Date().toISOString(),
        container: {
            id: containerId,
            name: containerName,
            image
        }
    })
}

/**
 * Send a notification that an update has completed
 */
export async function notify_update_completed(
    webhookUrl: string,
    containerId: string,
    containerName: string,
    image: string,
    fromVersion: string,
    toVersion: string
): Promise<void> {
    const success = await send_webhook(webhookUrl, {
        event: 'update_completed',
        timestamp: new Date().toISOString(),
        container: {
            id: containerId,
            name: containerName,
            image
        },
        details: {
            fromVersion,
            toVersion
        }
    })

    if (success) {
        console.log(chalk.gray('✓ Webhook notification sent'))
    }
}

/**
 * Send a notification that an update has failed
 */
export async function notify_update_failed(
    webhookUrl: string,
    containerId: string,
    containerName: string,
    image: string,
    error: string
): Promise<void> {
    await send_webhook(webhookUrl, {
        event: 'update_failed',
        timestamp: new Date().toISOString(),
        container: {
            id: containerId,
            name: containerName,
            image
        },
        details: {
            error
        }
    })
}

/**
 * Send a notification that a container was created
 */
export async function notify_container_created(
    webhookUrl: string,
    containerId: string,
    containerName: string,
    image: string
): Promise<void> {
    const success = await send_webhook(webhookUrl, {
        event: 'container_created',
        timestamp: new Date().toISOString(),
        container: {
            id: containerId,
            name: containerName,
            image
        }
    })

    if (success) {
        console.log(chalk.gray('✓ Webhook notification sent'))
    }
}
