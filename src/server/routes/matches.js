const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');

// GET: Fetch all matches for the current user
router.get('/', requireAuth, async (req, res) => {
    try {
        const matches = await prisma.match.findMany({
            where: {
                OR: [{ userAId: req.uid }, { userBId: req.uid }]
            },
            include: {
                userA: { include: { profile: true } },
                userB: { include: { profile: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // PRIVACY FILTER: Strip out sensitive info before sending to frontend
        const safeMatches = matches.map(match => {
            const isUserA = match.userAId === req.uid;
            const otherUser = isUserA ? match.userB : match.userA;
            const myConsent = isUserA ? match.userAConsent : match.userBConsent;

            let partnerData = {
                displayAlias: otherUser.profile.displayAlias,
                bio: otherUser.profile.bio,
                values: otherUser.profile.values,
                compatibilityScore: match.compatibilityScore
            };

            // Only attach the phone number if the status is REVEALED
            if (match.status === 'REVEALED') {
                partnerData.phone = otherUser.phone;
            }

            return {
                matchId: match.id,
                status: match.status,
                myConsent: myConsent,
                partner: partnerData
            };
        });

        res.json(safeMatches);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch matches' });
    }
});

// POST: Accept or Decline a Match
router.post('/:matchId/consent', requireAuth, async (req, res) => {
    const { matchId } = req.params;
    const { consent } = req.body; // 'ACCEPTED' or 'DECLINED'

    try {
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match) return res.status(404).json({ error: 'Match not found' });

        const isUserA = match.userAId === req.uid;
        const isUserB = match.userBId === req.uid;

        if (!isUserA && !isUserB) {
            return res.status(403).json({ error: 'Not authorized for this match' });
        }

        // Determine which side of the match to update
        const updateData = isUserA 
            ? { userAConsent: consent } 
            : { userBConsent: consent };

        let updatedMatch = await prisma.match.update({
            where: { id: matchId },
            data: updateData
        });

        // CHECK MUTUAL CONSENT LOGIC
        if (consent === 'DECLINED') {
            updatedMatch = await prisma.match.update({
                where: { id: matchId },
                data: { status: 'REJECTED' }
            });
        } else if (updatedMatch.userAConsent === 'ACCEPTED' && updatedMatch.userBConsent === 'ACCEPTED') {
            updatedMatch = await prisma.match.update({
                where: { id: matchId },
                data: { 
                    status: 'REVEALED',
                    revealedAt: new Date()
                }
            });
        }

        res.json({ success: true, status: updatedMatch.status });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update consent' });
    }
});

module.exports = router;