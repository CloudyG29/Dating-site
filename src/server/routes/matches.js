const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

// GET /api/matches
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Return the match + the OTHER person's profile
    const formatted = matches.map((match) => {
      const isA = match.userAId === user.id;
      const other = isA ? match.userB : match.userA;
      const myConsent = isA ? match.userAConsent : match.userBConsent;
      const theirConsent = isA ? match.userBConsent : match.userAConsent;

      return {
        matchId: match.id,
        score: match.compatibilityScore,
        status: match.status,
        myConsent,
        theirConsent,
        createdAt: match.createdAt,
        // Only reveal alias, nothing identifying yet
        alias: other.profile?.displayAlias || "Anonymous",
        bio: other.profile?.bio || null,
        sharedGoals: match.compatibilityScore >= 70, // tease high compatibility
      };
    });

    res.json({ matches: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

// PATCH /api/matches/:matchId/consent
router.patch("/:matchId/consent", requireAuth, async (req, res) => {
  try {
    const { decision } = req.body; // "ACCEPTED" or "REJECTED"
    if (!["ACCEPTED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ error: "Invalid decision" });
    }

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
    });

    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
    });

    if (!match) return res.status(404).json({ error: "Match not found" });

    const isA = match.userAId === user.id;
    if (!isA && match.userBId !== user.id) {
      return res.status(403).json({ error: "Not your match" });
    }

    const updateData = isA
      ? { userAConsent: decision }
      : { userBConsent: decision };

    // Check if both accepted after this update
    const updatedMatch = await prisma.match.update({
      where: { id: match.id },
      data: {
        ...updateData,
        ...(decision === "REJECTED" && { status: "REJECTED" }),
      },
    });

    const bothAccepted =
      updatedMatch.userAConsent === "ACCEPTED" &&
      updatedMatch.userBConsent === "ACCEPTED";

    if (bothAccepted) {
      await prisma.match.update({
        where: { id: match.id },
        data: { status: "REVEALED", revealedAt: new Date() },
      });
    }

    res.json({ success: true, status: updatedMatch.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update consent" });
  }
});

module.exports = router;
