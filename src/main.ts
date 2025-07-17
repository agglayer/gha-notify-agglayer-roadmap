import * as core from '@actions/core'
import { graphql } from '@octokit/graphql'
import { WebClient } from '@slack/web-api'

interface ProjectItem {
  id: string
  title: string
  url: string
  status: string
  assignees: string[]
  labels: string[]
  createdAt: string
  updatedAt: string
  type: 'Issue' | 'DraftIssue' | 'PullRequest'
  repository?: string
  number?: number
  milestone?: string
  body?: string
  parentIssues: string[] // Issue numbers that this issue references/depends on
  childIssues: string[] // Issue numbers that reference this issue
  isCompleted?: boolean
}

interface ItemGroupings {
  [groupName: string]: ProjectItem[]
}

/**
 * Parse GitHub Project URL to extract owner, project number, and type
 */
function parseProjectUrl(url: string): {
  owner: string
  projectNumber: number
  isOrg: boolean
} {
  const match = url.match(/github\.com\/(orgs|users)\/([^/]+)\/projects\/(\d+)/)
  if (!match) {
    throw new Error(`Invalid project URL format: ${url}`)
  }

  const [, type, owner, projectNumber] = match
  return {
    owner,
    projectNumber: parseInt(projectNumber, 10),
    isOrg: type === 'orgs'
  }
}

/**
 * Fetch project data from GitHub GraphQL API
 */
