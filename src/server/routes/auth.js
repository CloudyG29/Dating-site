const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

router.post("/sync", requireAuth, async (req, res) => {
  try {
    let user;

    try {
      user = await prisma.user.create({
        data: { firebaseUid: req.uid, email: req.email },
      });
    } catch (err) {
      if (err.code === "P2002") {
        // Already exists — the other concurrent request won the race. Fine.
        user = await prisma.user.findUnique({
          where: { firebaseUid: req.uid },
        });
      } else {
        throw err; // something actually broken, rethrow
      }
    }

    res.json({ success: true, userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

module.exports = router;
