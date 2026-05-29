const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");

const prisma = new PrismaClient();

// GET /api/messages/:matchId
router.get("/:matchId", requireAuth, async (req, res) => {
  const matchId = parseInt(req.params.matchId);

  try {
    const match = await prisma.request.findFirst({
      where: {
        id: matchId,
        status: "accepted",
        OR: [{ senderId: req.userId }, { receiverId: req.userId }],
      },
    });

    if (!match) {
      return res.status(403).json({ error: "Access denied" });
    }

    const messages = await prisma.message.findMany({
      where: { matchId },
      orderBy: { sentAt: "asc" },
    });

    res.json(messages);
  } catch (err) {
    console.error("Failed to load messages:", err);
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
    const match = await prisma.request.findFirst({
      where: {
        id: parseInt(matchId),
        status: "accepted",
        OR: [{ senderId: req.userId }, { receiverId: req.userId }],
      },
    });

    if (!match) {
      return res
        .status(403)
        .json({ error: "Not matched or match not accepted" });
    }

    const message = await prisma.message.create({
      data: {
        matchId: parseInt(matchId),
        senderId: req.userId,
        content,
      },
    });

    res.json(message);
  } catch (err) {
    console.error("Failed to save message:", err);
    res.status(500).json({ error: "Failed to save message" });
  }
});

module.exports = router;
