const prisma = require("../lib/prisma");

// ─── Main Entry Point ─────────────────────────────────────
async function triggerMatching(userId) {
  const newUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!newUser?.profile?.isActive) return; // no profile yet, bail

  // Exclude users who already have a match with this user
  const existingMatchIds = await prisma.match.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { userAId: true, userBId: true },
  });

  const alreadyMatchedIds = new Set(
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

  const MINIMUM_SCORE = 40;
  if (!bestMatch || bestScore < MINIMUM_SCORE) return;

  // Enforce consistent ordering to satisfy @@unique([userAId, userBId])
  const [userAId, userBId] =
    userId < bestMatch.id ? [userId, bestMatch.id] : [bestMatch.id, userId];

  await prisma.match.create({
    data: {
      userAId,
      userBId,
      compatibilityScore: bestScore,
      status: "PENDING_REVIEW",
      userAConsent: "PENDING",
      userBConsent: "PENDING",
    },
  });
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

module.exports = { triggerMatching };
