import chalk from 'chalk'

import * as handlers from '@/handlers'
import * as utils from '@/utils'

/**
 * Update command - check and apply updates to a container
 * @param containerId - Optional container ID. If not provided, updates all containers
 */
export async function update(containerId?: string): Promise<void> {
    // Welcome message
    await utils.welcome("update")

    // Check if docker is available
    try {
        await utils.check_docker()
    } catch (err) {
        console.error(`could not connect to Docker daemon`)
        console.error('')
        console.error('please make sure docker is running & try again')
        console.error('')
        console.error('report issues at https://kebele.dev')
        console.error('')
        process.exit(1)
    }

    try {
        if (containerId) {
            // Update a specific container
            console.log(chalk.blue(`Updating container: ${containerId}`))
            console.log('')

            const updated = await handlers.update_container(containerId)

            if (updated) {
                console.log('')
                console.log(chalk.green('✓ Update completed successfully!'))
                console.log('')
            } else {
                console.log('')
                console.log(chalk.gray('No updates available'))
                console.log('')
            }

        } else {
            // Update all containers
            console.log(chalk.blue('Updating all containers...'))
            console.log('')

            // TODO: Implement update all containers
            // This would query the database for all containers and update each one
            console.log(chalk.yellow('Updating all containers is not yet implemented'))
            console.log(chalk.gray('Use: kebele update <container-id>'))
            console.log('')
        }

    } catch (error: any) {
        console.error(chalk.red('Update failed:'), error.message || error)
        console.error('')
        process.exit(1)
    }
}
