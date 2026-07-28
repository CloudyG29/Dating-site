const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/fire_auth");
const { triggerMatching } = require("../services/matching");

// POST /api/auth/sync
router.post("/sync", requireAuth, async (req, res) => {
  try {
    let user;
    try {
      user = await prisma.user.create({
        //try to create a new user in the database with the provided firebaseUid and email from the request object. If the user already exists, it will throw an error.
        data: { firebaseUid: req.uid, email: req.email },
      });
    } catch (err) {
      if (err.code === "P2002") {
        // Could not create user, user already exists
        user = await prisma.user.findUnique({
          where: { firebaseUid: req.uid },
        });
      } else {
        throw err;
      }
    }
    res.json({ success: true, userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

// POST /api/auth/profile
router.post("/profile", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const {
      //pull the profile data from the request body.
      phone,
      displayAlias,
      bio,
      values,
      goals,
      lifestyleTags,
      dealbreakers,
    } = req.body;

    await prisma.user.update({
      where: { id: user.id },
      data: { phone },
    });

    let profile;
    try {
      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          displayAlias,
          bio,
          values: JSON.stringify(values || []),
          goals: JSON.stringify(goals || []),
          lifestyleTags: JSON.stringify(lifestyleTags || []),
          dealbreakers: JSON.stringify(dealbreakers || []),
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        profile = await prisma.profile.update({
          where: { userId: user.id },
          data: {
            displayAlias,
            bio,
            values: JSON.stringify(values || []),
            goals: JSON.stringify(goals || []),
            lifestyleTags: JSON.stringify(lifestyleTags || []),
            dealbreakers: JSON.stringify(dealbreakers || []),
          },
        });
      } else {
        throw err;
      }
    }

    // Fire matching after profile is complete — don't await it, don't block the response
    triggerMatching(user.id).catch((err) =>
      console.error("Matching error:", err),
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// GET /api/auth/profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
      include: { profile: true },
    });
    if (!user?.profile)
      //
      return res.status(404).json({ error: "Profile not found" });

    res.json({ ...user.profile, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

module.exports = router;
