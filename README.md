# GitHub Projects to Slack Summary

[![GitHub Super-Linter](https://github.com/actions/typescript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action that publishes summaries of GitHub Projects to Slack, showing
tasks/issues grouped by engineers with all relevant fields. Perfect for standups
and project status tracking.

## Features

- 📋 **Project Summaries**: Fetches all items from GitHub Projects (V2)
- 👥 **Engineer Grouping**: Groups tasks/issues by assigned engineers
- 📊 **Rich Information**: Shows item type, status, repository, and issue
  numbers
- 🔄 **Multiple Item Types**: Supports Issues, Pull Requests, and Draft Issues
- 📱 **Slack App Integration**: Uses Slack Bot tokens for secure, easy setup
- ⚙️ **Customizable**: Configurable item limits and channel targeting

## Usage

### Basic Usage

```yaml
name: Project Summary
on:
  schedule:
    - cron: '0 9 * * 1-5' # Monday-Friday at 9 AM
  workflow_dispatch: # Allow manual triggering

permissions:
  contents: read

jobs:
  slack-summary:
    runs-on: ubuntu-latest
    steps:
      - name: Send Project Summary to Slack
        uses: agglayer/gha-notify-gh-project@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          project-url: 'https://github.com/orgs/your-org/projects/1'
          slack-bot-token: ${{
            secrets.SLACK_APP_TOKEN_AGGLAYER_NOTIFY_GH_PROJECT }} # Pre-configured org secret
          slack-channel: '#standup'
```

### Advanced Usage

```yaml
name: Project Summary
on:
  schedule:
    - cron: '0 9 * * 1-5' # Monday-Friday at 9 AM
  workflow_dispatch:

permissions:
  contents: read

jobs:
  slack-summary:
    runs-on: ubuntu-latest
    steps:
      - name: Send Project Summary to Slack
        uses: agglayer/gha-notify-gh-project@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          project-url: 'https://github.com/orgs/your-org/projects/1'
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel: '#standup'
          max-items-per-user: '5'
```

> **Note for agglayer users**: Replace `SLACK_BOT_TOKEN` with
> `SLACK_APP_TOKEN_AGGLAYER_NOTIFY_GH_PROJECT` to use the pre-configured
> organization secret.

## Inputs

| Input                | Description                                                         | Required | Default     |
| -------------------- | ------------------------------------------------------------------- | -------- | ----------- |
| `github-token`       | GitHub token with access to read projects                           | ✅       |             |
| `project-url`        | GitHub Project URL (e.g., https://github.com/orgs/myorg/projects/1) | ✅       |             |
| `slack-bot-token`    | Slack Bot Token (starts with xoxb-)                                 | ✅       |             |
| `slack-channel`      | Slack channel to post to (e.g., #general or C1234567890)            | ✅       |             |
| `assignee-field`     | Name of the assignee field in the project                           | ❌       | `Assignees` |
| `max-items-per-user` | Maximum number of items to show per user                            | ❌       | `10`        |
| `done-items-days`    | Show Done items only if completed within this many days             | ❌       | `1`         |
| `grouping-mode`      | How to group items: "assignee" or "milestone"                       | ❌       | `assignee`  |

## Outputs

| Output         | Description                                        |
| -------------- | -------------------------------------------------- |
| `summary-sent` | Whether the summary was successfully sent to Slack |
| `total-items`  | Total number of items processed                    |
| `users-count`  | Number of users with assigned items                |

## Setup

### 1. GitHub Token

The action requires a GitHub token with access to GitHub Projects V2.
**Important**: `GITHUB_TOKEN` has limited access to organization projects and
may not work for all scenarios.

#### Using GITHUB_TOKEN (Limited Support)

The default `GITHUB_TOKEN` can only access projects in certain cases:

- **Repository projects**: Works if the project is linked to the repository
- **Organization projects**: May fail with "Could not resolve to ProjectV2"
  error

Set minimal permissions in your workflow:

```yaml
permissions:
  contents: read
```

#### Using Personal Access Token (Recommended for Organization Projects)

For reliable access to organization projects, create a personal access token
with:

- `read:org` (to access organization resources)
- `read:project` (to read project data)

1. Go to GitHub Settings > Developer settings > Personal access tokens >
   Fine-grained tokens
2. Create a token with the above permissions
3. Add it as a repository secret named `GITHUB_PAT`
4. Use `github-token: ${{ secrets.GITHUB_PAT }}` in your workflow

**For agglayer users**: The pre-configured token already has the necessary
permissions.

### 2. Slack App Setup

Instead of using webhooks, this action uses a Slack App which is more secure and
easier to set up:

#### Option A: For agglayer Organization (Instant Use)

If you're using this action within the `agglayer` GitHub organization, you can
use it immediately with the pre-configured organization secret:

```yaml
- name: Send Project Summary to Slack
  uses: agglayer/gha-notify-gh-project@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }} # PAT if org project, see below
    project-url: 'https://github.com/orgs/agglayer/projects/1'
          slack-bot-token: ${{ secrets.SLACK_APP_TOKEN_AGGLAYER_NOTIFY_GH_PROJECT }}
      slack-channel: '#your-channel'
      done-items-days: 2  # Optional: Show Done items from last 2 days (default: 1)
      grouping-mode: milestone  # Optional: Group by milestone instead of assignee
```

Just invite the bot to your desired channel with `/invite @Agglayer Github Project Notifier`
and you're ready to go!

#### Option B: Use the Pre-built Slack App (Other Organizations)

1. **Install the App**: Click the "Add to Slack" button below to install the
   pre-built app to your workspace

   [![Add to Slack](https://platform.slack-edge.com/img/add_to_slack.png)](https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID&scope=chat:write&user_scope=)

2. **Get the Bot Token**: After installation, you'll receive a Bot User OAuth
   Token that starts with `xoxb-`

3. **Add the Token as a Secret**: In your GitHub repository, go to Settings >
   Secrets and Variables > Actions, then add a new secret named
   `SLACK_BOT_TOKEN` with your bot token

4. **Invite the Bot**: You must manually invite the bot to each channel where
   you want to receive summaries by typing `/invite @GitHub Projects Bot` in the
   channel

#### Option C: Create Your Own Slack App

1. **Create a Slack App**: Go to
   [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. **Configure OAuth Scopes**: In "OAuth & Permissions", add this Bot Token
   Scope:
   - `chat:write` - Send messages to channels the bot is a member of
3. **Install the App**: Click "Install to Workspace" and authorize the app
4. **Get the Bot Token**: Copy the "Bot User OAuth Token" (starts with `xoxb-`)
5. **Add as Secret**: Add the token as `SLACK_BOT_TOKEN` in your GitHub
   repository secrets
6. **Invite the Bot**: You must manually invite the bot to each channel where
   you want to receive summaries by typing `/invite @YourBotName` in the channel

### 3. Project URL

The action supports both organization and user projects:

- Organization projects: `https://github.com/orgs/your-org/projects/1`
- User projects: `https://github.com/users/your-username/projects/1`

### 4. Channel Configuration

You can specify the channel in several ways:

- Channel name: `#general`
- Channel ID: `C1234567890`
- Direct message: `@username`

**Important**: The bot must be manually invited to each channel before it can
post messages. Use `/invite @YourBotName` in the target channel.

## Troubleshooting

### "Could not resolve to a ProjectV2 with the number X"

This error occurs when the GitHub token cannot access the specified project.
Common causes:

1. **Project doesn't exist**: Verify the project URL and number are correct
2. **Using GITHUB_TOKEN with organization projects**: `GITHUB_TOKEN` has limited
   access to organization projects
3. **Missing permissions**: The token lacks necessary permissions

**Solutions:**

- **For organization projects**: Use a Personal Access Token instead of
  `GITHUB_TOKEN`
- **Check project URL**: Ensure the project exists at the specified URL
- **Verify project number**: The number in the URL should match an existing
  project

### Project Access Permissions

- **Repository projects**: `GITHUB_TOKEN` usually works
- **Organization projects**: Requires Personal Access Token with `read:org` and
  `read:project` permissions
- **Private projects**: Ensure the token has access to the
  organization/repository

## Example Output

The action will send a message to Slack that looks like this:

```
📋 Project Summary
12 items across 4 assignees

alice (3 items):
  🐛 `In Progress` Fix authentication bug [frontend#123]
  🔄 `Review` Add dark mode support [frontend#124]
  📝 `Todo` Update documentation

bob (2 items):
  🐛 `In Progress` Database migration [backend#456]
  🔄 `Ready` API endpoint refactor [backend#457]

charlie (1 items):
  📝 `Todo` Research new framework

Unassigned (6 items):
  🐛 `Backlog` Performance optimization [frontend#125]
  🔄 `Todo` Code review process [meta#789]
  ... and 4 more items
```

## Development

### Prerequisites

- Node.js 20.x or later
- npm

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

You can test the action locally using the GitHub Actions local development
tools:

```bash
# Set up environment variables
export INPUT_GITHUB_TOKEN="your-github-token"  # Token with read:org and read:project permissions
export INPUT_PROJECT_URL="https://github.com/orgs/your-org/projects/1"
export INPUT_SLACK_BOT_TOKEN="xoxb-your-bot-token"
export INPUT_SLACK_CHANNEL="#your-channel"

# Run the action locally
npm run local-action
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