async function fetchProjectData(
  token: string,
  owner: string,
  projectNumber: number,
  isOrg: boolean
): Promise<ProjectItem[]> {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`
    }
  })

  // Fetch all items with pagination
  const allItems: ProjectItem[] = []
  let hasNextPage = true
  let cursor: string | null = null
  let pageCount = 0

  try {
    while (hasNextPage) {
      pageCount++
      core.info(`Fetching page ${pageCount} of project items...`)
      const query = `
        query($owner: String!, $projectNumber: Int!, $after: String) {
          ${isOrg ? 'organization' : 'user'}(login: $owner) {
            projectV2(number: $projectNumber) {
              items(first: 100, after: $after) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                                nodes {
                  id
                  databaseId
                  updatedAt
                  fieldValues(first: 20) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldTextValue {
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                      text
                    }
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                      name
                    }
                    ... on ProjectV2ItemFieldUserValue {
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                      users(first: 10) {
                        nodes {
                          login
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                      date
                    }
                    ... on ProjectV2ItemFieldRepositoryValue {
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                  }
                }
                                  content {
                  __typename
                  ... on Issue {
                    title
                    url
                    number
                    body
                    createdAt
                    updatedAt
                    assignees(first: 10) {
                      nodes {
                        login
                      }
                    }
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                    milestone {
                      title
                    }
                    repository {
                      name
                    }
                  }
                  ... on PullRequest {
                    title
                    url
                    number
                    body
                    createdAt
                    updatedAt
                    assignees(first: 10) {
                      nodes {
                        login
                      }
                    }
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                    milestone {
                      title
                    }
                    repository {
                      name
                    }
                  }
                  ... on DraftIssue {
                    title
                    createdAt
                    updatedAt
                    assignees(first: 10) {
                      nodes {
                        login
                      }
                    }
                  }
                }
                }
              }
            }
          }
        }
      `

      const response = (await graphqlWithAuth(query, {
        owner,
        projectNumber,
        after: cursor
      })) as any

      const project = response[isOrg ? 'organization' : 'user']?.projectV2
      if (!project) {
        throw new Error(`Project not found: ${owner}/${projectNumber}`)
      }

      // Process items from this page
      for (const item of project.items.nodes) {
        // Handle items with null/undefined content but try to extract from field values
        if (!item.content) {
          core.info(
            `⚠️ Item with null content: ID=${item.id} | FieldValues: ${item.fieldValues?.nodes?.length || 0} | ProjectUpdatedAt: ${item.updatedAt}`
          )

          // Try to extract information from field values
          let title = 'Unknown Title'
          let status = 'Unknown'
          let milestone: string | undefined = undefined
          const assignees: string[] = []

          // Use the project item's updatedAt as the best proxy for when status was changed
          let createdAt = item.updatedAt || new Date().toISOString()
          let updatedAt = item.updatedAt || new Date().toISOString()

          // Extract itemId - use databaseId if available, otherwise full GraphQL ID
          const itemId = item.databaseId || item.id
          core.info(
            `🔍 Item ID: ${itemId} (databaseId: ${item.databaseId}, id: ${item.id}) for "${title}"`
          )
          const baseUrl = isOrg
            ? `https://github.com/orgs/${owner}/projects/${projectNumber}`
            : `https://github.com/users/${owner}/projects/${projectNumber}`
          let itemUrl = `${baseUrl}?pane=issue&itemId=${itemId}`

          if (item.fieldValues?.nodes) {
            // Process field values
            for (const fieldValue of item.fieldValues.nodes) {
              const fieldName = fieldValue.field?.name
              // Only log field details for debugging assignees
              if (fieldName === 'Assignees') {
                core.info(
                  `Field: ${fieldName} | Value type: ${fieldValue.__typename}`
                )
              }

              // Log useful field information
              if (fieldValue.date) {
                core.info(
                  `📅 Date field found: ${fieldName} = ${fieldValue.date}`
                )
              }

              if (fieldName === 'Title') {
                title = fieldValue.text || fieldValue.name || title
              } else if (fieldName === 'Status') {
                status = fieldValue.name || fieldValue.text || status
              } else if (fieldName === 'Milestone') {
                milestone = fieldValue.text || fieldValue.name
              } else if (fieldName === 'Assignees') {
                // Extract assignees from the field value
                if (fieldValue.users?.nodes) {
                  const userLogins = fieldValue.users.nodes.map(
                    (user: any) => user.login
                  )
                  assignees.push(...userLogins)
                  core.info(`👤 Found assignees: ${userLogins.join(', ')}`)
                } else if (fieldValue.text) {
                  // Handle text-based assignee field
                  assignees.push(fieldValue.text)
                  core.info(`👤 Found assignee (text): ${fieldValue.text}`)
                }
              } else if (
                fieldName === 'Created' ||
                fieldName === 'Date created'
              ) {
                createdAt = fieldValue.date || fieldValue.text || createdAt
              } else if (
                fieldName === 'Updated' ||
                fieldName === 'Date updated' ||
                fieldName === 'Last updated'
              ) {
                updatedAt = fieldValue.date || fieldValue.text || updatedAt
              }
            }
          }

          // Note: Using project item's updatedAt as the best available proxy for completion time

          core.info(
            `📝 Processing item from field values: "${title}" | Status: ${status}`
          )
          core.info(
            `📅 Dates - Using project item updatedAt: ${updatedAt} (this represents when the item was last modified in the project)`
          )

          allItems.push({
            id: item.id,
            title,
            url: itemUrl,
            status,
            assignees,
            labels: [],
            createdAt,
            updatedAt,
            type: 'DraftIssue', // assume draft for items without content
            repository: undefined,
            number: undefined,
            milestone,
            body: undefined,
            parentIssues: [],
            childIssues: [],
            isCompleted:
              status.toLowerCase().includes('done') ||
              status.toLowerCase().includes('complete') ||
              status.toLowerCase().includes('finished')
          })
          continue
        }

        core.info(
          `📝 Processing item: ${item.content.title || 'No title'} (Type: ${item.content.__typename || 'Unknown'}) | Content keys: ${Object.keys(item.content).join(', ')}`
        )

        const content = item.content
        const assignees =
          content.assignees?.nodes?.map((a: any) => a.login) || []
        const labels = content.labels?.nodes?.map((l: any) => l.name) || []
        const milestone = content.milestone?.title

        // Get status from field values
        let status = 'Unknown'
        for (const fieldValue of item.fieldValues.nodes) {
          if (fieldValue.field?.name === 'Status') {
            status = fieldValue.name || fieldValue.text || 'Unknown'
            break
          }
        }

        let type: 'Issue' | 'DraftIssue' | 'PullRequest'
        if (content.__typename === 'Issue') {
          type = 'Issue'
        } else if (content.__typename === 'PullRequest') {
          type = 'PullRequest'
        } else {
          type = 'DraftIssue'
        }

        // Construct project URL with item opened in right pane
        const baseUrl = isOrg
          ? `https://github.com/orgs/${owner}/projects/${projectNumber}`
          : `https://github.com/users/${owner}/projects/${projectNumber}`
        const itemId = item.databaseId || item.id
        const itemUrl = `${baseUrl}?pane=issue&itemId=${itemId}`

        allItems.push({
          id: item.id,
          title: content.title,
          url: itemUrl,
          status,
          assignees,
          labels,
          createdAt: content.createdAt,
          updatedAt: content.updatedAt,
          type,
          repository: content.repository?.name,
          number: content.number,
          milestone,
          body: content.body,
          parentIssues: [],
          childIssues: [],
          isCompleted:
            status.toLowerCase().includes('done') ||
            status.toLowerCase().includes('complete') ||
            status.toLowerCase().includes('finished')
        })
      }

      // Update pagination variables
      hasNextPage = project.items.pageInfo.hasNextPage
      cursor = project.items.pageInfo.endCursor

      const itemsWithContent = project.items.nodes.filter(
        (item: any) => item.content
      ).length
      const itemsWithoutContent = project.items.nodes.length - itemsWithContent
      core.info(
        `Page ${pageCount}: Found ${project.items.nodes.length} items (${itemsWithContent} with content, ${itemsWithoutContent} without). Total processed so far: ${allItems.length}. HasNextPage: ${hasNextPage}`
      )
    }

    core.info(
      `✅ Pagination complete! Fetched ${allItems.length} total items across ${pageCount} pages`
    )
    return allItems
  } catch (error) {
    core.error(`Error fetching project data: ${error}`)
    throw error
  }
}

