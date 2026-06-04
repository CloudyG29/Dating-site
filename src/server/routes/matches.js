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
    if (!user) return res.status(401).json({ error: "User not found" });

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

    const safeMatches = matches.map((match) => {
      const isUserA = match.userAId === user.id;
      const otherUser = isUserA ? match.userB : match.userA;
      const myConsent = isUserA ? match.userAConsent : match.userBConsent;

      const partnerData = {
        displayAlias: otherUser.profile?.displayAlias,
        bio: otherUser.profile?.bio,
        values: otherUser.profile?.values,
        compatibilityScore: match.compatibilityScore,
      };

      if (match.status === "REVEALED") {
        partnerData.phone = otherUser.phone;
      }

      return {
        matchId: match.id,
        status: match.status,
        myConsent,
        partner: partnerData,
      };
    });

    res.json(safeMatches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

// POST /api/matches/:matchId/consent
router.post("/:matchId/consent", requireAuth, async (req, res) => {
  const { matchId } = req.params;
  const { consent } = req.body;

  if (!["ACCEPTED", "DECLINED"].includes(consent)) {
    return res
      .status(400)
      .json({ error: "consent must be ACCEPTED or DECLINED" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
    });
    if (!user) return res.status(401).json({ error: "User not found" });

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return res.status(404).json({ error: "Match not found" });

    const isUserA = match.userAId === user.id;
    const isUserB = match.userBId === user.id;

    if (!isUserA && !isUserB) {
      return res.status(403).json({ error: "Not authorized for this match" });
    }

    const updateData = isUserA
      ? { userAConsent: consent }
      : { userBConsent: consent };
    let updated = await prisma.match.update({
      where: { id: matchId },
      data: updateData,
    });

    if (consent === "DECLINED") {
      updated = await prisma.match.update({
        where: { id: matchId },
        data: { status: "REJECTED" },
      });
    } else if (
      updated.userAConsent === "ACCEPTED" &&
      updated.userBConsent === "ACCEPTED"
    ) {
      updated = await prisma.match.update({
        where: { id: matchId },
        data: { status: "REVEALED", revealedAt: new Date() },
      });
    }

    res.json({ success: true, status: updated.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update consent" });
  }
});

module.exports = router;
