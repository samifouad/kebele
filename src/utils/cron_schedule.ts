/**
 * Utility functions for converting user-friendly cron schedules to crontab syntax
 */

// Map of user-friendly options to cron expressions
const SCHEDULE_MAP: { [key: string]: string } = {
    'Every minute': '* * * * *',
    'Every 5 minutes': '*/5 * * * *',
    'Every 15 minutes': '*/15 * * * *',
    'Every 30 minutes': '*/30 * * * *',
    'Every hour': '0 * * * *',
    'Every 6 hours': '0 */6 * * *',
    'Every 12 hours': '0 */12 * * *',
    'Daily at midnight': '0 0 * * *',
    'Daily at 2am': '0 2 * * *',
    'Weekly on Sunday': '0 0 * * 0',
}

/**
 * Convert a user-friendly schedule to cron syntax
 * @param userSchedule - User-friendly schedule string
 * @returns Cron expression string
 */
export function to_cron_syntax(userSchedule: string): string {
    // Check if it's in our predefined map
    if (SCHEDULE_MAP[userSchedule]) {
        return SCHEDULE_MAP[userSchedule]
    }

    // If it's already a valid cron expression (5 parts), return as is
    const parts = userSchedule.trim().split(/\s+/)
    if (parts.length === 5) {
        return userSchedule
    }

    // Default to every 5 minutes if we can't parse it
    console.warn(`Unknown schedule "${userSchedule}", defaulting to every 5 minutes`)
    return '*/5 * * * *'
}

/**
 * Get all available schedule options
 * @returns Array of user-friendly schedule options
 */
export function get_schedule_options(): string[] {
    return Object.keys(SCHEDULE_MAP)
}

/**
 * Validate a cron expression
 * @param cronExpression - Cron expression to validate
 * @returns true if valid, false otherwise
 */
export function validate_cron_expression(cronExpression: string): boolean {
    const parts = cronExpression.trim().split(/\s+/)

    if (parts.length !== 5) {
        return false
    }

    // Basic validation - each part should be a number, *, or range
    const cronRegex = /^(\*|[0-9,-/]+)$/
    return parts.every(part => cronRegex.test(part))
}
