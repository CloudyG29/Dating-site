const { db } = require('./firebase');

async function triggerMatching(newUid) {
  const newUserSnap = await db.collection('users').doc(newUid).get();
  const newUser = newUserSnap.data();

  // Get all active, paid, unmatched users (excluding same gender if applicable)
  const candidates = await db.collection('users')
    .where('active', '==', true)
    .where('paid', '==', true)
    .where('matched', '==', false)
    .get();

  let bestMatch = null;
  let bestScore = 0;

  candidates.forEach(doc => {
    if (doc.id === newUid) return;
    const candidate = doc.data();

    // Gender/seeking compatibility check
    if (!seekingCompatible(newUser, candidate)) return;

    // Age range check (both ways)
    if (candidate.age < newUser.ageMin || candidate.age > newUser.ageMax) return;
    if (newUser.age < candidate.ageMin || newUser.age > candidate.ageMax) return;

    const score = computeScore(newUser, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { id: doc.id, ...candidate };
    }
  });

  if (bestMatch && bestScore >= 40) {
    const matchRef = db.collection('matches').doc();
    await matchRef.set({
      user1: newUid,
      user2: bestMatch.id,
      score: bestScore,
      status: 'pending',  // both need to accept
      user1Accepted: false,
      user2Accepted: false,
      createdAt: new Date().toISOString(),
    });

    // Flag both users as matched (prevents double matching)
    await db.collection('users').doc(newUid).update({ matchId: matchRef.id });
    await db.collection('users').doc(bestMatch.id).update({ matchId: matchRef.id });
  }
}

function seekingCompatible(a, b) {
  const sA = (a.seeking || '').toLowerCase();
  const sB = (b.seeking || '').toLowerCase();
  const gA = (a.gender || '').toLowerCase();
  const gB = (b.gender || '').toLowerCase();
  if (sA === 'any gender' || sB === 'any gender') return true;
  return sA.includes(gB) && sB.includes(gA);
}

function computeScore(a, b) {
  let score = 0;
  const sharedValues = (a.values || []).filter(v => (b.values || []).includes(v));
  const sharedLifestyle = (a.lifestyle || []).filter(l => (b.lifestyle || []).includes(l));
  score += sharedValues.length * 20;
  score += sharedLifestyle.length * 15;
  if (a.goal && a.goal === b.goal) score += 30;
  return Math.min(100, score);
}

module.exports = { triggerMatching };