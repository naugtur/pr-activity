#!/usr/bin/env node

async function getUserRecentActivity(username, token, daysBack = 7) {
  const response = await fetch(
    `https://api.github.com/users/${username}/events?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "github-pr-reviews-cli",
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("API Response:", errorBody);
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`
    );
  }

  const events = await response.json();
  const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  return events
    .filter((event) => new Date(event.created_at) > cutoffDate)
    .filter(
      (event) =>
        event.type === "PullRequestReviewEvent" ||
        event.type === "PullRequestReviewCommentEvent" ||
        (event.type === "IssueCommentEvent" &&
          event.payload.issue?.pull_request)
    )
    .map((event) => {
      const isReview = event.type === "PullRequestReviewEvent";
      const isPRComment =
        event.type === "PullRequestReviewCommentEvent" ||
        (event.type === "IssueCommentEvent" &&
          event.payload.issue?.pull_request);

      return {
        title: event.payload.pull_request?.title || event.payload.issue?.title,
        url:
          event.payload.pull_request?.html_url || event.payload.issue?.html_url,
        action: isReview ? event.payload.review?.state : "COMMENTED",
        created_at: event.created_at,
        type: event.type,
      };
    })
    .filter((activity) => activity.title && activity.url);
}

function groupByDay(activities) {
  const grouped = {};

  activities.forEach((activity) => {
    const day = activity.created_at.split("T")[0];
    if (!grouped[day]) grouped[day] = [];

    const existingIndex = grouped[day].findIndex(
      (existing) => existing.url === activity.url
    );

    if (existingIndex === -1) {
      grouped[day].push(activity);
    } else {
      const existing = grouped[day][existingIndex];
      const priority = { APPROVED: 3, CHANGES_REQUESTED: 2, COMMENTED: 1 };

      if (priority[activity.action] > priority[existing.action]) {
        grouped[day][existingIndex] = activity;
      }
    }
  });

  return grouped;
}
function formatReviewsForTerminal(reviewsData, username) {
  function getEmoji(action) {
    switch (action?.toUpperCase()) {
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
    const date = new Date(dateStr);
    const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
    const isoDate = date.toISOString().split("T")[0];
    return `${weekday} ${isoDate}`;
  }

  function padTitle(title, maxLength = 60) {
    if (!title) return " ".repeat(maxLength);

    if (title.length > maxLength) {
      return title.substring(0, maxLength);
    } else {
      return title + " ".repeat(maxLength - title.length);
    }
  }

  const sortedDates = Object.keys(reviewsData).sort(
    (a, b) => new Date(b) - new Date(a)
  );

  return sortedDates
    .flatMap((date) =>
      reviewsData[date].map(
        (activity) =>
          `[ ${formatDate(date)} ] ${getEmoji(activity.action)} ${padTitle(
            activity.title
          )} ${activity.url}`
      )
    )
    .join("\n");
}

async function main() {
  const username = process.argv[2];
  const daysArg = process.argv[3];

  if (!username) {
    console.error("Usage: node cli.js <github-username> [days]");
    console.error("  days: number of days to look back (default: 7)");
    console.error("Make sure to set GITHUB_TOKEN environment variable");
    process.exit(1);
  }

  // Parse and validate days argument
  let days = 7; // default
  if (daysArg) {
    const parsedDays = parseInt(daysArg, 10);
    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 90) {
      console.error("Error: days must be a number between 1 and 90");
      process.exit(1);
    }
    days = parsedDays;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN environment variable is required");
    process.exit(1);
  }

  try {
    console.log(`Fetching PR reviews for @${username} (last ${days} days)...`);
    const activities = await getUserRecentActivity(username, token, days);
    const groupedByDay = groupByDay(activities);

    if (Object.keys(groupedByDay).length === 0) {
      console.log(
        `No PR reviews or comments found for @${username} in the last ${days} days.`
      );
      return;
    }

    const output = formatReviewsForTerminal(groupedByDay, username);
    console.log("\n" + output);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