/**
 * Get emoji for item status
 */
function getStatusEmoji(status: string): string {
  const statusLower = status.toLowerCase()
  if (
    statusLower.includes('todo') ||
    statusLower.includes('to do') ||
    statusLower.includes('backlog')
  ) {
    return '📋'
  }
  if (
    statusLower.includes('progress') ||
    statusLower.includes('doing') ||
    statusLower.includes('active')
  ) {
    return '🚧'
  }
  if (
    statusLower.includes('done') ||
    statusLower.includes('complete') ||
    statusLower.includes('finished')
  ) {
    return '✅'
  }
  return '📝' // Default for unknown status
}

/**
 * Get status priority for sorting (lower number = higher priority)
 */
function getStatusPriority(status: string): number {
  const statusLower = status.toLowerCase()
  if (
    statusLower.includes('todo') ||
    statusLower.includes('to do') ||
    statusLower.includes('backlog')
  ) {
    return 1 // Todo first
  }
  if (
    statusLower.includes('progress') ||
    statusLower.includes('doing') ||
    statusLower.includes('active')
  ) {
    return 2 // In Progress second
  }
  if (
    statusLower.includes('done') ||
    statusLower.includes('complete') ||
    statusLower.includes('finished')
  ) {
    return 3 // Done last
  }
  return 4 // Unknown status last
}

/**
 * Check if an item should be included in the output
 * - Always include Todo and In Progress items
 * - Only include Done items if completed within the specified time window
 */
function shouldIncludeItem(item: ProjectItem, doneItemsDays: number): boolean {
  const statusLower = item.status.toLowerCase()
  const isDone =
    statusLower.includes('done') ||
    statusLower.includes('complete') ||
    statusLower.includes('finished')

  // Debug logging for Done items only
  if (isDone) {
    core.info(
      `Item: "${item.title}" | Status: "${item.status}" | isDone: ${isDone}`
    )
  }

  if (!isDone) {
    return true // Always include non-Done items (Todo, In Progress, etc.)
  }

  // For Done items, only include if completed within specified days
  const now = new Date()
  const updatedAt = new Date(item.updatedAt)
  const hoursDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60)
  const daysDiff = hoursDiff / 24

  const shouldInclude = daysDiff <= doneItemsDays
  core.info(
    `Done item: "${item.title}" | Days since update: ${daysDiff.toFixed(1)} | Threshold: ${doneItemsDays} days | Including: ${shouldInclude}`
  )

  return shouldInclude
}

/**
 * Format date for display (UTC)
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  })
}

/**
 * Process issue relationships to build parent-child trees
 */
