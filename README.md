# pr-activity

A simple command-line tool to view your recent GitHub pull request reviews and comments.

## Installation

```bash
npm install -g pr-activity
```

Or run directly with npx:
```bash
npx pr-activity <username>
```

## Setup

You need a GitHub Personal Access Token to use this tool.

### Option 1: Using GitHub CLI (Easiest)
If you have the GitHub CLI installed:
```bash
export GITHUB_TOKEN=$(gh auth token)
```

### Option 2: Create a Personal Access Token
1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Click **"Generate new token"** → **"Generate new token (classic)"** or **"Fine-grained personal access token"**
3. For **classic tokens**: Select the `repo` scope
4. For **fine-grained tokens**: Select repositories and grant `Pull requests: Read` and `Issues: Read` permissions
5. Copy the token and set it as an environment variable:

```bash
export GITHUB_TOKEN=your_token_here
```

### Option 3: Using a .env file
Create a `.env` file in your project directory:
```bash
GITHUB_TOKEN=your_token_here
```

Then load it:
```bash
. .env
```

## Usage

```bash
# Show last 7 days of PR activity (default)
pr-activity username

# Show last 14 days
pr-activity username 14

# Show last 30 days
pr-activity username 30
```


## Sample Output

```
Fetching PR reviews for @octocat (last 7 days)...

[ Thu 2025-01-16 ] ✅ Fix authentication bug in login flow                      https://github.com/company/backend/pull/123
[ Thu 2025-01-16 ] ❌ Add user profile validation with better error handling    https://github.com/company/frontend/pull/124
[ Wed 2025-01-15 ] 💬 Update documentation for new API endpoints               https://github.com/company/docs/pull/125
[ Tue 2025-01-14 ] ✅ Refactor database connection pooling                     https://github.com/company/backend/pull/126
```

## Legend

- ✅ **Approved** - You approved the PR
- ❌ **Changes Requested** - You requested changes
- 💬 **Commented** - You left comments or review comments
- 👁️ **Other** - Other review activity

## Limitations

- Limited to the last 90 days of activity (GitHub API limitation)
- Shows up to 100 most recent events (GitHub API limitation)
- Requires a GitHub token even for public repositories

## License

Apache-2.0
