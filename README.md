# Agglayer Roadmap Summaries to Slack

[![GitHub Super-Linter](https://github.com/actions/typescript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

A specialized GitHub Action that publishes summaries of the Agglayer Roadmap GitHub repository project to Slack, with intelligent milestone-based grouping, issue tree structures, and progress tracking for effective roadmap management.

## Features

- 📋 **Roadmap Summaries**: Fetches all items from the Agglayer Roadmap GitHub repository project (V2)
- 🎯 **Milestone Grouping**: Organizes roadmap items by milestones for strategic overview
- 🌳 **Issue Tree Structure**: Shows parent-child relationships between issues with visual hierarchy
- 📊 **Progress Tracking**: Displays progress bars for parent issues based on completed sub-issues
- 🔗 **Cross-Repository**: Aggregates issues and sub-issues from multiple repositories
- 🔄 **Multiple Item Types**: Supports Issues, Pull Requests, and Draft Issues
- 📱 **Slack Integration**: Pre-configured for Agglayer with secure Slack Bot integration
- ⚙️ **Roadmap-Optimized**: Configurable filters for active vs completed milestones
- 🗓️ **Smart Filtering**: Shows recently completed items while focusing on active work

## Usage

### Basic Roadmap Summary with Tree Structure

```yaml
name: Agglayer Roadmap Summary
on:
  schedule:
    - cron: '0 9 * * 1-5' # Monday-Friday at 9 AM
  workflow_dispatch: # Allow manual triggering

permissions:
  contents: read

jobs:
  roadmap-summary:
    runs-on: ubuntu-latest
    steps:
      - name: Send Roadmap Summary to Slack
        uses: agglayer/gha-notify-agglayer-roadmap@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          project-url: 'https://github.com/orgs/agglayer/projects/1'
          slack-bot-token: ${{ secrets.SLACK_APP_TOKEN_AGGLAYER_NOTIFY_ROADMAP }}
          slack-channel: '#roadmap-updates'
          done-items-days: '3'  # Show completed items from last 3 days
```

### Daily Team Summary

```yaml
name: Daily Team Summary
on:
  schedule:
    - cron: '0 9 * * 1-5' # Monday-Friday at 9 AM
  workflow_dispatch:

permissions:
  contents: read

jobs:
  team-summary:
    runs-on: ubuntu-latest
    steps:
      - name: Send Team Summary to Slack
        uses: agglayer/gha-notify-agglayer-roadmap@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          project-url: 'https://github.com/orgs/agglayer/projects/1'
          slack-bot-token: ${{ secrets.SLACK_APP_TOKEN_AGGLAYER_NOTIFY_ROADMAP }}
          slack-channel: '#standup'
          max-items-per-user: '5'
          done-items-days: '1'  # Show yesterday's completions
```

## Inputs

| Input                | Description                                                         | Required | Default     |
| -------------------- | ------------------------------------------------------------------- | -------- | ----------- |
| `github-token`       | GitHub token with access to read repository projects                | ✅       |             |
| `project-url`        | Agglayer Roadmap repository project URL                             | ✅       |             |
| `slack-bot-token`    | Slack Bot Token (use SLACK_APP_TOKEN_AGGLAYER_NOTIFY_ROADMAP)       | ✅       |             |
| `slack-channel`      | Slack channel to post to (e.g., #roadmap-updates)                  | ✅       |             |
| `assignee-field`     | Name of the assignee field in the project                           | ❌       | `Assignees` |
| `max-items-per-user` | Maximum number of items to show per milestone                       | ❌       | `10`        |
| `done-items-days`    | Show Done items only if completed within this many days             | ❌       | `1`         |

## Outputs

| Output         | Description                                        |
| -------------- | -------------------------------------------------- |
| `summary-sent` | Whether the roadmap summary was successfully sent to Slack |
| `total-items`  | Total number of roadmap items processed            |
| `users-count`  | Number of milestones with items                    |

## Agglayer-Optimized Setup

### Quick Start for Agglayer Team

This action is pre-configured for the Agglayer organization - you can use it immediately:

```yaml
- name: Send Roadmap Summary to Slack
  uses: agglayer/gha-notify-agglayer-roadmap@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    project-url: 'https://github.com/orgs/agglayer/projects/1'
    slack-bot-token: ${{ secrets.SLACK_APP_TOKEN_AGGLAYER_NOTIFY_ROADMAP }}
    slack-channel: '#your-channel'
    done-items-days: '3'  # Show recent completions for context
```

Just invite the bot to your desired channel with `/invite @Agglayer Github Project Notifier` and you're ready to go!

### GitHub Token Setup

The action requires a GitHub token with access to the Agglayer roadmap repository project:

#### Using GITHUB_TOKEN (Recommended)

For repository projects, the default `GITHUB_TOKEN` works well:

```yaml
permissions:
  contents: read
```

#### Alternative: Personal Access Token

If you encounter access issues, create a personal access token with:
- `repo` (to access repository resources)
- `read:project` (to read project data)

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Create a token with the above permissions
3. Add it as a repository secret named `GITHUB_PAT`
4. Use `github-token: ${{ secrets.GITHUB_PAT }}` in your workflow

## Troubleshooting

### "Could not resolve to a ProjectV2 with the number X"

This error typically means:
1. **Project doesn't exist**: Verify the Agglayer repository project URL is correct
2. **Token permissions**: Ensure your token has `repo` and `read:project` permissions
3. **Project URL**: Verify the correct project URL format: `https://github.com/orgs/agglayer/projects/1`
4. **Repository access**: Ensure your token has access to the repository

### Channel Setup

**Important**: The bot must be manually invited to each channel before it can post messages. Use `/invite @Agglayer Github Project Notifier` in the target channel.

Supported channel formats:
- Channel name: `#roadmap-updates`
- Channel ID: `C1234567890`

## Tree Structure and Progress Tracking

The action automatically organizes issues into parent-child relationships and displays progress bars for parent issues:

### Issue Tree Structure

Issues are organized hierarchically based on references in issue bodies:
- **Parent Issues**: Issues that have sub-issues (child issues) 
- **Child Issues**: Issues that reference parent issues using keywords like "fixes", "closes", "relates to"
- **Progress Bars**: Visual representation of completion percentage for parent issues

### Cross-Repository Support

The action aggregates issues from multiple repositories within the roadmap project, maintaining relationships even when parent and child issues are in different repositories.

## Roadmap Management Benefits

This action is specifically designed for effective roadmap management with advanced project tracking:

- **Strategic Overview**: Milestone grouping provides a high-level view of roadmap progress
- **Issue Hierarchy**: Visual tree structure shows parent-child relationships between issues
- **Progress Tracking**: Real-time progress bars for parent issues based on completed sub-issues
- **Cross-Repository**: Aggregates roadmap items across all repositories while maintaining relationships
- **Timeline Tracking**: See which milestones are progressing and which need attention
- **Completion Momentum**: Track progress by showing recently completed items with timestamps

## Example Output

### Roadmap Summary with Tree Structure and Progress Bars

The action will send a message to Slack that looks like this:

```
📋 Roadmap Summary
18 items across 5 milestones

Q1 2024 - Core Protocol (6 items):
  🚧 Consensus algorithm optimization [consensus#123]
    📊 ████████░░ 80% (5 sub-issues)
    ├─ ✅ Implement consensus rules [consensus#124] (Jan 14, 16:45 UTC)
    ├─ ✅ Add validation tests [consensus#125] (Jan 15, 09:30 UTC)
    ├─ ✅ Update documentation [consensus#126] (Jan 15, 14:20 UTC)
    ├─ ✅ Performance benchmarks [consensus#127] (Jan 16, 11:15 UTC)
    ├─ 🚧 Security review [consensus#128]
  
  📋 Todo Network layer improvements [network#456]
    📊 ██░░░░░░░░ 20% (10 sub-issues)
    ├─ ✅ Protocol specification [network#457] (Jan 10, 10:30 UTC)
    ├─ ✅ Basic implementation [network#458] (Jan 12, 15:45 UTC)
    ├─ 🚧 Peer discovery [network#459]
    ├─ 📋 Todo Message routing [network#460]
    ... and 6 more items

Q1 2024 - Developer Tools (4 items):
  🚧 SDK v2 development [sdk#234]
    📊 ██████░░░░ 60% (3 sub-issues)
    ├─ ✅ Core API design [sdk#235] (Jan 13, 12:00 UTC)
    ├─ ✅ TypeScript types [sdk#236] (Jan 14, 16:30 UTC)
    ├─ 🚧 Documentation [sdk#237]
  
  📋 Todo CLI tool enhancements [tools#567]

No Milestone (2 items):
  📋 Todo CI/CD pipeline updates [infra#567]
  🚧 Bug fixes and maintenance [maintenance#890]
```

## Development

### Prerequisites

- Node.js 20.x or later
- npm
- Access to Agglayer GitHub organization (for testing)

### Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the action:

   ```bash
   npm run bundle
   ```

4. Run tests:
   ```bash
   npm test
   ```

### Local Testing

Test the action locally with the Agglayer roadmap organization project:

```bash
# Set up environment variables for Agglayer roadmap organization project
export INPUT_GITHUB_TOKEN="your-github-token"  # Use PAT for organization projects
export INPUT_PROJECT_URL="https://github.com/orgs/agglayer/projects/1"
export INPUT_SLACK_BOT_TOKEN="xoxb-your-bot-token"
export INPUT_SLACK_CHANNEL="#test-channel"
export INPUT_GROUPING_MODE="milestone"  # Test milestone grouping
export INPUT_DONE_ITEMS_DAYS="3"

# Run the action locally
npm run local-action
```

### Testing Milestone Functionality

To test the milestone grouping feature:

1. Ensure your test project has items with milestones assigned
2. Set `INPUT_GROUPING_MODE="milestone"`
3. Run the action and verify items are grouped by milestone
4. Check that "No Milestone" items are properly grouped

## Contributing

Contributions are welcome! This project is specifically designed for Agglayer's roadmap management needs with GitHub organization projects. When contributing:

1. Consider the roadmap management use case for organization projects
2. Test with milestone grouping functionality
3. Ensure compatibility with Agglayer's organization project structure
4. Test with Personal Access Tokens (required for organization projects)
5. Update tests to cover new functionality

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