function processIssueRelationships(items: ProjectItem[]): ProjectItem[] {
  // Create a map for quick lookup by repository and issue number
  const issueMap = new Map<string, ProjectItem>()

  // First pass: build the issue map
  for (const item of items) {
    if (item.type === 'Issue' && item.repository && item.number) {
      const key = `${item.repository}#${item.number}`
      issueMap.set(key, item)
    }
  }

  // Second pass: parse issue bodies for references and build relationships
  core.info(`🔍 Starting relationship processing for ${items.length} items`)
  core.info(
    `📋 Item types: ${items.map((i) => `${i.type}(${i.body ? 'has body' : 'no body'})`).join(', ')}`
  )

  for (const item of items) {
    if (item.body && (item.type === 'Issue' || item.type === 'PullRequest')) {
      core.info(
        `🔍 Processing issue ${item.repository}#${item.number}: "${item.title}"`
      )
      core.info(`📝 Body length: ${item.body.length} characters`)

      // Parse issue references in the body (e.g., #123, repo#123, fixes #123, closes #123)
      const issueRefRegex =
        /(?:(?:fixes|closes|resolves|related to|see)\s+)?(?:([a-zA-Z0-9-]+)#)?(\d+)/gi
      let match

      while ((match = issueRefRegex.exec(item.body)) !== null) {
        const referencedRepo = match[1] || item.repository // Use current repo if not specified
        const referencedNumber = match[2]
        const referencedKey = `${referencedRepo}#${referencedNumber}`

        const referencedIssue = issueMap.get(referencedKey)
        if (referencedIssue && referencedIssue.id !== item.id) {
          // This item references another issue
          if (!item.parentIssues.includes(referencedKey)) {
            item.parentIssues.push(referencedKey)
            core.info(
              `🔗 Found relationship: ${item.repository}#${item.number} references ${referencedKey}`
            )
          }

          // The referenced issue has this as a child
          if (
            !referencedIssue.childIssues.includes(
              `${item.repository}#${item.number}`
            )
          ) {
            referencedIssue.childIssues.push(
              `${item.repository}#${item.number}`
            )
            core.info(
              `👶 ${referencedKey} now has child: ${item.repository}#${item.number}`
            )
          }
        } else {
          core.info(`❌ No match found for reference: ${referencedKey}`)
        }
      }
    }
  }

  // Log final relationship counts
  const itemsWithChildren = items.filter((item) => item.childIssues.length > 0)
  const itemsWithParents = items.filter((item) => item.parentIssues.length > 0)

  core.info(`📊 Relationship summary:`)
  core.info(`   ${itemsWithChildren.length} parent issues (have children)`)
  core.info(`   ${itemsWithParents.length} child issues (have parents)`)

  for (const parent of itemsWithChildren) {
    core.info(
      `👨‍👩‍👧‍👦 ${parent.repository}#${parent.number} has ${parent.childIssues.length} children: ${parent.childIssues.join(', ')}`
    )
  }

  return items
}

/**
 * Calculate progress percentage for an issue with child issues
 */
function calculateProgress(item: ProjectItem, allItems: ProjectItem[]): number {
  if (item.childIssues.length === 0) return 100 // No children, consider complete based on status

  let completedChildren = 0
  for (const childKey of item.childIssues) {
    const childItem = allItems.find(
      (i) =>
        i.repository && i.number && `${i.repository}#${i.number}` === childKey
    )
    if (childItem?.isCompleted) {
      completedChildren++
    }
  }

  return Math.round((completedChildren / item.childIssues.length) * 100)
}

/**
 * Create a progress bar visualization
 */
function createProgressBar(percentage: number, length: number = 10): string {
  const filled = Math.round((percentage / 100) * length)
  const empty = length - filled
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage}%`
}

/**
 * Group items by milestones and filter/sort them
 */
function groupItemsByMilestones(
  items: ProjectItem[],
  doneItemsDays: number
): ItemGroupings {
  const milestoneGroups: ItemGroupings = {}

  // First, group all items by milestones (without filtering)
  for (const item of items) {
    const milestone = item.milestone || 'No Milestone'

    if (!milestoneGroups[milestone]) {
      milestoneGroups[milestone] = []
    }
    milestoneGroups[milestone].push(item)
  }

  // Debug: log milestones before filtering
  core.info(
    `Milestones before filtering: ${Object.keys(milestoneGroups).join(', ')}`
  )
  for (const milestone in milestoneGroups) {
    core.info(
      `${milestone}: ${milestoneGroups[milestone].length} items (${milestoneGroups[milestone].map((item: any) => item.status).join(', ')})`
    )
  }

  // Now filter items within each milestone's list - only show Done items if completed within specified days
  for (const milestone in milestoneGroups) {
    const beforeCount = milestoneGroups[milestone].length
    milestoneGroups[milestone] = milestoneGroups[milestone].filter(
      (item: any) => shouldIncludeItem(item, doneItemsDays)
    )
    const afterCount = milestoneGroups[milestone].length

    core.info(
      `${milestone}: ${beforeCount} items → ${afterCount} items after filtering`
    )

    // Remove milestones that have no items left after filtering
    if (milestoneGroups[milestone].length === 0) {
      core.info(`Removing ${milestone} - no items left after filtering`)
      delete milestoneGroups[milestone]
    }
  }

  // Debug: log milestones after filtering
  core.info(
    `Milestones after filtering: ${Object.keys(milestoneGroups).join(', ')}`
  )

  // Sort items within each milestone by status priority
  for (const milestone in milestoneGroups) {
    milestoneGroups[milestone].sort((a: any, b: any) => {
      const priorityA = getStatusPriority(a.status)
      const priorityB = getStatusPriority(b.status)
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      // If same status priority, sort by updated date (newest first)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }

  return milestoneGroups
}

/**
 * Format items for Slack message with tree structure and progress bars
 */
function formatSlackMessage(
  itemGroupings: ItemGroupings,
  maxItemsPerUser: number
): string {
  const sections: string[] = []

  // Sort milestones alphabetically, but put "No Milestone" at the end
  const sortedGroups = Object.keys(itemGroupings).sort((a, b) => {
    if (a === 'No Milestone') return 1
    if (b === 'No Milestone') return -1
    return a.localeCompare(b)
  })

  for (const group of sortedGroups) {
    const items = itemGroupings[group]
    const displayItems = items.slice(0, maxItemsPerUser)
    const hasMore = items.length > maxItemsPerUser

    const groupSection = [`*${group}* (${items.length} items):`]

    // Separate parent issues from child issues for tree structure
    const parentIssues = displayItems.filter(
      (item) => item.childIssues.length > 0
    )
    const childIssues = displayItems.filter(
      (item) => item.childIssues.length === 0
    )
    const allItems = Object.values(itemGroupings).flat()

    // First, show parent issues with progress bars and their children
    for (const parentItem of parentIssues) {
      const statusEmoji = getStatusEmoji(parentItem.status)
      const repoInfo = parentItem.repository
        ? `[${parentItem.repository}${parentItem.number ? `#${parentItem.number}` : ''}]`
        : ''

      // Calculate progress and create progress bar
      const progress = calculateProgress(parentItem, allItems)
      const progressBar = createProgressBar(progress, 8)

      // Add completion date for Done items
      const isDone = parentItem.isCompleted
      const completionInfo = isDone
        ? ` (${formatDate(parentItem.updatedAt)})`
        : ''

      groupSection.push(
        `  ${statusEmoji} <${parentItem.url}|${parentItem.title}>${completionInfo} ${repoInfo}`
      )
      groupSection.push(
        `    📊 ${progressBar} (${parentItem.childIssues.length} sub-issues)`
      )

      // Show child issues under this parent (if they're in the current milestone)
      for (const childKey of parentItem.childIssues) {
        const childItem = displayItems.find(
          (item) =>
            item.repository &&
            item.number &&
            `${item.repository}#${item.number}` === childKey
        )

        if (childItem) {
          const childStatusEmoji = getStatusEmoji(childItem.status)
          const childRepoInfo = childItem.repository
            ? `[${childItem.repository}${childItem.number ? `#${childItem.number}` : ''}]`
            : ''
          const childCompletionInfo = childItem.isCompleted
            ? ` (${formatDate(childItem.updatedAt)})`
            : ''

          groupSection.push(
            `    ├─ ${childStatusEmoji} <${childItem.url}|${childItem.title}>${childCompletionInfo} ${childRepoInfo}`
          )
        }
      }
    }

    // Then show standalone child issues (those without parents in this milestone)
    const standaloneChildren = childIssues.filter((item) => {
      // Check if any of its parent issues are already shown in this milestone
      const hasParentInMilestone = item.parentIssues.some((parentKey) =>
        parentIssues.some(
          (parent) =>
            parent.repository &&
            parent.number &&
            `${parent.repository}#${parent.number}` === parentKey
        )
      )
      return !hasParentInMilestone
    })

    for (const item of standaloneChildren) {
      const statusEmoji = getStatusEmoji(item.status)
      const statusBadge = item.status !== 'Unknown' ? `${item.status}` : ''
      const repoInfo = item.repository
        ? `[${item.repository}${item.number ? `#${item.number}` : ''}]`
        : ''
      const completionInfo = item.isCompleted
        ? ` (${formatDate(item.updatedAt)})`
        : ''

      groupSection.push(
        `  ${statusEmoji} ${statusBadge} <${item.url}|${item.title}>${completionInfo} ${repoInfo}`
      )
    }

    if (hasMore) {
      groupSection.push(
        `  _... and ${items.length - maxItemsPerUser} more items_`
      )
    }

    sections.push(groupSection.join('\n'))
  }

  const totalItems = Object.values(itemGroupings).reduce(
    (sum: number, items: any) => sum + items.length,
    0
  )
  const groupCount = Object.keys(itemGroupings).length
  const groupType = 'milestones'

  const header = `📋 *Roadmap Summary*\n${totalItems} items across ${groupCount} ${groupType}\n`

  return header + '\n' + sections.join('\n\n')
}

