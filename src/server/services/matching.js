const prisma = require("../lib/prisma");

function formatMatchForUser(match, userId) {
  const isA = match.userAId === userId;
  const other = isA ? match.userB : match.userA;
  return {
    matchId: match.id,
    score: match.compatibilityScore,
    status: match.status,
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
      profile: { isActive: true },
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

/*
function computeScore(profileA, profileB) {
  let score = 0;

  const valuesA = parseField(profileA.values);
  const valuesB = parseField(profileB.values);
  const sharedValues = valuesA.filter((v) => valuesB.includes(v));
  score += sharedValues.length * 20;

  const lifestyleA = parseField(profileA.lifestyleTags);
  const lifestyleB = parseField(profileB.lifestyleTags);
  const sharedLifestyle = lifestyleA.filter((l) => lifestyleB.includes(l));
  score += sharedLifestyle.length * 15;

  const goalsA = parseField(profileA.goals);
  const goalsB = parseField(profileB.goals);
  const sharedGoals = goalsA.filter((g) => goalsB.includes(g));
  if (sharedGoals.length > 0) score += 30;

  return Math.min(100, score);
}
*/

function computeScore(profileA, profileB) {
  return 100;
}

module.exports = { triggerMatching, formatMatchForUser };
