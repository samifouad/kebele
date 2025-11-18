import { createSpinner } from 'nanospinner'
import chalk from 'chalk'

import { db } from '@/core'
import { docker_request, sleep } from '@/utils'

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

interface CreateContainerResponse {
    Id: string
    Warnings: string[] | null
}

export async function docker(config: ContainerConfig) {
    const spinner = createSpinner('Creating container...').start()

    try {
        // Step 1: Pull the image
        spinner.update({ text: `Pulling image ${config.url}...` })

        const pullResponse = await docker_request(`/images/create?fromImage=${encodeURIComponent(config.url)}`, {
            method: 'POST'
        })

        if (!pullResponse.statusCode || (pullResponse.statusCode !== 200 && pullResponse.statusCode !== 201)) {
            throw new Error(`Failed to pull image: HTTP ${pullResponse.statusCode}`)
        }

        await sleep(500)

        // Step 2: Create the container with port mappings
        spinner.update({ text: `Creating container ${config.name}...` })

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

        const createResponse = await docker_request<CreateContainerResponse>(
            `/containers/create?name=${encodeURIComponent(config.name)}`,
            {
                method: 'POST',
                body: createConfig
            }
        )

        if (!createResponse.statusCode || (createResponse.statusCode !== 200 && createResponse.statusCode !== 201)) {
            throw new Error(`Failed to create container: HTTP ${createResponse.statusCode}`)
        }

        const containerId = createResponse.data.Id

        await sleep(300)

        // Step 3: Start the container
        spinner.update({ text: `Starting container ${config.name}...` })

        const startResponse = await docker_request(`/containers/${containerId}/start`, {
            method: 'POST'
        })

        if (!startResponse.statusCode || (startResponse.statusCode !== 204 && startResponse.statusCode !== 200)) {
            throw new Error(`Failed to start container: HTTP ${startResponse.statusCode}`)
        }

        await sleep(300)

        // Step 4: Get container details
        const inspectResponse = await docker_request(`/containers/${containerId}/json`)

        if (!inspectResponse.statusCode || inspectResponse.statusCode !== 200) {
            throw new Error(`Failed to inspect container: HTTP ${inspectResponse.statusCode}`)
        }

        const containerInfo = inspectResponse.data

        // Step 5: Update database with runtime information
        const runtimeInfo = {
            cid: containerId,
            version: containerInfo.Config?.Labels?.['org.opencontainers.image.version'] || 'unknown',
            status: containerInfo.State?.Status || 'unknown',
            public: 'no', // TODO: Implement public detection
            protocol: 'http' // TODO: Make this configurable
        }

        const updateQuery = db.prepare(
            "UPDATE containers SET json_runtime = json(?) WHERE id = ?"
        )

        updateQuery.run(JSON.stringify(runtimeInfo), config.id)

        spinner.success({ text: `Container ${chalk.green(config.name)} created and started successfully!` })

    } catch (error: any) {
        spinner.error({ text: 'Failed to create container' })
        console.error('')
        console.error(chalk.red('error') + ': ' + (error.message || 'operation failed'))
        console.error('')
        console.error('please try again or report issues at https://kebele.dev')
        console.error('')
        throw error
    }
}