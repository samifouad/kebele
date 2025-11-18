import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

import * as utils from '@/utils'

// Use the user's home directory to store the application data
const getAppDataPath = path.join(os.homedir(), '.kebele')

const configPath = path.join(getAppDataPath, 'kb.json');

if (!fs.existsSync(getAppDataPath)) {
    fs.mkdirSync(getAppDataPath, { recursive: true });
}

export async function config() {
    await utils.welcome("config")

    // TODO: Implement configuration management
    // - Webhook settings
    // - Log levels
    // - Default container settings
}