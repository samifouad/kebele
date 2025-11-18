import http from 'http'

// types
interface DockerRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: string | object
    headers?: { [key: string]: string }
}

interface DockerResponse<T = any> {
    statusCode: number
    data: T
    headers: http.IncomingHttpHeaders
}

export async function docker_request<T = any>(
    path: string,
    options: DockerRequestOptions = {}
): Promise<DockerResponse<T>> {
    try {
        const socketPath = '/var/run/docker.sock'
        const method = options.method || 'GET'

        // Prepare request body
        let requestBody = ''
        if (options.body) {
            requestBody = typeof options.body === 'string'
                ? options.body
                : JSON.stringify(options.body)
        }

        // Define the request options
        const requestOptions: http.RequestOptions = {
            socketPath,
            path,
            method,
            headers: {
                Host: 'localhost',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody),
                ...options.headers,
            },
        }

        // Create an HTTP request
        const req = http.request(requestOptions)

        // Initialize response data as an empty string
        let responseData = ''

        // Send the request and wait for the response
        const response = await new Promise<DockerResponse<T>>((resolve, reject) => {
            req.on('response', (res) => {
                res.on('data', (chunk) => {
                    // Append data chunks to responseData
                    responseData += chunk
                })

                res.on('end', () => {
                    // Parse responseData as JSON if present
                    try {
                        const jsonResponse: DockerResponse<T> = {
                            statusCode: res.statusCode || 500,
                            data: responseData ? JSON.parse(responseData) : null,
                            headers: res.headers,
                        }

                        resolve(jsonResponse)
                    } catch (error) {
                        // If JSON parsing fails but request succeeded, return raw data
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({
                                statusCode: res.statusCode,
                                data: responseData as any,
                                headers: res.headers,
                            })
                        } else {
                            console.error('Error parsing JSON:', error)
                            reject(error)
                        }
                    }
                })
            })

            req.on('error', (error) => {
                console.error('Error:', error)
                reject({ message: 'error: unable to communicate' })
            })

            // Write request body if present
            if (requestBody) {
                req.write(requestBody)
            }

            req.end()
        })

        return response
    } catch (error) {
        console.error('Error:', error)
        throw { message: 'error: unable to establish comms' }
    }
}
