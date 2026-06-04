const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

// POST /api/auth/sync
// Called after Firebase login to ensure user exists in our DB
router.post("/sync", requireAuth, async (req, res) => {
  try {
    let user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
    });
    if (!user) {
      user = await prisma.user.create({
        data: { firebaseUid: req.uid, email: req.email },
      });
    }
    res.json({ success: true, userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

module.exports = router;
