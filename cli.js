#!/usr/bin/env node

async function searchPRs(query, token) {
  const response = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=100`, {
    headers: {
      'Authorization': `Bearer ${token}`, // Changed from 'token' to 'Bearer'
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-pr-reviews-cli'
    }
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    console.error('API Response:', errorBody);
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.items;
}

async function getReviewDetails(owner, repo, number, token) {
  const headers = { 
    'Authorization': `Bearer ${token}`, 
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'github-pr-reviews-cli'
  };

  const [reviews, prComments] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/reviews`, { headers })
      .then(r => r.ok ? r.json() : []),
    
    fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/comments`, { headers })
      .then(r => r.ok ? r.json() : [])
  ]);

  return { reviews, comments: prComments };
}

async function getAllUserPRInteractions(username, daysBack = 7) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  
  // Simplified queries - the issue might be with complex query syntax
  const queries = [
    `type:pr commenter:${username} updated:>=${since}`,
    `type:pr reviewed-by:${username} updated:>=${since}`
  ];

  console.log('Search queries:', queries); // Debug output

  const [commentedPRs, reviewedPRs] = await Promise.all([
    searchPRs(queries[0], token),
    searchPRs(queries[1], token)
  ]);

  const allPRs = [...commentedPRs, ...reviewedPRs];
  const uniquePRs = allPRs.filter((pr, index, self) => 
    index === self.findIndex(p => p.number === pr.number && p.repository_url === pr.repository_url)
  );

  const activities = [];

  for (const pr of uniquePRs) {
    const urlParts = pr.repository_url.split('/');
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1];

    try {
      const { reviews, comments } = await getReviewDetails(owner, repo, pr.number, token);
      
      reviews
        .filter(review => review.user.login === username)
        .forEach(review => {
          activities.push({
            title: pr.title,
            url: pr.html_url,
            type: 'review',
            action: review.state,
            created_at: review.submitted_at
          });
        });

      comments
        .filter(comment => comment.user.login === username)
        .forEach(comment => {
          activities.push({
            title: pr.title,
            url: pr.html_url,
            type: 'comment',
            action: 'COMMENTED',
            created_at: comment.created_at
          });
        });
    } catch (error) {
      console.error(`Error fetching details for PR ${pr.number}: ${error.message}`);
    }
  }

  return activities;
}

function groupByDay(activities) {
  const grouped = {};
  
  activities.forEach(activity => {
    const day = activity.created_at.split('T')[0];
    if (!grouped[day]) grouped[day] = [];
    
    // Check if we already have this PR for this day
    const existingIndex = grouped[day].findIndex(existing => existing.url === activity.url);
    
    if (existingIndex === -1) {
      // New PR for this day, add it
      grouped[day].push(activity);
    } else {
      // PR already exists for this day, keep the "higher priority" action
      const existing = grouped[day][existingIndex];
      const priority = { 'APPROVED': 3, 'CHANGES_REQUESTED': 2, 'COMMENTED': 1 };
      
      if (priority[activity.action] > priority[existing.action]) {
        grouped[day][existingIndex] = activity;
      }
    }
  });
  
  return grouped;
}

function formatReviewsForTerminal(reviewsData, username) {
  function getEmoji(action) {
    switch (action.toUpperCase()) {
      case "APPROVED":
        return "✅";
      case "CHANGES_REQUESTED":
        return "❌";
      case "COMMENTED":
        return "💬";
      default:
        return "👁️";
    }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function truncateTitle(title, maxLength = 20) {
    return title.length > maxLength
      ? title.substring(0, maxLength) + "..."
      : title;
  }

  const sortedDates = Object.keys(reviewsData).sort(
    (a, b) => new Date(b) - new Date(a)
  );

  return sortedDates
    .flatMap((date) =>
      reviewsData[date].map(
        (activity) =>
          `[ ${formatDate(date)} ] ${getEmoji(activity.action)} ${truncateTitle(
            activity.title
          )} ${activity.url}`
      )
    )
    .join("\n");
}

async function main() {
  const username = process.argv[2];

  if (!username) {
    console.error("Usage: node cli.js <github-username>");
    console.error("Make sure to set GITHUB_TOKEN environment variable");
    process.exit(1);
  }

  try {
    console.log(`Fetching PR reviews for @${username}...`);
    const activities = await getAllUserPRInteractions(username);
    const groupedByDay = groupByDay(activities);

    if (Object.keys(groupedByDay).length === 0) {
      console.log(
        `No PR reviews or comments found for @${username} in the last 7 days.`
      );
      process.exit(0);
    }

    const output = formatReviewsForTerminal(groupedByDay, username);
    console.log("\n" + output);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
