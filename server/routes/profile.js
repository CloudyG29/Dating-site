const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');

// GET: Fetch the current user's profile
router.get('/', requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.uid }, // Using Firebase UID
            include: { profile: true }
        });

        if (!user || !user.profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json({
            email: user.email,
            phone: user.phone,
            ...user.profile
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST: Create or Update Profile (Upsert)
router.post('/', requireAuth, async (req, res) => {
    const { 
        phone, displayAlias, bio, 
        values = [], goals = [], lifestyleTags = [], dealbreakers = [] 
    } = req.body;

    try {
        // 1. Upsert User (Create if new, update if exists)
        await prisma.user.upsert({
            where: { id: req.uid },
            update: { phone },
            create: { id: req.uid, email: req.email, phone }
        });

        // 2. Upsert Profile
        const profile = await prisma.profile.upsert({
            where: { userId: req.uid },
            update: { displayAlias, bio, values, goals, lifestyleTags, dealbreakers },
            create: { 
                userId: req.uid, 
                displayAlias, 
                bio, 
                values, 
                goals, 
                lifestyleTags, 
                dealbreakers 
            }
        });

        res.json({ success: true, profile });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save profile' });
    }
});

module.exports = router;