const express = require('express');
const router = express.Router();
const { db, auth } = require('../lib/firebase');
const { requireAuth } = require('../middleware/auth');

// Save/update profile after Firebase Auth signup
router.post('/profile', requireAuth, async (req, res) => {
  try {
    const {
      handle, age, location, gender,
      bio, values, lifestyle, goal,
      seeking, ageMin, ageMax, prefs, dealbreakers, phone
    } = req.body;

    // Validate required fields
    if (!handle || !age || !location || !gender || !bio) {
      return res.status(400).json({ error: 'Missing required profile fields' });
    }

    // Check handle uniqueness
    const existing = await db.collection('users').where('handle', '==', handle).get();
    if (!existing.empty && existing.docs[0].id !== req.uid) {
      return res.status(409).json({ error: 'That username is already taken' });
    }

    const profileData = {
      uid: req.uid,
      email: req.email,
      handle,
      age: parseInt(age),
      location,
      gender,
      bio,
      values: values || [],
      lifestyle: lifestyle || [],
      goal: goal || '',
      seeking: seeking || 'any gender',
      ageMin: parseInt(ageMin) || 18,
      ageMax: parseInt(ageMax) || 80,
      prefs: prefs || [],
      dealbreakers: dealbreakers || '',
      phone: phone || '',
      paid: false,
      active: false,
      matchId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(req.uid).set(profileData, { merge: true });
    res.json({ success: true, profile: profileData });
  } catch (err) {
    console.error('Profile save error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Get own profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.uid).get();
    if (!snap.exists) return res.status(404).json({ error: 'Profile not found' });
    const data = snap.data();
    // Never expose sensitive fields of other users via this route
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;