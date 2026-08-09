const prisma = require("../lib/prisma");

function formatMatchForUser(match, userId) {
  const isA = match.userAId === userId;
  const other = isA ? match.userB : match.userA;
  return {
    matchId: match.id,
    score: match.compatibilityScore,
    status: match.status,
    consent: isA ? match.userAConsent : match.userBConsent,
    theirConsent: isA ? match.userBConsent : match.userAConsent,
    createdAt: match.createdAt,
    alias: other.profile?.displayAlias || "Anonymous",
    bio: other.profile?.bio || null,
    sharedGoals: match.compatibilityScore >= 70,
  };
}

// ─── Main Entry Point ─────────────────────────────────────
async function triggerMatching(userId) {
  const newUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  }); //gets user profile from database using the provided userId.

  // 1. Make sure the user exists
  if (!newUser) {
    throw new Error("User not found");
  }

  // 2. Make sure they have a profile set up
  if (!newUser.profile) {
    throw new Error("User profile not found");
  }

  // 3. Make sure their profile is actually active
  if (newUser.profile.isActive === false) {
    throw new Error("User profile is not active");
  }

  // Exclude users who already have a match with this user
  const existingMatchIds = await prisma.match.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }], //match table is undirected, so we need to check both userAId and userBId for the given userId.
    },
    select: { userAId: true, userBId: true }, //only gets the users and not other information.
  });

  const alreadyMatchedIds = new Set( //Don't recommend users who have already been matched with the current user.
    existingMatchIds.flatMap((m) => [m.userAId, m.userBId]),
  );
  alreadyMatchedIds.add(userId); // exclude self

  // Get all active candidates
  const candidates = await prisma.user.findMany({
    where: {
      id: { notIn: [...alreadyMatchedIds] },
      profile: { isActive: true, clusterID: newUser.profile.clusterID },
    },
    include: { profile: true },
  });

  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = computeScore(newUser.profile, candidate.profile);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  const MINIMUM_SCORE = 0;
  if (!bestMatch || bestScore < MINIMUM_SCORE) return null;

  let userAId;
  let userBId;

  // Always put the smaller ID in userAId to prevent duplicates in the database
  if (userId < bestMatch.id) {
    userAId = userId;
    userBId = bestMatch.id;
  } else {
    userAId = bestMatch.id;
    userBId = userId;
  }

  const newmatch = await prisma.match.create({
    data: {
      userAId,
      userBId,
      compatibilityScore: bestScore,
      status: "PENDING_REVIEW",
      userAConsent: "PENDING",
      userBConsent: "PENDING",
    },
    include: {
      userA: { include: { profile: true } },
      userB: { include: { profile: true } },
    },
  });
  return formatMatchForUser(newmatch, userId);
}

// ─── Scoring ──────────────────────────────────────────────
function parseField(jsonString) {
  if (!jsonString) return [];
  try {
    return JSON.parse(jsonString);
  } catch {
    return [];
  }
}

const VALUES_VOCAB = [
  "Family first",
  "Adventure",
  "Intellectual curiosity",
  "Creativity",
  "Spirituality",
  "Career-driven",
];
const LIFESTYLE_VOCAB = [
  "Homebody",
  "Social butterfly",
  "Outdoorsy",
  "Fitness-focused",
  "Night owl",
  "Early riser",
];
const GOAL_VOCAB = [
  "Serious & long-term",
  "Open to see where it goes",
  "Friendship",
];

function vectorizeProfile(profile) {
  const values = parseField(profile.values);
  const lifestyle = parseField(profile.lifestyleTags);
  const goals = parseField(profile.goals);

  const valuesVec = VALUES_VOCAB.map((tag) => (values.includes(tag) ? 1 : 0));
  const lifestyleVec = LIFESTYLE_VOCAB.map((tag) =>
    lifestyle.includes(tag) ? 1 : 0,
  );
  const goalVec = GOAL_VOCAB.map((tag) => (goals.includes(tag) ? 1 : 0));

  const normalizedAge = (profile.age - 18) / (99 - 18);

  return [...valuesVec, ...lifestyleVec, ...goalVec, normalizedAge];
}
function assignToNearestCentroid(vector, centroids) {
  let bestCluster = 0;
  let bestDistance = Infinity;

  centroids.forEach((centroid, i) => {
    const distance = euclideanDistance(vector, centroid);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCluster = i;
    }
  });

  return bestCluster;
}
const CENTROIDS = [
  // Cluster 0 — Grounded / Family-oriented
  [
    0.9, 0.1, 0.3, 0.2, 0.4, 0.4, 0.7, 0.2, 0.2, 0.3, 0.1, 0.8, 0.9, 0.1, 0.0,
    0.45,
  ],

  // Cluster 1 — Adventurous / Social
  [
    0.1, 0.9, 0.2, 0.3, 0.1, 0.3, 0.2, 0.8, 0.9, 0.7, 0.4, 0.2, 0.4, 0.6, 0.0,
    0.3,
  ],

  // Cluster 2 — Casual / Exploratory
  [
    0.2, 0.3, 0.8, 0.7, 0.5, 0.2, 0.4, 0.5, 0.3, 0.2, 0.8, 0.1, 0.1, 0.5, 0.4,
    0.2,
  ],
];

function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

function computeScore(profileA, profileB) {
  const vectorA = vectorizeProfile(profileA);
  const vectorB = vectorizeProfile(profileB);
  const distance = euclideanDistance(vectorA, vectorB);

  // convert distance into a 0-100 score — smaller distance = higher score
  const maxDistance = Math.sqrt(16); // theoretical max distance across 16 dimensions
  const score = 100 * (1 - distance / maxDistance);

  return score;
}

module.exports = {
  triggerMatching,
  formatMatchForUser,
  vectorizeProfile,
  assignToNearestCentroid,
  CENTROIDS,
};
