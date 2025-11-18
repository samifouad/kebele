import { createSpinner } from 'nanospinner'
import { exec } from 'child_process'
import { promisify } from 'util'
import chalk from 'chalk'

import { sleep } from '@/utils'
import { to_cron_syntax } from '@/utils/cron_schedule'

const execAsync = promisify(exec)

// types
interface ContainerConfig {
    id: string
    name: string
    url: string
    ePort: number
    iPort: number
    cron: string
    update: string
}

/**
 * Create a cron job for checking container updates
 * @param config - Container configuration
 */
export async function cron(config: ContainerConfig): Promise<void> {
    const spinner = createSpinner('Creating cron job...').start()

    try {
        // Convert user-friendly schedule to cron syntax
        const cronExpression = to_cron_syntax(config.cron)

        // Get the path to the kebele executable
        // In production, this would be /usr/local/bin/kebele or similar
        // For now, we'll use 'kebele' assuming it's in PATH
        const kebelePath = 'kebele'

        // Create the cron command
        // This will call: kebele update <container-id>
        const cronCommand = `${cronExpression} ${kebelePath} update ${config.id}`

        // Add a comment to identify this cron job
        const cronComment = `# kebele: ${config.name} (${config.id})`

        spinner.update({ text: 'Reading current crontab...' })

        // Get current crontab
        let currentCrontab = ''
        try {
            const { stdout } = await execAsync('crontab -l 2>/dev/null || true')
            currentCrontab = stdout
        } catch (error) {
            // No crontab exists yet, that's fine
            currentCrontab = ''
        }

        await sleep(300)

        // Check if this container already has a cron job
        const lines = currentCrontab.split('\n')
        const existingJobIndex = lines.findIndex(line => line.includes(config.id))

        if (existingJobIndex !== -1) {
            spinner.update({ text: 'Updating existing cron job...' })
            // Remove the old job and its comment
            const commentIndex = existingJobIndex > 0 && lines[existingJobIndex - 1].startsWith('#')
                ? existingJobIndex - 1
                : existingJobIndex
            lines.splice(commentIndex, existingJobIndex - commentIndex + 1)
        } else {
            spinner.update({ text: 'Adding new cron job...' })
        }

        // Add the new cron job
        lines.push(cronComment)
        lines.push(cronCommand)

        // Ensure there's a newline at the end
        const newCrontab = lines.filter(line => line.trim() !== '').join('\n') + '\n'

        await sleep(300)

        // Write the new crontab
        spinner.update({ text: 'Installing crontab...' })

        await execAsync(`echo "${newCrontab.replace(/"/g, '\\"')}" | crontab -`)

        await sleep(300)

        spinner.success({
            text: `Cron job created: ${chalk.blue(config.cron)} → ${chalk.green('kebele update ' + config.id)}`
        })

    } catch (error: any) {
        spinner.error({ text: 'Failed to create cron job' })
        console.error('')
        console.error(chalk.red('error') + ': ' + (error.message || 'operation failed'))
        console.error('')

        // Provide helpful error messages
        if (error.message?.includes('command not found')) {
            console.error('crontab command not found. Make sure cron is installed on your system.')
            console.error('')
        } else if (error.message?.includes('permission')) {
            console.error('Permission denied. You may need to run with appropriate permissions.')
            console.error('')
        }

        console.error('please try again or report issues at https://kebele.dev')
        console.error('')
        throw error
    }
}

/**
 * Remove a cron job for a specific container
 * @param containerId - The container ID
 */
export async function remove_cron_job(containerId: string): Promise<void> {
    try {
        // Get current crontab
        const { stdout } = await execAsync('crontab -l 2>/dev/null || true')
        const currentCrontab = stdout

        // Filter out lines related to this container
        const lines = currentCrontab.split('\n')
        const filteredLines = []

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            // Skip if this line contains the container ID
            if (line.includes(containerId)) {
                // Also skip the comment line before it if it exists
                if (filteredLines.length > 0 && filteredLines[filteredLines.length - 1].startsWith('#')) {
                    filteredLines.pop()
                }
                continue
            }
            filteredLines.push(line)
        }

        // Write the new crontab
        const newCrontab = filteredLines.filter(line => line.trim() !== '').join('\n') + '\n'
        await execAsync(`echo "${newCrontab.replace(/"/g, '\\"')}" | crontab -`)

    } catch (error: any) {
        console.error('Error removing cron job:', error.message || error)
        throw error
    }
}

/**
 * List all kebele cron jobs
 * @returns Array of cron job entries
 */
export async function list_cron_jobs(): Promise<string[]> {
    try {
        const { stdout } = await execAsync('crontab -l 2>/dev/null || true')
        const lines = stdout.split('\n')

        // Filter for kebele-related cron jobs
        return lines.filter(line =>
            line.includes('kebele update') && !line.startsWith('#')
        )
    } catch (error) {
        return []
    }
}