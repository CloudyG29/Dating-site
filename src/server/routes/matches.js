const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/fire_auth");
const { triggerMatching } = require("../services/matching");

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
    // Go through every match
    const formatted = matches.map((match) => {
      let other;
      let myConsent;
      let theirConsent;

      // Check whether current user is User a or User B in the match
      if (match.userAId === user.id) {
        other = match.userB;
        myConsent = match.userAConsent;
        theirConsent = match.userBConsent;
      } else {
        other = match.userA;
        myConsent = match.userBConsent;
        theirConsent = match.userAConsent;
      }
      let alias = "Anonymous";
      let bio = null;

      if (other.profile) {
        alias = other.profile.displayAlias || "Anonymous";
        bio = other.profile.bio;
      }

      // Building the response sent to the frontend, we don't wanna send too much information.
      return {
        matchId: match.id,
        score: match.compatibilityScore,
        status: match.status,
        Consent,
        theirConsent,
        createdAt: match.createdAt,
        alias,
        bio,

        // If compatibility is high enough, hint that they have similar goals
        sharedGoals: match.compatibilityScore >= 70,
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

    // Check whether the current user is userA in this match
    const isA = match.userAId === user.id;

    // If the user isn't userA, make sure they're userB
    if (!isA && match.userBId !== user.id) {
      return res.status(403).json({ error: "Not your match" });
    }

    let updateData;

    // Update the correct consent field depending on who made the decision
    if (isA) {
      updateData = {
        userAConsent: decision,
      };
    } else {
      updateData = {
        userBConsent: decision,
      };
    }

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
router.post("/pass", requireAuth, async (req, res) => {
  let user;
  let result;
  const { matchId } = req.body;
  try {
    user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to find user" });
  }
  try {
    await prisma.match.update({
      where: { id: matchId },
      data: { status: "REJECTED" },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update match status" });
  }
  try {
    result = await triggerMatching(user.id);
    return res.json({ result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to trigger matching" });
  }
});

module.exports = router;
