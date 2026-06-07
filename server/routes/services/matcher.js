const prisma = require('../prisma');

// Helper function to calculate shared items between two arrays
const calculateOverlap = (arr1 = [], arr2 = []) => {
    const set2 = new Set(arr2);
    return arr1.filter(item => set2.has(item)).length;
};

// The core algorithm
const runMatchAlgorithm = async (userId) => {
    console.log(`✨ Running matching algorithm for user: ${userId}`);

    try {
        // 1. Get the current user's profile
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true }
        });

        if (!user || !user.profile || !user.profile.isActive) return;
        const uProfile = user.profile;

        // 2. Find all active profiles EXCEPT this user, and people they've already matched with
        const candidates = await prisma.user.findMany({
            where: {
                id: { not: userId },
                profile: { isActive: true },
                // Make sure no match exists where they are A or B
                NOT: [
                    { matchesA: { some: { userBId: userId } } },
                    { matchesB: { some: { userAId: userId } } }
                ]
            },
            include: { profile: true }
        });

        // 3. Score each candidate
        let newMatchesCount = 0;

        for (const candidate of candidates) {
            const cProfile = candidate.profile;
            if (!cProfile) continue;

            // --- DEALBREAKER CHECK ---
            // If the candidate has a lifestyle tag that is a dealbreaker for the user, instantly disqualify.
            // (You can expand this later to check age, gender, etc.)
            const hitsDealbreaker = calculateOverlap(uProfile.dealbreakers, cProfile.lifestyleTags) > 0;
            if (hitsDealbreaker) continue;

            // --- COMPATIBILITY SCORING ---
            // We give different weights to different categories.
            // Values = 50%, Goals = 30%, Lifestyle = 20%
            
            // Calculate Value Score (Max 50 points)
            const maxValues = Math.max(uProfile.values.length, 1); // Avoid division by zero
            const sharedValues = calculateOverlap(uProfile.values, cProfile.values);
            const valueScore = (sharedValues / maxValues) * 50;

            // Calculate Goal Score (Max 30 points)
            const maxGoals = Math.max(uProfile.goals.length, 1);
            const sharedGoals = calculateOverlap(uProfile.goals, cProfile.goals);
            const goalScore = (sharedGoals / maxGoals) * 30;

            // Calculate Lifestyle Score (Max 20 points)
            const maxLifestyle = Math.max(uProfile.lifestyleTags.length, 1);
            const sharedLifestyle = calculateOverlap(uProfile.lifestyleTags, cProfile.lifestyleTags);
            const lifestyleScore = (sharedLifestyle / maxLifestyle) * 20;

            // Total Score (Out of 100)
            const totalScore = Math.round(valueScore + goalScore + lifestyleScore);

            // --- THE THRESHOLD ---
            // If they are more than 60% compatible, create a Match!
            if (totalScore >= 60) {
                await prisma.match.create({
                    data: {
                        userAId: userId,
                        userBId: candidate.id,
                        compatibilityScore: totalScore,
                        status: 'PENDING_REVIEW'
                    }
                });
                newMatchesCount++;
                console.log(`💘 Match created! Score: ${totalScore}%`);
            }
        }

        console.log(`✅ Algorithm finished. Found ${newMatchesCount} new matches.`);

    } catch (err) {
        console.error('Error running match algorithm:', err);
    }
};

module.exports = { runMatchAlgorithm };