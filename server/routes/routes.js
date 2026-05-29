// GET /messages/5  ← the :matchId becomes req.params.matchId
app.get("/messages/:matchId", async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { matchId: parseInt(req.params.matchId) },
  });
  res.json(messages);
});

// POST /messages
app.post("/messages", async (req, res) => {
  const { matchId, senderId, content } = req.body;
  const message = await prisma.message.create({
    data: { matchId, senderId, content },
  });
  res.json(message);
});
