/**
 * Unit tests for the action's main functionality, src/main.ts
 */

import { jest } from '@jest/globals'
import * as core from '@actions/core'
import * as main from '../src/main'

// Mock the GitHub Actions core library
let debugMock: any
let errorMock: any
let getInputMock: any
let infoMock: any
let setFailedMock: any
let setOutputMock: any

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    debugMock = jest.spyOn(core, 'debug').mockImplementation(() => {})
    errorMock = jest.spyOn(core, 'error').mockImplementation(() => {})
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation(() => '')
    infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation(() => {})
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation(() => {})
  })

  it('should require github-token input', async () => {
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'github-token':
          return ''
        case 'project-url':
          return 'https://github.com/orgs/test/projects/1'
        case 'slack-bot-token':
          return 'xoxb-test-token'
        case 'slack-channel':
          return '#test-channel'
        case 'max-items-per-user':
          return '10'
        default:
          return ''
      }
    })

    await main.run()

    expect(setFailedMock).toHaveBeenCalledWith(
      'Missing required inputs: github-token, project-url, slack-bot-token, and slack-channel are required'
    )
  })

  it('should require project-url input', async () => {
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'github-token':
          return 'ghp_test'
        case 'project-url':
          return ''
        case 'slack-bot-token':
          return 'xoxb-test-token'
        case 'slack-channel':
          return '#test-channel'
        case 'max-items-per-user':
          return '10'
        default:
          return ''
      }
    })

    await main.run()

    expect(setFailedMock).toHaveBeenCalledWith(
      'Missing required inputs: github-token, project-url, slack-bot-token, and slack-channel are required'
    )
  })

  it('should require slack-bot-token input', async () => {
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'github-token':
          return 'ghp_test'
        case 'project-url':
          return 'https://github.com/orgs/test/projects/1'
        case 'slack-bot-token':
          return ''
        case 'slack-channel':
          return '#test-channel'
        case 'max-items-per-user':
          return '10'
        default:
          return ''
      }
    })

    await main.run()

    expect(setFailedMock).toHaveBeenCalledWith(
      'Missing required inputs: github-token, project-url, slack-bot-token, and slack-channel are required'
    )
  })

  it('should require slack-channel input', async () => {
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'github-token':
          return 'ghp_test'
        case 'project-url':
          return 'https://github.com/orgs/test/projects/1'
        case 'slack-bot-token':
          return 'xoxb-test-token'
        case 'slack-channel':
          return ''
        case 'max-items-per-user':
          return '10'
        default:
          return ''
      }
    })

    await main.run()

    expect(setFailedMock).toHaveBeenCalledWith(
      'Missing required inputs: github-token, project-url, slack-bot-token, and slack-channel are required'
    )
  })

  it('should fail on invalid project URL format', async () => {
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'github-token':
          return 'ghp_test'
        case 'project-url':
          return 'https://invalid-url'
        case 'slack-bot-token':
          return 'xoxb-test-token'
        case 'slack-channel':
          return '#test-channel'
        case 'max-items-per-user':
          return '10'
        default:
          return ''
      }
    })

    await main.run()

    expect(setFailedMock).toHaveBeenCalledWith(
      'Invalid project URL format: https://invalid-url'
    )
  })

  // Note: Testing the full GraphQL flow would require complex mocking
  // The above tests validate input parsing and error handling
})
