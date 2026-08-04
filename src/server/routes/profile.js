const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/fire_auth");
const { triggerMatching } = require("../services/matching");

// GET own profile
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({
      email: user.email,
      phone: user.phone,
      ...user.profile,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST create/update profile
router.post("/", requireAuth, async (req, res) => {
  const {
    phone,
    displayAlias,
    bio,
    values = [],
    goals = [],
    lifestyleTags = [],
    dealbreakers = [],
  } = req.body;

  if (!displayAlias || !bio) {
    return res.status(400).json({ error: "displayAlias and bio are required" });
  }
  let user;
  try {
    // Find or create user
    user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
    });
    if (!user) {
      user = await prisma.user.create({
        data: { firebaseUid: req.uid, email: req.email, phone },
      });
    } else {
      user = await prisma.user.update({
        where: { firebaseUid: req.uid },
        data: { phone },
      });
    }

    // Find or create profile
    let profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          displayAlias,
          bio,
          values: JSON.stringify(values),
          goals: JSON.stringify(goals),
          lifestyleTags: JSON.stringify(lifestyleTags),
          dealbreakers: JSON.stringify(dealbreakers),
        },
      });
    } else {
      profile = await prisma.profile.update({
        where: { userId: user.id },
        data: {
          displayAlias,
          bio,
          values: JSON.stringify(values),
          goals: JSON.stringify(goals),
          lifestyleTags: JSON.stringify(lifestyleTags),
          dealbreakers: JSON.stringify(dealbreakers),
        },
      });
    }

    res.json({ success: true, profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save profile" });
  }
  try {
    await triggerMatching(user.id);
  } catch (err) {
    console.error("triggerMatching failed on profile create:", err);
  }
});
module.exports = router;
