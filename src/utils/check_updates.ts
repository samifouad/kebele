import { docker_request } from './docker_request'

// types
interface ImageInspectResponse {
    Id: string
    RepoDigests: string[]
    RepoTags: string[]
    Config?: {
        Labels?: {
            [key: string]: string
        }
    }
}

interface UpdateCheckResult {
    updateAvailable: boolean
    currentDigest: string | null
    latestDigest: string | null
    currentVersion: string
    latestVersion: string
}

/**
 * Check if a container's image has updates available
 * @param containerImage - The image name (e.g., "nginx:latest" or "ghcr.io/user/app:v1.0")
 * @returns UpdateCheckResult with information about available updates
 */
export async function check_updates(containerImage: string): Promise<UpdateCheckResult> {
    try {
        // Step 1: Get current local image information
        const inspectResponse = await docker_request<ImageInspectResponse>(
            `/images/${encodeURIComponent(containerImage)}/json`
        )

        if (!inspectResponse.statusCode || inspectResponse.statusCode !== 200) {
            throw new Error(`Failed to inspect image: HTTP ${inspectResponse.statusCode}`)
        }

        const currentImageInfo = inspectResponse.data
        const currentDigest = currentImageInfo.RepoDigests?.[0]?.split('@')[1] || null
        const currentVersion = currentImageInfo.Config?.Labels?.['org.opencontainers.image.version'] || 'unknown'

        // Step 2: Pull the latest version (with dry-run via image inspection)
        // First, pull the image to ensure we have the latest
        const pullResponse = await docker_request(
            `/images/create?fromImage=${encodeURIComponent(containerImage)}`,
            { method: 'POST' }
        )

        if (!pullResponse.statusCode || (pullResponse.statusCode !== 200 && pullResponse.statusCode !== 201)) {
            throw new Error(`Failed to pull latest image: HTTP ${pullResponse.statusCode}`)
        }

        // Step 3: Inspect the newly pulled image
        const latestInspectResponse = await docker_request<ImageInspectResponse>(
            `/images/${encodeURIComponent(containerImage)}/json`
        )

        if (!latestInspectResponse.statusCode || latestInspectResponse.statusCode !== 200) {
            throw new Error(`Failed to inspect latest image: HTTP ${latestInspectResponse.statusCode}`)
        }

        const latestImageInfo = latestInspectResponse.data
        const latestDigest = latestImageInfo.RepoDigests?.[0]?.split('@')[1] || null
        const latestVersion = latestImageInfo.Config?.Labels?.['org.opencontainers.image.version'] || 'unknown'

        // Step 4: Compare digests to determine if update is available
        const updateAvailable = currentDigest !== null && latestDigest !== null && currentDigest !== latestDigest

        return {
            updateAvailable,
            currentDigest,
            latestDigest,
            currentVersion,
            latestVersion
        }

    } catch (error: any) {
        console.error('Error checking for updates:', error.message || error)
        throw error
    }
}

/**
 * Check if updates are available for a specific container by ID
 * @param containerId - The container ID or name
 * @returns UpdateCheckResult
 */
export async function check_container_updates(containerId: string): Promise<UpdateCheckResult> {
    try {
        // Get container information
        const containerResponse = await docker_request(`/containers/${containerId}/json`)

        if (!containerResponse.statusCode || containerResponse.statusCode !== 200) {
            throw new Error(`Failed to get container info: HTTP ${containerResponse.statusCode}`)
        }

        const containerInfo = containerResponse.data
        const imageName = containerInfo.Config?.Image || containerInfo.Image

        if (!imageName) {
            throw new Error('Could not determine container image name')
        }

        // Check for updates using the image name
        return await check_updates(imageName)

    } catch (error: any) {
        console.error('Error checking container updates:', error.message || error)
        throw error
    }
}
