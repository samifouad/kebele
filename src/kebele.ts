#!/usr/bin/env node

import { Command } from 'commander'
import * as core from './core/index'
import pkg from '../package.json'

const program = new Command()

program
    .name('kebele')
    .version(pkg.version)
    .description('https://kebele.dev')

program
    .command('add')
    .description('setup a new container')
    .action(async () => {
        await core.add()
    })

program
    .command('config')
    .description('configure runtime settings')
    .action(async () => {
        await core.config()
    })

program
    .command('status')
    .description('list all docker containers')
    .action(async () => {
        await core.status()
    })

program.parse()