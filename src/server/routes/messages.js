const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

// GET /api/messages/:matchId
router.get("/:matchId", requireAuth, async (req, res) => {
  const { matchId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
    });
    if (!user) return res.status(401).json({ error: "User not found" });

    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        status: "REVEALED",
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
    });

    if (!match) return res.status(403).json({ error: "Access denied" });

    const messages = await prisma.message.findMany({
      where: { matchId },
      orderBy: { sentAt: "asc" },
      include: { sender: { select: { firebaseUid: true } } },
    });

    res.json(
      messages.map((m) => ({
        id: m.id,
        matchId: m.matchId,
        senderUid: m.sender.firebaseUid,
        content: m.content,
        sentAt: m.sentAt,
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// POST /api/messages
router.post("/", requireAuth, async (req, res) => {
  const { matchId, content } = req.body;

  if (!matchId || !content) {
    return res.status(400).json({ error: "matchId and content are required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid },
    });
    if (!user) return res.status(401).json({ error: "User not found" });

    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        status: "REVEALED",
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
    });

    if (!match)
      return res.status(403).json({ error: "Not matched or not revealed yet" });

    const message = await prisma.message.create({
      data: { matchId, senderId: user.id, content },
      include: { sender: { select: { firebaseUid: true } } },
    });

    res.json({
      id: message.id,
      matchId: message.matchId,
      senderUid: message.sender.firebaseUid,
      content: message.content,
      sentAt: message.sentAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save message" });
  }
});

module.exports = router;