/**
 * Send message to Slack
 */
async function sendSlackMessage(
  botToken: string,
  channel: string,
  message: string
): Promise<void> {
  const slack = new WebClient(botToken)

  try {
    await slack.chat.postMessage({
      channel,
      text: message,
      username: 'Agglayer Github Project Notifier',
      icon_emoji: ':github:'
    })
  } catch (error) {
    core.error(`Error sending Slack message: ${error}`)
    throw error
  }
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get inputs
    const githubToken = core.getInput('github-token')
    const projectUrl = core.getInput('project-url')
    const slackBotToken = core.getInput('slack-bot-token')
    const slackChannel = core.getInput('slack-channel')
    const maxItemsPerUser = parseInt(core.getInput('max-items-per-user'), 10)
    const doneItemsDays = parseInt(core.getInput('done-items-days'), 10)

    // Validate inputs
    if (!githubToken || !projectUrl || !slackBotToken || !slackChannel) {
      throw new Error(
        'Missing required inputs: github-token, project-url, slack-bot-token, and slack-channel are required'
      )
    }

    core.info('🚀 Starting GitHub Projects to Slack summary...')

    // Parse project URL
    const { owner, projectNumber, isOrg } = parseProjectUrl(projectUrl)
    core.info(
      `📊 Fetching project data for ${owner}/${projectNumber} (${isOrg ? 'organization' : 'user'})`
    )

    // Fetch project data
    const items = await fetchProjectData(
      githubToken,
      owner,
      projectNumber,
      isOrg
    )
    core.info(`📥 Retrieved ${items.length} items from project`)

    // Process parent-child relationships
    const processedItems = processIssueRelationships(items)

    // Group items by milestones
    const itemGroupings = groupItemsByMilestones(processedItems, doneItemsDays)
    const groupCount = Object.keys(itemGroupings).length
    core.info(`🎯 Found ${groupCount} milestones`)

    // Format message with tree structure and progress bars
    const message = formatSlackMessage(itemGroupings, maxItemsPerUser)

    // Send to Slack
    core.info('📤 Sending message to Slack...')
    await sendSlackMessage(slackBotToken, slackChannel, message)

    // Set outputs
    core.setOutput('summary-sent', 'true')
    core.setOutput('total-items', items.length.toString())
    core.setOutput('users-count', groupCount.toString())

    core.info('✅ Summary sent successfully!')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred')
    }
  }
}
