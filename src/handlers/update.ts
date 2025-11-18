import { createSpinner } from 'nanospinner'
import chalk from 'chalk'

import { db } from '@/core'
import { docker_request, sleep, check_container_updates } from '@/utils'

// types
interface ContainerUpdateConfig {
    id: string
    name: string
    url: string
    ePort: number
    iPort: number
    update: string
    cid?: string
}

/**
 * Check for and apply updates to a container
 * @param containerId - The container ID from the database
 * @param config - Optional container config (if not provided, will fetch from DB)
 * @returns true if update was applied, false if no update available
 */
export async function update_container(containerId: string, config?: ContainerUpdateConfig): Promise<boolean> {
    const spinner = createSpinner('Checking for updates...').start()

    try {
        // If config not provided, fetch from database
        if (!config) {
            const query = db.prepare("SELECT id, json_config, cid FROM containers WHERE id = ?")
            const result = query.get(containerId) as any

            if (!result) {
                throw new Error(`Container with ID ${containerId} not found`)
            }

            const jsonConfig = JSON.parse(result.json_config)
            config = {
                ...jsonConfig,
                cid: result.cid
            }
        }

        if (!config.cid) {
            throw new Error('Container has no Docker container ID (cid). It may not have been created yet.')
        }

        spinner.update({ text: `Checking for updates to ${config.name}...` })

        // Check for updates
        const updateCheck = await check_container_updates(config.cid)

        await sleep(500)

        if (!updateCheck.updateAvailable) {
            spinner.success({
                text: `${chalk.green(config.name)} is up to date (${updateCheck.currentVersion})`
            })
            return false
        }

        // Update is available
        console.log('')
        console.log(chalk.blue('Update available!'))
        console.log(`  Current: ${chalk.yellow(updateCheck.currentVersion)} (${updateCheck.currentDigest?.substring(0, 12)}...)`)
        console.log(`  Latest:  ${chalk.green(updateCheck.latestVersion)} (${updateCheck.latestDigest?.substring(0, 12)}...)`)
        console.log('')

        spinner.update({ text: 'Applying update...' })

        // Apply update based on strategy
        await apply_update_strategy(config, spinner)

        spinner.success({
            text: `${chalk.green(config.name)} updated successfully to ${updateCheck.latestVersion}!`
        })

        // Update database with new version info
        const runtimeInfo = {
            cid: config.cid,
            version: updateCheck.latestVersion,
            status: 'running',
            public: 'no',
            protocol: 'http'
        }

        const updateQuery = db.prepare(
            "UPDATE containers SET json_runtime = json(?) WHERE id = ?"
        )
        updateQuery.run(JSON.stringify(runtimeInfo), config.id)

        return true

    } catch (error: any) {
        spinner.error({ text: 'Update failed' })
        console.error('')
        console.error(chalk.red('error') + ': ' + (error.message || 'operation failed'))
        console.error('')
        console.error('please try again or report issues at https://kebele.dev')
        console.error('')
        throw error
    }
}

/**
 * Apply the update based on the configured strategy
 */
async function apply_update_strategy(config: ContainerUpdateConfig, spinner: any): Promise<void> {
    if (!config.cid) {
        throw new Error('Container ID is required')
    }

    const strategy = config.update || 'Stop Container, Apply Update & Restart Container'

    if (strategy === 'Stop Container, Apply Update & Restart Container') {
        // Step 1: Stop the container
        spinner.update({ text: 'Stopping container...' })
        await docker_request(`/containers/${config.cid}/stop`, { method: 'POST' })
        await sleep(2000)

        // Step 2: Remove the container
        spinner.update({ text: 'Removing old container...' })
        await docker_request(`/containers/${config.cid}?force=true`, { method: 'DELETE' })
        await sleep(500)

        // Step 3: Pull latest image
        spinner.update({ text: 'Pulling latest image...' })
        await docker_request(`/images/create?fromImage=${encodeURIComponent(config.url)}`, {
            method: 'POST'
        })
        await sleep(1000)

        // Step 4: Create new container with same config
        spinner.update({ text: 'Creating new container...' })

        const createConfig = {
            Image: config.url,
            name: config.name,
            ExposedPorts: {
                [`${config.iPort}/tcp`]: {}
            },
            HostConfig: {
                PortBindings: {
                    [`${config.iPort}/tcp`]: [
                        {
                            HostPort: `${config.ePort}`
                        }
                    ]
                }
            }
        }

        const createResponse = await docker_request<{ Id: string }>(
            `/containers/create?name=${encodeURIComponent(config.name)}`,
            {
                method: 'POST',
                body: createConfig
            }
        )

        const newContainerId = createResponse.data.Id

        // Step 5: Start the new container
        spinner.update({ text: 'Starting new container...' })
        await docker_request(`/containers/${newContainerId}/start`, { method: 'POST' })
        await sleep(500)

        // Update the stored container ID
        config.cid = newContainerId

    } else {
        throw new Error(`Unknown update strategy: ${strategy}`)
    }
}

/**
 * Check for updates without applying them
 * @param containerId - The container ID from the database
 * @returns Update check result
 */
export async function check_updates_only(containerId: string) {
    const spinner = createSpinner('Checking for updates...').start()

    try {
        // Fetch from database
        const query = db.prepare("SELECT id, json_config, cid FROM containers WHERE id = ?")
        const result = query.get(containerId) as any

        if (!result) {
            throw new Error(`Container with ID ${containerId} not found`)
        }

        const jsonConfig = JSON.parse(result.json_config)
        const cid = result.cid

        if (!cid) {
            throw new Error('Container has no Docker container ID. It may not have been created yet.')
        }

        spinner.update({ text: `Checking ${jsonConfig.name}...` })

        const updateCheck = await check_container_updates(cid)

        spinner.stop()

        console.log('')
        console.log(chalk.blue(`Container: ${jsonConfig.name}`))
        console.log(`  Current version: ${chalk.yellow(updateCheck.currentVersion)}`)
        console.log(`  Latest version:  ${chalk.green(updateCheck.latestVersion)}`)
        console.log(`  Update available: ${updateCheck.updateAvailable ? chalk.green('Yes') : chalk.gray('No')}`)
        console.log('')

        return updateCheck

    } catch (error: any) {
        spinner.error({ text: 'Check failed' })
        console.error('')
        console.error(chalk.red('error') + ': ' + (error.message || 'operation failed'))
        console.error('')
        throw error
    }
}
